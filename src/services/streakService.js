/**
 * Streak Service (Game-Based)
 * ───────────────────────────
 * Tracks player streaks based on ACTUAL GAMEPLAY, not logins.
 * A day only counts if the player played at least one game.
 *
 * Firestore fields used (on user root doc):
 *   currentGameStreak: number
 *   longestGameStreak: number
 *   lastGamePlayedDate: string (YYYY-MM-DD)
 *
 * Logic:
 *   - Same day gameplay → streak unchanged
 *   - Yesterday gameplay → streak +1
 *   - Missed days → reset to 1
 */

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Get today's date as YYYY-MM-DD string (local time).
 */
export function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Get yesterday's date as YYYY-MM-DD string (local time).
 */
export function getYesterdayDateString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
}

/**
 * Calculate updated streak values after a game is played.
 * Pure function — no side effects.
 *
 * @param {object} playerData — current user profile
 * @returns {{ currentGameStreak: number, longestGameStreak: number, lastGamePlayedDate: string, isNewDay: boolean, isStreakMilestone: boolean }}
 */
export function calculateGameStreak(playerData) {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();
  const lastPlayed = playerData?.lastGamePlayedDate || null;
  const current = playerData?.currentGameStreak || 0;
  const longest = playerData?.longestGameStreak || 0;

  // Already played today — no change
  if (lastPlayed === today) {
    return {
      currentGameStreak: current,
      longestGameStreak: longest,
      lastGamePlayedDate: today,
      isNewDay: false,
      isStreakMilestone: false,
    };
  }

  let newStreak;
  if (lastPlayed === yesterday) {
    // Consecutive day
    newStreak = current + 1;
  } else {
    // First game ever or streak broken
    newStreak = 1;
  }

  const newLongest = Math.max(newStreak, longest);
  const milestones = [3, 7, 14, 30];
  const isStreakMilestone = milestones.includes(newStreak);

  return {
    currentGameStreak: newStreak,
    longestGameStreak: newLongest,
    lastGamePlayedDate: today,
    isNewDay: true,
    isStreakMilestone,
  };
}

/**
 * Persist the updated streak to Firestore.
 * Should be called AFTER calculateGameStreak().
 *
 * @param {string} uid
 * @param {object} streakUpdate — result from calculateGameStreak()
 */
export async function persistGameStreak(uid, streakUpdate) {
  if (!uid || !streakUpdate) return;
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      currentGameStreak: streakUpdate.currentGameStreak,
      longestGameStreak: streakUpdate.longestGameStreak,
      lastGamePlayedDate: streakUpdate.lastGamePlayedDate,
    });
  } catch (err) {
    console.warn('[Streak] Failed to persist streak to Firestore:', err?.message);
  }
}

/**
 * Get a visual weekly breakdown of streak days.
 * Returns an array of 7 objects for Mon-Sun of the current week.
 *
 * @param {string} lastGamePlayedDate — YYYY-MM-DD
 * @param {number} currentStreak
 * @returns {Array<{ label: string, active: boolean }>}
 */
export function getWeeklyStreakVisualization(lastGamePlayedDate, currentStreak) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  // Get this week's Monday
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  return days.map((label, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // Check if this date is within the current streak (working backwards from lastGamePlayedDate)
    let active = false;
    if (lastGamePlayedDate && currentStreak > 0) {
      const last = new Date(lastGamePlayedDate);
      const diffMs = last - date;
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      // Date is active if it's within the streak window (0 to currentStreak-1 days before lastPlayed)
      active = diffDays >= 0 && diffDays < currentStreak && date <= today;
    }

    return { label, active, dateStr };
  });
}

