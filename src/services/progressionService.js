/**
 * Progression Service
 * ───────────────────
 * SINGLE ENTRY POINT for recording game results.
 * All games must call recordGameResult() — never write to
 * Firestore directly from game components.
 *
 * Handles:
 *   1. Session deduplication (prevents double XP from React rerenders)
 *   2. Game stats update (per-game subcollection)
 *   3. Personal best detection
 *   4. XP calculation & award
 *   5. Level calculation
 *   6. Game streak update
 *   7. Achievement checking
 *   8. Global & per-game leaderboard update
 *   9. User root document update (xp, level, totalScore, gamesPlayed)
 *   10. Returns structured result for post-game UI
 *
 * TODO: Before competitive production launch, move score submission to
 * a trusted Cloud Function to prevent client-side score manipulation.
 * Currently, scores are client-trusted.
 */

import { doc, updateDoc, getDoc, increment, setDoc, collection, getDocs, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { calculateGameXP, getLevelFromXP } from './xpService';
import { checkNewAchievements, getAchievementById } from './achievementService';
import { updateGameStats } from './gameStatsService';
import { calculateGameStreak, persistGameStreak } from './streakService';
import { updateGlobalLeaderboard, updateGameLeaderboard } from './leaderboardService';

// Track session IDs to prevent double submission from React double-renders
const processedSessions = new Set();

/**
 * Record a completed game session and process all progression.
 *
 * @param {object} params
 * @param {string} params.uid            — Firebase UID
 * @param {string} params.gameId         — e.g. 'fruit-ninja', 'flappy-bird'
 * @param {number} params.score          — final score
 * @param {number} [params.combo]        — highest combo achieved
 * @param {string} [params.sessionId]    — unique session ID to prevent double submissions
 * @param {object} [params.playerData]   — current player profile (to avoid re-fetch)
 * @param {string} [params.username]
 * @param {string} [params.avatar]
 *
 * @returns {Promise<{
 *   xpEarned: number,
 *   isPersonalBest: boolean,
 *   prevBest: number,
 *   newLevel: number | null,  // set if player leveled up
 *   unlockedAchievements: object[],
 *   currentStreak: number,
 *   isStreakMilestone: boolean,
 *   error: string | null
 * }>}
 */
export async function recordGameResult({
  uid,
  gameId,
  score = 0,
  combo = 0,
  sessionId = null,
  playerData = null,
  username = 'Player',
  avatar = '🎮',
}) {
  // ── 1. Deduplication ────────────────────────────────────────────────────────
  if (sessionId && processedSessions.has(sessionId)) {
    console.warn('[Progression] Duplicate session detected, skipping:', sessionId);
    return { xpEarned: 0, isPersonalBest: false, prevBest: 0, newLevel: null, unlockedAchievements: [], currentStreak: 0, isStreakMilestone: false, error: 'Duplicate session' };
  }
  if (sessionId) processedSessions.add(sessionId);

  // Clean up old sessions (keep last 50)
  if (processedSessions.size > 50) {
    const arr = [...processedSessions];
    arr.slice(0, arr.length - 50).forEach((s) => processedSessions.delete(s));
  }

  // If not authenticated, return gracefully (guest without uid)
  if (!uid) {
    return { xpEarned: 0, isPersonalBest: false, prevBest: 0, newLevel: null, unlockedAchievements: [], currentStreak: 0, isStreakMilestone: false, error: null };
  }

  try {
    // ── 2. Fetch current player data if not provided ──────────────────────────
    let profile = playerData;
    if (!profile) {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      profile = snap.exists() ? snap.data() : {};
    }

    const prevXP = profile?.xp || 0;
    const prevLevel = getLevelFromXP(prevXP).level;

    // ── 3. Update game stats (gets prev best) ─────────────────────────────────
    const { newBestScore: isPersonalBest, updatedStats } = await updateGameStats(uid, gameId, { score, combo });
    const prevBest = isPersonalBest ? (updatedStats.bestScore - score < 0 ? 0 : updatedStats.bestScore - score) : updatedStats.bestScore;

    // ── 4. XP calculation ─────────────────────────────────────────────────────
    const xpEarned = calculateGameXP({ score, isNewPersonalBest: isPersonalBest, combo });

    // ── 5. Game streak update ─────────────────────────────────────────────────
    const streakUpdate = calculateGameStreak(profile);

    // ── 6. Fetch already unlocked achievements ────────────────────────────────
    let alreadyUnlocked = profile?.achievementsUnlocked || [];
    if (!Array.isArray(alreadyUnlocked)) alreadyUnlocked = [];

    // Build updated player data for achievement checks
    const gamesPlayedByGame = { ...(profile?.gamesPlayedByGame || {}), [gameId]: true };
    const updatedProfile = {
      ...profile,
      xp: prevXP + xpEarned,
      level: getLevelFromXP(prevXP + xpEarned).level,
      totalGamesPlayed: (profile?.totalGamesPlayed || 0) + 1,
      totalScore: (profile?.totalScore || 0) + score,
      currentGameStreak: streakUpdate.currentGameStreak,
      longestGameStreak: streakUpdate.longestGameStreak,
      gamesPlayedByGame,
    };

    // ── 7. Check achievements ─────────────────────────────────────────────────
    const gameResult = { gameId, score, combo };
    const newAchievementIds = checkNewAchievements(updatedProfile, alreadyUnlocked, gameResult);
    const unlockedAchievements = newAchievementIds.map((id) => getAchievementById(id)).filter(Boolean);

    // Calculate bonus XP from achievements
    const achXP = unlockedAchievements.reduce((sum, a) => sum + (a.xp || 50), 0);
    const totalXPEarned = xpEarned + achXP;
    const newXP = prevXP + totalXPEarned;
    const newLevel = getLevelFromXP(newXP).level;
    const didLevelUp = newLevel > prevLevel;

    // ── 8. Persist all achievements to Firestore (atomic arrayUnion) ──────────
    if (newAchievementIds.length > 0) {
      // Write each individual achievement sub-document
      for (const achId of newAchievementIds) {
        const achDef = getAchievementById(achId);
        if (!achDef) continue;
        try {
          const achRef = doc(db, 'users', uid, 'unlockedAchievements', achId);
          await setDoc(achRef, {
            ...achDef,
            unlockedAt: new Date().toISOString(),
          }, { merge: true });
        } catch { /* silent */ }
      }

      // Use arrayUnion to atomically append IDs to the root doc — NEVER replaces the full array
      try {
        await setDoc(doc(db, 'users', uid), {
          achievementsUnlocked: arrayUnion(...newAchievementIds),
        }, { merge: true });
      } catch { /* silent */ }
    }

    // ── 9. Update user root document ──────────────────────────────────────────
    try {
      await setDoc(doc(db, 'users', uid), {
        xp: increment(totalXPEarned),
        level: newLevel,
        totalGamesPlayed: increment(1),
        totalScore: increment(score),
        gamesPlayedByGame,
        lastActiveAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.warn('[Progression] Failed to update user root:', err?.message);
    }

    // ── 10. Persist streak ────────────────────────────────────────────────────
    await persistGameStreak(uid, streakUpdate);

    // ── 11. Update leaderboards (always — not just personal bests) ────────────
    const newTotalScore = (profile?.totalScore || 0) + score;
    updateGlobalLeaderboard(uid, {
      username: username || profile?.username || 'Player',
      avatar: avatar || profile?.avatar || '🎮',
      totalScore: newTotalScore,
      level: newLevel,
    }).catch(() => {});

    // Always update game leaderboard — service will keep the best score
    updateGameLeaderboard(uid, gameId, {
      username: username || profile?.username || 'Player',
      avatar: avatar || profile?.avatar || '🎮',
    }, score).catch(() => {});

    return {
      xpEarned: totalXPEarned,
      isPersonalBest,
      prevBest: isPersonalBest ? (updatedStats.bestScore - score <= 0 ? 0 : updatedStats.bestScore - score) : updatedStats.bestScore,
      newLevel: didLevelUp ? newLevel : null,
      prevLevel: didLevelUp ? prevLevel : null,
      unlockedAchievements,
      currentStreak: streakUpdate.currentGameStreak,
      isStreakMilestone: streakUpdate.isStreakMilestone,
      error: null,
    };
  } catch (err) {
    console.error('[Progression] Error recording game result:', err);
    return {
      xpEarned: 0,
      isPersonalBest: false,
      prevBest: 0,
      newLevel: null,
      unlockedAchievements: [],
      currentStreak: 0,
      isStreakMilestone: false,
      error: err?.message || 'Unknown error',
    };
  }
}

/**
 * Record Gesture Academy completion.
 * Awards XP + Gesture Master achievement.
 * Idempotent — checks if already awarded.
 *
 * @param {string} uid
 * @param {object} playerData
 */
export async function recordAcademyCompletion(uid, playerData) {
  if (!uid) return { xpEarned: 0 };
  if (playerData?.tutorialCompleted) return { xpEarned: 0 }; // Already awarded

  const { XP_CONFIG } = await import('./xpService');
  const xpEarned = XP_CONFIG.GESTURE_ACADEMY_COMPLETE;

  try {
    localStorage.setItem('gesture_academy_global_done', 'true');
    localStorage.setItem('gesture_studio_academy_certified', 'true');
  } catch { /* silent */ }

  try {
    await setDoc(doc(db, 'users', uid), {
      tutorialCompleted: true,
      tutorialCompletedAt: new Date().toISOString(),
      xp: increment(xpEarned),
    }, { merge: true });

    // Unlock Gesture Master achievement if not already
    const alreadyUnlocked = playerData?.achievementsUnlocked || [];
    if (!alreadyUnlocked.includes('gesture_master')) {
      const achRef = doc(db, 'users', uid, 'unlockedAchievements', 'gesture_master');
      await setDoc(achRef, {
        id: 'gesture_master',
        title: 'Gesture Master',
        icon: '🎓',
        xp: 200,
        unlockedAt: new Date().toISOString(),
      }, { merge: true });

      // Use arrayUnion — never overwrite the full array
      await setDoc(doc(db, 'users', uid), {
        achievementsUnlocked: arrayUnion('gesture_master'),
      }, { merge: true });
    }

    return { xpEarned };
  } catch (err) {
    console.warn('[Progression] Academy completion error:', err?.message);
    return { xpEarned };
  }
}

