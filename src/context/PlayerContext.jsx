/**
 * PlayerContext
 * ─────────────
 * Global player state provider with optimistic updates & offline persistence.
 * Wraps the app and provides XP, level, streak, achievements,
 * daily reward status, and the recordGameResult function to all components.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, onSnapshot, collection, getDocs, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../hooks/useAuth';
import { getLevelFromXP } from '../services/xpService';
import { recordGameResult as _recordGameResult, recordAcademyCompletion as _recordAcademy } from '../services/progressionService';
import { canClaimTodayReward, claimDailyReward as _claimDailyReward, getNextClaimDay, getTodayDateString } from '../services/dailyRewardService';
import { ACHIEVEMENTS } from '../services/achievementService';

const PlayerContext = createContext(null);

function getCachedPlayer(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`gesture_studio_player_${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCachedPlayer(uid, data) {
  if (!uid || !data) return;
  try {
    localStorage.setItem(`gesture_studio_player_${uid}`, JSON.stringify(data));
  } catch { /* silent */ }
}

function getCachedStats(uid) {
  if (!uid) return {};
  try {
    const raw = localStorage.getItem(`gesture_studio_stats_${uid}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCachedStats(uid, stats) {
  if (!uid || !stats) return;
  try {
    localStorage.setItem(`gesture_studio_stats_${uid}`, JSON.stringify(stats));
  } catch { /* silent */ }
}

export function PlayerProvider({ children }) {
  const { currentUser, userProfile } = useAuth();
  const effectiveUid = currentUser?.uid || localStorage.getItem('gesture_studio_last_uid') || 'guest_default';
  const uid = currentUser?.uid || null;

  // Initialize with local cache immediately for zero-lag UI
  const [playerData, setPlayerData] = useState(() => getCachedPlayer(effectiveUid));
  const [allGameStats, setAllGameStats] = useState(() => getCachedStats(effectiveUid) || {});
  const [unlockedAchievements, setUnlockedAchievements] = useState(() => {
    const cached = getCachedPlayer(effectiveUid);
    return cached?.achievementsUnlocked || [];
  });
  const [loading, setLoading] = useState(!playerData);

  // For post-game notifications
  const [pendingLevelUp, setPendingLevelUp] = useState(null);
  const [pendingAchievements, setPendingAchievements] = useState([]);
  const [lastGameResult, setLastGameResult] = useState(null);

  // Daily reward
  const [dailyRewardClaimed, setDailyRewardClaimed] = useState(() => {
    const cached = getCachedPlayer(effectiveUid);
    return !canClaimTodayReward(cached);
  });

  const listenerUnsub = useRef(null);

  // ── Sync with Firebase on mount or user change ─────────────────────────────
  useEffect(() => {
    const targetUid = uid || effectiveUid;
    if (!targetUid) return;

    // Hydrate from cache immediately
    const cached = getCachedPlayer(targetUid);
    if (cached) {
      setPlayerData(cached);
      setDailyRewardClaimed(!canClaimTodayReward(cached));
    }
    const cachedStats = getCachedStats(targetUid);
    if (cachedStats && Object.keys(cachedStats).length > 0) {
      setAllGameStats(cachedStats);
    }

    if (!uid) {
      // Waiting for auth to resolve — keep cached profile visible, don't wipe to null!
      setLoading(false);
      return;
    }

    if (listenerUnsub.current) listenerUnsub.current();

    const userRef = doc(db, 'users', uid);
    listenerUnsub.current = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPlayerData(data);
          saveCachedPlayer(uid, data);
          setDailyRewardClaimed(!canClaimTodayReward(data));
          if (Array.isArray(data.achievementsUnlocked)) {
            setUnlockedAchievements(data.achievementsUnlocked);
          }
          // Ensure player's total score is present in the global leaderboard!
          if ((data.totalScore || 0) > 0) {
            updateGlobalLeaderboard(uid, data).catch(() => {});
          }
        } else {
          // Document does not exist in Firestore yet: initialize it with userProfile or guest defaults
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const initial = userProfile || {
            uid,
            username: currentUser.displayName || (currentUser.isAnonymous ? `Guest_${randomSuffix}` : 'Player'),
            avatar: '🎮',
            xp: 0,
            level: 1,
            totalScore: 0,
            totalGamesPlayed: 0,
            currentGameStreak: 0,
            longestGameStreak: 0,
            lastGamePlayedDate: null,
            dailyRewardDay: 0,
            lastDailyRewardDate: null,
            achievementsUnlocked: [],
            tutorialCompleted: localStorage.getItem('gesture_academy_global_done') === 'true',
          };
          setPlayerData(initial);
          saveCachedPlayer(uid, initial);
          setDoc(userRef, initial, { merge: true }).catch(() => {});
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[PlayerContext] Snapshot error, running in offline/cache mode:', err?.message);
        if (!playerData && userProfile) setPlayerData(userProfile);
        setLoading(false);
      }
    );

    return () => {
      if (listenerUnsub.current) listenerUnsub.current();
    };
  }, [uid]);

  // ── Load game stats and unlocked achievements subcollections ───────────────
  useEffect(() => {
    if (!uid) return;
    const fetchStats = async () => {
      try {
        const colRef = collection(db, 'users', uid, 'gameStats');
        const snap = await getDocs(colRef);
        const result = {};
        snap.forEach((d) => { result[d.id] = d.data(); });
        if (Object.keys(result).length > 0) {
          setAllGameStats(result);
          saveCachedStats(uid, result);
        }
      } catch { /* silent */ }
    };

    const fetchSubAchievements = async () => {
      try {
        const colRef = collection(db, 'users', uid, 'unlockedAchievements');
        const snap = await getDocs(colRef);
        const subIds = [];
        snap.forEach((d) => subIds.push(d.id));
        if (subIds.length > 0) {
          setUnlockedAchievements((prev) => Array.from(new Set([...prev, ...subIds])));
        }
      } catch { /* silent */ }
    };

    fetchStats();
    fetchSubAchievements();
  }, [uid, playerData?.totalGamesPlayed]);

  const unlockedAchievementsRef = useRef(unlockedAchievements);
  useEffect(() => {
    unlockedAchievementsRef.current = unlockedAchievements;
  }, [unlockedAchievements]);

  // ── Auto-reconcile earned achievements from current stats & state ──────────
  useEffect(() => {
    if (!playerData) return;
    const contextData = { ...playerData, allGameStats };
    const newlyQualified = [];
    const currentUnlocked = unlockedAchievementsRef.current;

    for (const ach of ACHIEVEMENTS) {
      if (currentUnlocked.includes(ach.id)) continue;
      try {
        if (ach.check(contextData)) {
          newlyQualified.push(ach.id);
        }
      } catch { /* silent */ }
    }

    if (newlyQualified.length > 0) {
      setUnlockedAchievements((prev) => {
        const combined = Array.from(new Set([...prev, ...newlyQualified]));
        unlockedAchievementsRef.current = combined;
        if (uid) {
          const cached = getCachedPlayer(uid) || {};
          saveCachedPlayer(uid, { ...cached, achievementsUnlocked: combined });
          setDoc(doc(db, 'users', uid), {
            achievementsUnlocked: arrayUnion(...newlyQualified),
          }, { merge: true }).catch(() => {});
        }
        return combined;
      });
    }
  }, [uid, playerData?.totalGamesPlayed, playerData?.totalScore, playerData?.level, allGameStats]);

  // ── Derived XP info ────────────────────────────────────────────────────────
  const xpInfo = playerData ? getLevelFromXP(playerData.xp || 0) : getLevelFromXP(0);

  // ── recordGameResult ───────────────────────────────────────────────────────
  const recordGameResult = useCallback(async (params) => {
    const targetUid = uid || effectiveUid;
    if (!targetUid) return null;

    const currentScore = params.score || 0;
    const currentPrevScore = playerData?.totalScore || 0;

    const result = await _recordGameResult({
      ...params,
      uid: targetUid,
      username: playerData?.username || currentUser?.displayName || 'Player',
      avatar: playerData?.avatar || '🎮',
      playerData,
    });

    if (result && result.error !== 'Duplicate session') {
      const earnedXP = result.xpEarned || 0;
      const today = getTodayDateString();

      // OPTIMISTIC STATE UPDATE — update state immediately
      setPlayerData((prev) => {
        const current = prev || {};
        const newTotalScore = (current.totalScore || currentPrevScore) + currentScore;
        const newXP = (current.xp || 0) + earnedXP;
        const newLevelCalc = getLevelFromXP(newXP).level;
        const newStreak = result.currentStreak || current.currentGameStreak || 1;
        const newLongest = Math.max(newStreak, current.longestGameStreak || 1);

        const newUnlocked = [
          ...(current.achievementsUnlocked || []),
          ...(result.unlockedAchievements || []).map((a) => a.id),
        ];

        const updated = {
          ...current,
          totalScore: newTotalScore,
          xp: newXP,
          level: newLevelCalc,
          totalGamesPlayed: (current.totalGamesPlayed || 0) + 1,
          currentGameStreak: newStreak,
          longestGameStreak: newLongest,
          lastGamePlayedDate: today,
          achievementsUnlocked: Array.from(new Set(newUnlocked)),
        };

        saveCachedPlayer(uid, updated);
        return updated;
      });

      // Update per-game stats locally
      setAllGameStats((prev) => {
        const prevStats = prev[params.gameId] || { bestScore: 0, gamesPlayed: 0 };
        const nextStats = {
          ...prevStats,
          bestScore: Math.max(prevStats.bestScore || 0, currentScore),
          gamesPlayed: (prevStats.gamesPlayed || 0) + 1,
          lastPlayed: new Date().toISOString(),
        };
        const updatedAll = { ...prev, [params.gameId]: nextStats };
        saveCachedStats(uid, updatedAll);
        return updatedAll;
      });

      // Queue post-game notifications
      if (result.newLevel) {
        setPendingLevelUp({ level: result.newLevel, prevLevel: result.prevLevel });
      }
      if (result.unlockedAchievements?.length > 0) {
        setPendingAchievements((prev) => [...prev, ...result.unlockedAchievements]);
        const ids = result.unlockedAchievements.map((a) => a.id);
        setUnlockedAchievements((prev) => Array.from(new Set([...prev, ...ids])));
      }

      setLastGameResult(result);
    }

    return result;
  }, [uid, playerData, currentUser]);

  // ── recordAcademyCompletion ────────────────────────────────────────────────
  const recordAcademyCompletion = useCallback(async () => {
    const targetUid = uid || effectiveUid;
    if (!targetUid) return null;
    const result = await _recordAcademy(targetUid, playerData);

    const xpEarned = result?.xpEarned || 200;
    setPlayerData((prev) => {
      const current = prev || {};
      const newXP = (current.xp || 0) + xpEarned;
      const updated = {
        ...current,
        tutorialCompleted: true,
        xp: newXP,
        level: getLevelFromXP(newXP).level,
        achievementsUnlocked: Array.from(new Set([...(current.achievementsUnlocked || []), 'gesture_master'])),
      };
      saveCachedPlayer(targetUid, updated);
      return updated;
    });

    setUnlockedAchievements((prev) => Array.from(new Set([...prev, 'gesture_master'])));

    try {
      localStorage.setItem('gesture_academy_global_done', 'true');
      localStorage.setItem('gesture_studio_academy_certified', 'true');
    } catch { /* silent */ }

    setPendingAchievements((prev) => [
      ...prev,
      { id: 'gesture_master', title: 'Gesture Master', icon: '🎓', xp: 200 }
    ]);

    return result;
  }, [uid, effectiveUid, playerData]);

  // ── claimDailyReward ───────────────────────────────────────────────────────
  const claimDailyReward = useCallback(async () => {
    const targetUid = uid || effectiveUid;
    if (!targetUid) return null;
    const result = await _claimDailyReward(targetUid, playerData);

    if (!result?.error || (result?.xpEarned && result.xpEarned > 0)) {
      const xpEarned = result.xpEarned || 50;
      const day = result.day || 1;
      const today = getTodayDateString();

      setDailyRewardClaimed(true);

      // OPTIMISTIC STATE UPDATE — reflect new XP immediately
      setPlayerData((prev) => {
        const current = prev || {};
        const newXP = (current.xp || 0) + xpEarned;
        const updated = {
          ...current,
          xp: newXP,
          level: getLevelFromXP(newXP).level,
          dailyRewardDay: day,
          lastDailyRewardDate: today,
          achievementsUnlocked: Array.from(new Set([...(current.achievementsUnlocked || []), 'daily_claim_first'])),
        };
        saveCachedPlayer(targetUid, updated);
        return updated;
      });

      setUnlockedAchievements((prev) => Array.from(new Set([...prev, 'daily_claim_first'])));

      try {
        localStorage.setItem('gesture_studio_daily_claimed', 'true');
        setDoc(doc(db, 'users', targetUid), {
          achievementsUnlocked: arrayUnion('daily_claim_first'),
        }, { merge: true }).catch(() => {});
      } catch { /* silent */ }
    }
    return result;
  }, [uid, effectiveUid, playerData]);

  // ── Clear notifications ───────────────────────────────────────────────────
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
      if (snap.exists()) {
        const data = snap.data();
        setPlayerData(data);
        saveCachedPlayer(uid, data);
      }
    } catch { /* silent */ }
  }, [uid]);

  const nextDailyReward = playerData ? getNextClaimDay(playerData) : { day: 1, reward: { xp: 50 }, claimed: false };

  const value = {
    playerData,
    xpInfo,
    allGameStats,
    unlockedAchievements,
    loading,

    dailyRewardClaimed,
    nextDailyReward,
    claimDailyReward,

    recordGameResult,
    recordAcademyCompletion,
    refreshPlayer,

    pendingLevelUp,
    pendingAchievements,
    lastGameResult,
    clearPendingLevelUp,
    clearPendingAchievements,
    shiftPendingAchievement,

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
