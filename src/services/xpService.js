/**
 * XP & Level Service
 * ─────────────────
 * Single source of truth for all XP values and level math.
 * Edit XP_CONFIG to tune rewards without touching game code.
 *
 * NOTE: XP is never awarded inside animation loops.
 * It is only awarded at meaningful events (game end, achievement, daily reward).
 */

// ─── XP Rewards Configuration ────────────────────────────────────────────────
export const XP_CONFIG = {
  GAME_COMPLETE: 10,          // Awarded every game played
  NEW_PERSONAL_BEST: 25,      // Awarded only when player beats their own best
  SCORE_BONUS_DIVISOR: 20,    // score / 20 = bonus XP (capped at 100)
  SCORE_BONUS_CAP: 100,       // Maximum score-bonus XP per game
  ACHIEVEMENT_BASE: 50,        // Default XP if achievement has no custom value
  DAILY_REWARD_DAY_1: 50,
  DAILY_REWARD_DAY_2: 75,
  DAILY_REWARD_DAY_3: 100,
  DAILY_REWARD_DAY_4: 125,
  DAILY_REWARD_DAY_5: 150,
  DAILY_REWARD_DAY_6: 200,
  DAILY_REWARD_DAY_7: 500,
  STREAK_MILESTONE_3: 30,
  STREAK_MILESTONE_7: 100,
  STREAK_MILESTONE_30: 500,
  GESTURE_ACADEMY_COMPLETE: 200,
};

// ─── Level Thresholds ─────────────────────────────────────────────────────────
// Levels 1-10 are manually defined for a smooth early curve.
// Above level 10, a scalable formula is used.
const MANUAL_LEVELS = [
  0,    // Level 1
  100,  // Level 2
  250,  // Level 3
  450,  // Level 4
  700,  // Level 5
  1000, // Level 6
  1350, // Level 7
  1750, // Level 8
  2200, // Level 9
  2700, // Level 10
];

/**
 * Get the total XP required to REACH a given level.
 * @param {number} level — 1-indexed level number
 * @returns {number}
 */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  if (level <= MANUAL_LEVELS.length) {
    return MANUAL_LEVELS[level - 1];
  }
  // Scalable formula for level 11+
  const base = MANUAL_LEVELS[MANUAL_LEVELS.length - 1];
  const n = level - MANUAL_LEVELS.length;
  return Math.round(base + n * 600 + n * n * 50);
}

/**
 * Calculate the player's current level info from raw XP.
 * @param {number} totalXP
 * @returns {{ level: number, currentLevelXP: number, nextLevelXP: number, progressPercent: number }}
 */
export function getLevelFromXP(totalXP) {
  const xp = Math.max(0, totalXP || 0);
  let level = 1;

  // Walk upward until we find the level the player is in
  while (true) {
    const nextThreshold = xpForLevel(level + 1);
    if (xp < nextThreshold) break;
    level++;
    if (level >= 100) break; // Safety cap
  }

  const currentLevelXP = xpForLevel(level);
  const nextLevelXP = xpForLevel(level + 1);
  const xpIntoLevel = xp - currentLevelXP;
  const xpNeededForNext = nextLevelXP - currentLevelXP;
  const progressPercent = Math.min(100, Math.round((xpIntoLevel / xpNeededForNext) * 100));

  return {
    level,
    currentLevelXP: xp,          // absolute XP
    nextLevelXP,                  // absolute XP needed for next level
    xpIntoLevel,                  // relative XP within current level
    xpNeededForNext,              // relative XP gap to next level
    progressPercent,
  };
}

/**
 * Calculate XP earned for a game session.
 * @param {{ score: number, isNewPersonalBest: boolean, combo?: number }} params
 * @returns {number}
 */
export function calculateGameXP({ score = 0, isNewPersonalBest = false, combo = 0 }) {
  let xp = XP_CONFIG.GAME_COMPLETE;

  // Score bonus: score / divisor, capped
  const scoreBonus = Math.min(
    Math.floor(score / XP_CONFIG.SCORE_BONUS_DIVISOR),
    XP_CONFIG.SCORE_BONUS_CAP
  );
  xp += scoreBonus;

  // Personal best bonus
  if (isNewPersonalBest) {
    xp += XP_CONFIG.NEW_PERSONAL_BEST;
  }

  return xp;
}

/**
 * Get the XP reward for a specific daily reward day (1-7 cycle).
 * @param {number} day — 1 to 7
 * @returns {number}
 */
export function getDailyRewardXP(day) {
  const key = `DAILY_REWARD_DAY_${day}`;
  return XP_CONFIG[key] || XP_CONFIG.DAILY_REWARD_DAY_1;
}

/**
 * Get a formatted display string for XP.
 * @param {number} xp
 * @returns {string}
 */
export function formatXP(xp) {
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return String(xp);
}

