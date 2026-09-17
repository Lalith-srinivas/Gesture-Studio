/**
 * Leaderboard Service
 * ───────────────────
 * Reads and writes leaderboard data from Firestore only — no fake seed data.
 *
 * Structure:
 *   leaderboards/global/entries/{uid}    → { uid, username, avatar, totalScore, level }
 *   leaderboards/{gameId}/entries/{uid}  → { uid, username, avatar, score }
 *
 * Features:
 *   - LocalStorage caching for instant loading & offline resilience
 *   - Real Firestore data only — leaderboard is empty until players submit scores
 *   - Automatic merge of cached + Firestore data on load
 */

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { GAME_LABELS } from './gameStatsService';

const LEADERBOARD_LIMIT = 50;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// ── LocalStorage helpers ────────────────────────────────────────────────────

function getCacheKey(id) {
  return `gs_lb_v2_${id}`;
}

function getLocalCache(key) {
  try {
    const raw = localStorage.getItem(getCacheKey(key));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    // Return null if cache is stale (older than TTL)
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function setLocalCache(key, data) {
  try {
    localStorage.setItem(getCacheKey(key), JSON.stringify({ data, ts: Date.now() }));
  } catch { /* silent — storage quota */ }
}

// Force-refresh cache (e.g. after a write)
function invalidateCache(key) {
  try {
    localStorage.removeItem(getCacheKey(key));
  } catch { /* silent */ }
}

// ── Write helpers ────────────────────────────────────────────────────────────

/**
 * Update the global leaderboard entry for a user.
 */
export async function updateGlobalLeaderboard(uid, playerData) {
  if (!uid) return;
  const entry = {
    uid,
    username: playerData.username || 'Player',
    avatar: playerData.avatar || '🎮',
    totalScore: playerData.totalScore || 0,
    level: playerData.level || 1,
    updatedAt: serverTimestamp(),
  };

  try {
    const ref = doc(db, 'leaderboards', 'global', 'entries', uid);
    await setDoc(ref, entry, { merge: true });
    invalidateCache('global');
  } catch (err) {
    console.warn('[Leaderboard] Firestore global write failed:', err?.message);
  }

  // Optimistically update local cache
  try {
    const cached = getLocalCache('global') || [];
    const filtered = cached.filter((e) => e.uid !== uid);
    filtered.push(entry);
    filtered.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    setLocalCache('global', filtered.slice(0, LEADERBOARD_LIMIT));
  } catch { /* silent */ }
}

/**
 * Update the per-game leaderboard with a player's best score.
 * Only overwrites if the new score is higher than the existing one in Firestore.
 */
export async function updateGameLeaderboard(uid, gameId, playerData, score) {
  if (!uid || !gameId) return;
  const entry = {
    uid,
    username: playerData.username || 'Player',
    avatar: playerData.avatar || '🎮',
    score: score || 0,
    updatedAt: serverTimestamp(),
  };

  try {
    const ref = doc(db, 'leaderboards', gameId, 'entries', uid);

    // Read existing entry to ensure we only keep the best score
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      const existingScore = existingSnap.data()?.score || 0;
      if (score <= existingScore) {
        // New score is not better — update username/avatar but keep the higher score
        await setDoc(ref, {
          uid,
          username: playerData.username || 'Player',
          avatar: playerData.avatar || '🎮',
          updatedAt: serverTimestamp(),
        }, { merge: true });
        invalidateCache(gameId);
        return;
      }
    }

    // New score is higher (or no existing entry) — write the full entry
    await setDoc(ref, entry, { merge: true });
    invalidateCache(gameId);
  } catch (err) {
    console.warn(`[Leaderboard] Firestore write for ${gameId} failed:`, err?.message);
  }

  // Optimistically update local cache
  try {
    const cached = getLocalCache(gameId) || [];
    const existingIdx = cached.findIndex((e) => e.uid === uid);
    if (existingIdx >= 0) {
      if ((cached[existingIdx].score || 0) < score) {
        cached[existingIdx] = entry;
      }
    } else {
      cached.push(entry);
    }
    cached.sort((a, b) => (b.score || 0) - (a.score || 0));
    setLocalCache(gameId, cached.slice(0, LEADERBOARD_LIMIT));
  } catch { /* silent */ }
}

// ── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch the global leaderboard (top N by totalScore) from Firestore.
 * Falls back to local cache if Firestore is unreachable.
 * Returns [] if there's truly no data yet.
 */
export async function getGlobalLeaderboard(topN = LEADERBOARD_LIMIT) {
  // Check local cache first (fast path)
  const cached = getLocalCache('global');
  if (cached && cached.length > 0) {
    // Return cached, but also kick off a background refresh
    _refreshGlobalCache(topN).catch(() => {});
    return cached.slice(0, topN).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  // No valid cache — fetch fresh from Firestore
  return _refreshGlobalCache(topN);
}

async function _refreshGlobalCache(topN = LEADERBOARD_LIMIT) {
  try {
    const entriesRef = collection(db, 'leaderboards', 'global', 'entries');
    const q = query(entriesRef, orderBy('totalScore', 'desc'), limit(topN));
    const snap = await getDocs(q);

    const items = [];
    snap.forEach((d) => items.push({ uid: d.id, ...d.data() }));

    const ranked = items.map((item, idx) => ({ ...item, rank: idx + 1 }));
    setLocalCache('global', ranked);
    return ranked;
  } catch (err) {
    console.warn('[Leaderboard] Firestore global fetch failed:', err?.message);
    // Return stale cache (ignore TTL) on network failure
    try {
      const raw = localStorage.getItem(getCacheKey('global'));
      if (raw) {
        const { data } = JSON.parse(raw);
        if (data?.length > 0) {
          return data.map((item, idx) => ({ ...item, rank: idx + 1 }));
        }
      }
    } catch { /* silent */ }
    return [];
  }
}

/**
 * Fetch a per-game leaderboard (top N by score) from Firestore.
 */
export async function getGameLeaderboard(gameId, topN = LEADERBOARD_LIMIT) {
  if (!gameId) return [];

  const cached = getLocalCache(gameId);
  if (cached && cached.length > 0) {
    _refreshGameCache(gameId, topN).catch(() => {});
    return cached.slice(0, topN).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  return _refreshGameCache(gameId, topN);
}

async function _refreshGameCache(gameId, topN = LEADERBOARD_LIMIT) {
  try {
    const entriesRef = collection(db, 'leaderboards', gameId, 'entries');
    const q = query(entriesRef, orderBy('score', 'desc'), limit(topN));
    const snap = await getDocs(q);

    const items = [];
    snap.forEach((d) => items.push({ uid: d.id, ...d.data() }));

    const ranked = items.map((item, idx) => ({ ...item, rank: idx + 1 }));
    setLocalCache(gameId, ranked);
    return ranked;
  } catch (err) {
    console.warn(`[Leaderboard] Firestore fetch for ${gameId} failed:`, err?.message);
    try {
      const raw = localStorage.getItem(getCacheKey(gameId));
      if (raw) {
        const { data } = JSON.parse(raw);
        if (data?.length > 0) {
          return data.map((item, idx) => ({ ...item, rank: idx + 1 }));
        }
      }
    } catch { /* silent */ }
    return [];
  }
}

/**
 * Subscribe to the global leaderboard with a real-time Firestore listener.
 * Returns an unsubscribe function.
 */
export function subscribeGlobalLeaderboard(topN = LEADERBOARD_LIMIT, onUpdate) {
  try {
    const entriesRef = collection(db, 'leaderboards', 'global', 'entries');
    const q = query(entriesRef, orderBy('totalScore', 'desc'), limit(topN));
    return onSnapshot(q, (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ uid: d.id, ...d.data() }));
      const ranked = items.map((item, idx) => ({ ...item, rank: idx + 1 }));
      setLocalCache('global', ranked);
      onUpdate(ranked);
    }, (err) => {
      console.warn('[Leaderboard] Real-time listener error:', err?.message);
    });
  } catch {
    return () => {};
  }
}

/**
 * Subscribe to a per-game leaderboard with a real-time listener.
 */
export function subscribeGameLeaderboard(gameId, topN = LEADERBOARD_LIMIT, onUpdate) {
  if (!gameId) return () => {};
  try {
    const entriesRef = collection(db, 'leaderboards', gameId, 'entries');
    const q = query(entriesRef, orderBy('score', 'desc'), limit(topN));
    return onSnapshot(q, (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ uid: d.id, ...d.data() }));
      const ranked = items.map((item, idx) => ({ ...item, rank: idx + 1 }));
      setLocalCache(gameId, ranked);
      onUpdate(ranked);
    }, (err) => {
      console.warn(`[Leaderboard] Real-time listener error for ${gameId}:`, err?.message);
    });
  } catch {
    return () => {};
  }
}

/**
 * Find the current player's rank entry in a leaderboard array.
 */
export function findPlayerRank(uid, leaderboard) {
  if (!uid || !Array.isArray(leaderboard)) return null;
  return leaderboard.find((entry) => entry.uid === uid) || null;
}
