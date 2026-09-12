/**
 * Daily Reward Service
 * ────────────────────
 * Manages the 7-day daily reward cycle.
 * Rewards can be claimed once per calendar day.
 * After day 7, the cycle resets to day 1.
 *
 * Firestore fields used (on user root doc):
 *   dailyRewardDay: number (1-7, current cycle day)
 *   lastDailyRewardDate: string (ISO date string YYYY-MM-DD)
 *
 * NOTE: We compare calendar dates, not 24h timestamps,
 * so claiming at 11:59pm and 12:01am the next day counts as different days.
 */

import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getDailyRewardXP } from './xpService';

// ─── Reward Definitions ───────────────────────────────────────────────────────
export const DAILY_REWARDS = [
  { day: 1, xp: 50,  badge: null,               label: 'Day 1 — Warm Up' },
  { day: 2, xp: 75,  badge: null,               label: 'Day 2 — Keep Going' },
  { day: 3, xp: 100, badge: null,               label: 'Day 3 — On a Roll!' },
  { day: 4, xp: 125, badge: null,               label: 'Day 4 — Halfway There' },
  { day: 5, xp: 150, badge: null,               label: 'Day 5 — Power Player' },
  { day: 6, xp: 200, badge: null,               label: 'Day 6 — Almost There!' },
  { day: 7, xp: 500, badge: '🏅 Streak Badge',  label: 'Day 7 — LEGENDARY!' },
];

/**
 * Get today's date as YYYY-MM-DD string (local time).
 */
export function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Check if the player can claim a daily reward today.
 * @param {object} playerData — user profile from Firestore
 * @returns {boolean}
 */
export function canClaimTodayReward(playerData) {
  const today = getTodayDateString();
  return playerData?.lastDailyRewardDate !== today;
}

/**
 * Get the reward definition for a given day (1-7).
 * @param {number} day
 * @returns {object}
 */
export function getRewardForDay(day) {
  const d = ((Math.max(1, day) - 1) % 7) + 1; // clamp to 1-7
  return DAILY_REWARDS.find((r) => r.day === d) || DAILY_REWARDS[0];
}

/**
 * Get what the NEXT claimable day would be for a player.
 * @param {object} playerData
 * @returns {{ day: number, reward: object }}
 */
export function getNextClaimDay(playerData) {
  const current = playerData?.dailyRewardDay || 0;
  // Check if today was already claimed
  const today = getTodayDateString();
  const alreadyClaimed = playerData?.lastDailyRewardDate === today;

  if (alreadyClaimed) {
    // Show the current day as claimed
    const claimedDay = ((current - 1) % 7) + 1;
    return { day: claimedDay, reward: getRewardForDay(claimedDay), claimed: true };
  }

  // Next claimable day
  const nextDay = ((current % 7) + 1); // 1-7 cycle
  return { day: nextDay, reward: getRewardForDay(nextDay), claimed: false };
}

/**
 * Claim the daily reward for the given user.
 * Updates Firestore and returns reward info.
 *
 * @param {string} uid
 * @param {object} playerData — current player profile
 * @returns {Promise<{ xpEarned: number, day: number, badge: string|null, error: string|null }>}
 */
export async function claimDailyReward(uid, playerData) {
  if (!uid) return { error: 'Not authenticated', xpEarned: 0, day: 1, badge: null };
  if (!canClaimTodayReward(playerData)) {
    return { error: 'Already claimed today', xpEarned: 0, day: playerData?.dailyRewardDay || 1, badge: null };
  }

  const today = getTodayDateString();
  const currentDay = playerData?.dailyRewardDay || 0;
  const nextDay = ((currentDay % 7) + 1); // advances 1-7 then cycles
  const reward = getRewardForDay(nextDay);
  const xpEarned = reward.xp;

  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      dailyRewardDay: nextDay,
      lastDailyRewardDate: today,
      xp: increment(xpEarned),
    }, { merge: true });

    try {
      localStorage.setItem(`gesture_studio_daily_${uid}`, JSON.stringify({
        day: nextDay,
        lastDate: today,
        xpEarned
      }));
    } catch { /* silent */ }

    return {
      xpEarned,
      day: nextDay,
      badge: reward.badge,
      error: null,
    };
  } catch (err) {
    console.warn('[DailyReward] Firestore write failed, returning local reward:', err?.message);
    // Even if Firestore fails, allow local reward claim!
    try {
      localStorage.setItem(`gesture_studio_daily_${uid}`, JSON.stringify({
        day: nextDay,
        lastDate: today,
        xpEarned
      }));
    } catch { /* silent */ }

    return {
      xpEarned,
      day: nextDay,
      badge: reward.badge,
      error: null,
    };
  }
}

