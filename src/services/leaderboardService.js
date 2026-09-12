/**
 * Leaderboard Service
 * ───────────────────
 * Reads and writes leaderboard data.
 *
 * Structure:
 *   leaderboards/global/entries/{uid}    → totalScore
 *   leaderboards/{gameId}/entries/{uid}  → bestScore for that game
 *
 * TODO: Replace client-trusted score submission with server-side
 * validation via Cloud Functions before competitive production launch.
 * Currently any client can submit arbitrary scores.
 */

import {
  doc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { GAME_LABELS } from './gameStatsService';

const LEADERBOARD_LIMIT = 50;

/**
 * Update the global leaderboard entry for a user.
 * Called after any game session updates totalScore.
 *
 * @param {string} uid
 * @param {object} playerData — { username, avatar, totalScore, level }
 */
export async function updateGlobalLeaderboard(uid, playerData) {
  if (!uid) return;
  // TODO: Move to server-side Cloud Function for score validation
  try {
    const ref = doc(db, 'leaderboards', 'global', 'entries', uid);
    await setDoc(ref, {
      uid,
      username: playerData.username || 'Player',
      avatar: playerData.avatar || '🎮',
      totalScore: playerData.totalScore || 0,
      level: playerData.level || 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('[Leaderboard] Failed to update global leaderboard:', err?.message);
  }
}

/**
 * Update the per-game leaderboard with a player's best score.
 * Only updates if this score is higher than the current entry.
 *
 * @param {string} uid
 * @param {string} gameId
 * @param {object} playerData — { username, avatar }
 * @param {number} bestScore
 */
export async function updateGameLeaderboard(uid, gameId, playerData, bestScore) {
  if (!uid || !gameId) return;
  // TODO: Move to server-side Cloud Function for score validation
  try {
    const ref = doc(db, 'leaderboards', gameId, 'entries', uid);
    const existing = await getDoc(ref);

    // Only write if this is a new best (avoid unnecessary writes)
    if (existing.exists() && existing.data().score >= bestScore) return;

    await setDoc(ref, {
      uid,
      username: playerData.username || 'Player',
      avatar: playerData.avatar || '🎮',
      score: bestScore,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn(`[Leaderboard] Failed to update game leaderboard for ${gameId}:`, err?.message);
  }
}

/**
 * Fetch the global leaderboard (top N by totalScore).
 * @param {number} topN
 * @returns {Promise<Array<{ uid, username, avatar, totalScore, level, rank }>>}
 */
export async function getGlobalLeaderboard(topN = LEADERBOARD_LIMIT) {
  try {
    const entriesRef = collection(db, 'leaderboards', 'global', 'entries');
    const q = query(entriesRef, orderBy('totalScore', 'desc'), limit(topN));
    const snap = await getDocs(q);
    const results = [];
    let rank = 1;
    snap.forEach((d) => {
      results.push({ ...d.data(), rank: rank++ });
    });
    return results;
  } catch (err) {
    console.warn('[Leaderboard] Failed to fetch global leaderboard:', err?.message);
    return [];
  }
}

/**
 * Fetch a per-game leaderboard (top N by score).
 * @param {string} gameId
 * @param {number} topN
 * @returns {Promise<Array<{ uid, username, avatar, score, rank }>>}
 */
export async function getGameLeaderboard(gameId, topN = LEADERBOARD_LIMIT) {
  if (!gameId) return [];
  try {
    const entriesRef = collection(db, 'leaderboards', gameId, 'entries');
    const q = query(entriesRef, orderBy('score', 'desc'), limit(topN));
    const snap = await getDocs(q);
    const results = [];
    let rank = 1;
    snap.forEach((d) => {
      results.push({ ...d.data(), rank: rank++ });
    });
    return results;
  } catch (err) {
    console.warn(`[Leaderboard] Failed to fetch game leaderboard for ${gameId}:`, err?.message);
    return [];
  }
}

/**
 * Find the current player's rank in a leaderboard array.
 * @param {string} uid
 * @param {Array} leaderboard
 * @returns {object|null}
 */
export function findPlayerRank(uid, leaderboard) {
  if (!uid || !leaderboard) return null;
  const entry = leaderboard.find((e) => e.uid === uid);
  return entry || null;
}

/**
 * Get all available game leaderboard IDs.
 */
export function getLeaderboardGameIds() {
  return Object.keys(GAME_LABELS);
}

