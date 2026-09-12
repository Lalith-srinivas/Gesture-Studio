/**
 * PlayerContext
 * ─────────────
 * Global player state provider.
 * Wraps the app and provides XP, level, streak, achievements,
 * daily reward status, and the recordGameResult function to all components.
 *
 * Depends on AuthContext — must be nested inside AuthProvider.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../hooks/useAuth';
import { getLevelFromXP } from '../services/xpService';
import { recordGameResult as _recordGameResult, recordAcademyCompletion as _recordAcademy } from '../services/progressionService';
import { canClaimTodayReward, claimDailyReward as _claimDailyReward, getNextClaimDay } from '../services/dailyRewardService';
import { ACHIEVEMENTS } from '../services/achievementService';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const { currentUser, userProfile, refreshProfile } = useAuth();

  const [playerData, setPlayerData] = useState(null);
  const [allGameStats, setAllGameStats] = useState({});
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  // For post-game notifications
  const [pendingLevelUp, setPendingLevelUp] = useState(null);
  const [pendingAchievements, setPendingAchievements] = useState([]);
  const [lastGameResult, setLastGameResult] = useState(null);

  // Daily reward
  const [dailyRewardClaimed, setDailyRewardClaimed] = useState(false);

  const uid = currentUser?.uid || null;
  const listenerUnsub = useRef(null);

  // ── Real-time listener on user document ────────────────────────────────────
  useEffect(() => {
    if (!uid) {
      setPlayerData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Clean up previous listener
    if (listenerUnsub.current) listenerUnsub.current();

    const userRef = doc(db, 'users', uid);
    listenerUnsub.current = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPlayerData(data);
          // Update daily reward status
          setDailyRewardClaimed(!canClaimTodayReward(data));
        } else {
          setPlayerData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[PlayerContext] Snapshot error:', err?.message);
        // Fallback to cached profile from AuthContext
        setPlayerData(userProfile);
        setLoading(false);
      }
    );

    return () => {
      if (listenerUnsub.current) listenerUnsub.current();
    };
  }, [uid]);

  // ── Load unlocked achievements ─────────────────────────────────────────────
  useEffect(() => {
    if (!uid) { setUnlockedAchievements([]); return; }

    const fetchAchievements = async () => {
      try {
        const colRef = collection(db, 'users', uid, 'unlockedAchievements');
        const snap = await getDocs(colRef);
        const ids = [];
        snap.forEach((d) => ids.push(d.id));
        setUnlockedAchievements(ids);
      } catch {
        // Use array from playerData as fallback
        setUnlockedAchievements(playerData?.achievementsUnlocked || []);
      }
    };

    fetchAchievements();
  }, [uid, playerData?.achievementsUnlocked?.length]);

  // ── Load all game stats ────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) { setAllGameStats({}); return; }
    const fetchStats = async () => {
      try {
        const colRef = collection(db, 'users', uid, 'gameStats');
        const snap = await getDocs(colRef);
        const result = {};
        snap.forEach((d) => { result[d.id] = d.data(); });
        setAllGameStats(result);
      } catch { /* silent */ }
    };
    fetchStats();
  }, [uid, playerData?.totalGamesPlayed]);

  // ── Derived XP info ────────────────────────────────────────────────────────
  const xpInfo = playerData ? getLevelFromXP(playerData.xp || 0) : getLevelFromXP(0);

  // ── recordGameResult ───────────────────────────────────────────────────────
  const recordGameResult = useCallback(async (params) => {
    if (!uid) return null;

    const result = await _recordGameResult({
      ...params,
      uid,
      username: playerData?.username || currentUser?.displayName || 'Player',
      avatar: playerData?.avatar || '🎮',
      playerData,
    });

    if (result.error && result.error !== 'Duplicate session') {
      console.warn('[PlayerContext] recordGameResult error:', result.error);
    }

    // Queue post-game notifications
    if (result.newLevel) {
      setPendingLevelUp({ level: result.newLevel, prevLevel: result.prevLevel });
    }
    if (result.unlockedAchievements?.length > 0) {
      setPendingAchievements((prev) => [...prev, ...result.unlockedAchievements]);
    }

    setLastGameResult(result);
    return result;
  }, [uid, playerData, currentUser]);

  // ── recordAcademyCompletion ────────────────────────────────────────────────
  const recordAcademyCompletion = useCallback(async () => {
    if (!uid) return null;
    const result = await _recordAcademy(uid, playerData);
    if (result.xpEarned > 0) {
      setPendingAchievements((prev) => [
        ...prev,
        { id: 'gesture_master', title: 'Gesture Master', icon: '🎓', xp: 200 }
      ]);
    }
    return result;
  }, [uid, playerData]);

  // ── claimDailyReward ───────────────────────────────────────────────────────
  const claimDailyReward = useCallback(async () => {
    if (!uid) return null;
    const result = await _claimDailyReward(uid, playerData);
    if (!result.error) {
      setDailyRewardClaimed(true);
    }
    return result;
  }, [uid, playerData]);

  // ── Clear pending notifications ────────────────────────────────────────────
  const clearPendingLevelUp = useCallback(() => setPendingLevelUp(null), []);
  const clearPendingAchievements = useCallback(() => setPendingAchievements([]), []);
  const shiftPendingAchievement = useCallback(() => {
    setPendingAchievements((prev) => prev.slice(1));
  }, []);

  // ── Refresh player data manually ───────────────────────────────────────────
  const refreshPlayer = useCallback(async () => {
    if (!uid) return;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) setPlayerData(snap.data());
    } catch { /* silent */ }
  }, [uid]);

  // ── Daily reward info ──────────────────────────────────────────────────────
  const nextDailyReward = playerData ? getNextClaimDay(playerData) : null;

  const value = {
    // State
    playerData,
    xpInfo,
    allGameStats,
    unlockedAchievements,
    loading,

    // Daily reward
    dailyRewardClaimed,
    nextDailyReward,
    claimDailyReward,

    // Actions
    recordGameResult,
    recordAcademyCompletion,
    refreshPlayer,

    // Post-game notifications
    pendingLevelUp,
    pendingAchievements,
    lastGameResult,
    clearPendingLevelUp,
    clearPendingAchievements,
    shiftPendingAchievement,

    // Convenience
    isGuest: Boolean(currentUser?.isAnonymous),
    isAuthenticated: Boolean(currentUser),
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayerContext() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayerContext must be used within PlayerProvider');
  return ctx;
}

export const usePlayer = usePlayerContext;

