/**
 * Custom hook providing convenient, memoized Firestore methods:
 * - Submitting high scores & combos
 * - Accessing leaderboards with automatic offline fallback
 * - Completing Gesture Academy tutorials
 * - Unlocking achievements
 */
import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  saveGameScore,
  getLeaderboard,
  recordAcademyCompletion,
  unlockAchievement,
  syncUserSettings
} from '../firebase/firestore';

export function useFirestore() {
  const { currentUser, userProfile, isOffline } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Submit game score to user statistics and global game leaderboard
   */
  const submitScore = useCallback(
    async (gameName, score, combo = 0) => {
      setSubmitting(true);
      setError(null);
      try {
        await saveGameScore({
          uid: currentUser?.uid,
          username: userProfile?.username || (currentUser?.isAnonymous ? 'Guest Player' : 'Player'),
          avatar: userProfile?.avatar || currentUser?.photoURL,
          gameName,
          score,
          combo
        });
        return { success: true };
      } catch (err) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setSubmitting(false);
      }
    },
    [currentUser, userProfile]
  );

  /**
   * Fetch game leaderboard
   */
  const fetchLeaderboard = useCallback(async (gameName, topLimit = 20) => {
    try {
      return await getLeaderboard(gameName, topLimit);
    } catch (err) {
      console.warn('[useFirestore] fetchLeaderboard error:', err);
      return [];
    }
  }, []);

  /**
   * Complete Gesture Academy
   */
  const completeAcademy = useCallback(async (version = 1) => {
    return await recordAcademyCompletion(currentUser?.uid, version);
  }, [currentUser]);

  /**
   * Unlock an achievement
   */
  const claimAchievement = useCallback(async (achievementId) => {
    if (!currentUser?.uid) return;
    return await unlockAchievement(currentUser.uid, achievementId);
  }, [currentUser]);

  /**
   * Save user settings
   */
  const saveSettings = useCallback(async (settings) => {
    return await syncUserSettings(currentUser?.uid, settings);
  }, [currentUser]);

  return {
    submitScore,
    fetchLeaderboard,
    completeAcademy,
    claimAchievement,
    saveSettings,
    submitting,
    error,
    isOffline
  };
}
