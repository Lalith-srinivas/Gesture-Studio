/**
 * Leaderboard Migration — One-time backfill
 * ──────────────────────────────────────────
 * Reads ALL users from Firestore, fetches each user's gameStats,
 * and writes their best scores into the per-game leaderboard entries
 * and their totalScore into the global leaderboard.
 *
 * Guarded by a localStorage flag so it only runs once per device.
 * Safe to re-run (uses best-score-wins logic from updateGameLeaderboard).
 */

import { collection, getDocs, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const MIGRATION_KEY = 'gs_lb_migration_v1_done';

/**
 * Run the one-time leaderboard backfill for ALL users.
 * Requires the caller to be authenticated (writes need auth).
 *
 * @returns {Promise<{ migrated: number, skipped: number, errors: number }>}
 */
export async function migrateAllUsersToLeaderboard() {
  // Guard: only run once per device
  try {
    if (localStorage.getItem(MIGRATION_KEY) === 'true') {
      return { migrated: 0, skipped: 0, errors: 0, alreadyDone: true };
    }
  } catch { /* proceed anyway */ }

  console.log('[LeaderboardMigration] Starting one-time backfill of all users...');

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // 1. Fetch all user documents
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = [];
    usersSnap.forEach((d) => users.push({ uid: d.id, ...d.data() }));

    console.log(`[LeaderboardMigration] Found ${users.length} users to process.`);

    for (const user of users) {
      try {
        const uid = user.uid;
        if (!uid) { skipped++; continue; }

        const username = user.username || user.displayName || 'Player';
        const avatar = user.avatar || '🎮';
        const totalScore = user.totalScore || 0;
        const level = user.level || 1;

        // 2. Update global leaderboard entry
        if (totalScore > 0) {
          const globalRef = doc(db, 'leaderboards', 'global', 'entries', uid);
          const existingGlobal = await getDoc(globalRef);
          const existingTotal = existingGlobal.exists() ? (existingGlobal.data()?.totalScore || 0) : 0;

          if (totalScore >= existingTotal) {
            await setDoc(globalRef, {
              uid,
              username,
              avatar,
              totalScore,
              level,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          }
        }

        // 3. Fetch this user's gameStats subcollection
        const statsSnap = await getDocs(collection(db, 'users', uid, 'gameStats'));
        const gameStats = {};
        statsSnap.forEach((d) => { gameStats[d.id] = d.data(); });

        // 4. Write each game's best score to the per-game leaderboard
        for (const [gameId, stats] of Object.entries(gameStats)) {
          const bestScore = stats?.bestScore || 0;
          if (bestScore <= 0) continue;

          const gameRef = doc(db, 'leaderboards', gameId, 'entries', uid);
          const existingGame = await getDoc(gameRef);
          const existingScore = existingGame.exists() ? (existingGame.data()?.score || 0) : 0;

          if (bestScore > existingScore) {
            await setDoc(gameRef, {
              uid,
              username,
              avatar,
              score: bestScore,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          }
        }

        migrated++;
      } catch (err) {
        console.warn(`[LeaderboardMigration] Error processing user:`, err?.message);
        errors++;
      }
    }

    // Mark migration as done
    try {
      localStorage.setItem(MIGRATION_KEY, 'true');
    } catch { /* silent */ }

    console.log(`[LeaderboardMigration] Done! Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);
  } catch (err) {
    console.error('[LeaderboardMigration] Fatal error:', err);
    errors++;
  }

  return { migrated, skipped, errors, alreadyDone: false };
}

