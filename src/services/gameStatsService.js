/**
 * Game Stats Service
 * ──────────────────
 * Manages per-game statistics stored in:
 *   users/{uid}/gameStats/{gameId}
 *
 * Fields per game:
 *   gameId, gamesPlayed, bestScore, totalScore,
 *   averageScore, highestCombo, lastPlayed
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

export const GAME_IDS = [
  'fruit-ninja',
  'flappy-bird',
  'archery',
  'bird-hunter',
  'hill-climb',
  'air-draw',
];

export const GAME_LABELS = {
  'fruit-ninja': { label: 'Fruit Ninja', emoji: '🍉' },
  'flappy-bird': { label: 'Flappy Bird', emoji: '🐦' },
  'archery':     { label: 'Archery Challenge', emoji: '🏹' },
  'bird-hunter': { label: 'Bird Hunter', emoji: '🦅' },
  'hill-climb':  { label: 'Crazy Road', emoji: '🏎️' },
  'air-draw':    { label: 'Air Draw', emoji: '🎨' },
};

/**
 * Default stats shape for a game.
 */
export function defaultGameStats(gameId) {
  return {
    gameId,
    gamesPlayed: 0,
    bestScore: 0,
    totalScore: 0,
    averageScore: 0,
    highestCombo: 0,
    lastPlayed: null,
  };
}

/**
 * Fetch stats for a specific game.
 * Returns default zeros if no data exists.
 *
 * @param {string} uid
 * @param {string} gameId
 * @returns {Promise<object>}
 */
export async function getGameStats(uid, gameId) {
  if (!uid || !gameId) return defaultGameStats(gameId);
  try {
    const ref = doc(db, 'users', uid, 'gameStats', gameId);
    const snap = await getDoc(ref);
    if (snap.exists()) return { ...defaultGameStats(gameId), ...snap.data() };
    return defaultGameStats(gameId);
  } catch (err) {
    console.warn(`[GameStats] Failed to fetch stats for ${gameId}:`, err?.message);
    return defaultGameStats(gameId);
  }
}

/**
 * Fetch stats for ALL games for a user.
 * @param {string} uid
 * @returns {Promise<Record<string, object>>}
 */
export async function getAllGameStats(uid) {
  if (!uid) return {};
  try {
    const colRef = collection(db, 'users', uid, 'gameStats');
    const snap = await getDocs(colRef);
    const result = {};
    snap.forEach((d) => {
      result[d.id] = d.data();
    });
    return result;
  } catch (err) {
    console.warn('[GameStats] Failed to fetch all game stats:', err?.message);
    return {};
  }
}

/**
 * Update game stats after a session.
 * Merges with existing data and recalculates averages.
 *
 * @param {string} uid
 * @param {string} gameId
 * @param {{ score: number, combo?: number }} sessionData
 * @returns {Promise<{ newBestScore: boolean, updatedStats: object }>}
 */
export async function updateGameStats(uid, gameId, sessionData) {
  if (!uid || !gameId) return { newBestScore: false, updatedStats: null };

  const { score = 0, combo = 0 } = sessionData;
  const existing = await getGameStats(uid, gameId);

  const newGamesPlayed = existing.gamesPlayed + 1;
  const isNewBest = score > existing.bestScore;
  const newBestScore = isNewBest ? score : existing.bestScore;
  const newHighestCombo = Math.max(combo, existing.highestCombo);
  const newTotalScore = existing.totalScore + score;
  const newAverage = Math.round(newTotalScore / newGamesPlayed);

  const updatedStats = {
    gameId,
    gamesPlayed: newGamesPlayed,
    bestScore: newBestScore,
    totalScore: newTotalScore,
    averageScore: newAverage,
    highestCombo: newHighestCombo,
    lastPlayed: new Date().toISOString(),
  };

  try {
    const ref = doc(db, 'users', uid, 'gameStats', gameId);
    await setDoc(ref, updatedStats, { merge: true });
  } catch (err) {
    console.warn(`[GameStats] Failed to save stats for ${gameId}:`, err?.message);
  }

  return { newBestScore: isNewBest, updatedStats };
}

