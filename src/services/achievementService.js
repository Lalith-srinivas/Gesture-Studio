/**
 * Achievement Service
 * ───────────────────
 * Central registry of all platform-wide and game-specific achievements.
 * Edit ACHIEVEMENTS array to add/modify achievements.
 *
 * Achievement shape:
 * {
 *   id: string,         // unique identifier
 *   title: string,
 *   description: string,
 *   icon: string,       // emoji
 *   xp: number,         // XP reward on unlock
 *   category: 'platform' | 'game',
 *   gameId?: string,    // only for game-specific achievements
 *   check: (playerData, gameResult?) => boolean,
 *   progress?: (playerData) => { current: number, target: number },
 * }
 */

// ─── Achievement Definitions ──────────────────────────────────────────────────
export const ACHIEVEMENTS = [
  // ── Platform-Wide ─────────────────────────────────────────────────────────
  {
    id: 'first_game',
    title: 'First Game',
    description: 'Play your very first gesture game.',
    icon: '🎮',
    xp: 50,
    category: 'platform',
    check: (p) => (p?.totalGamesPlayed || 0) >= 1,
  },
  {
    id: 'games_10',
    title: 'Veteran',
    description: 'Play 10 games total.',
    icon: '🏅',
    xp: 100,
    category: 'platform',
    check: (p) => (p?.totalGamesPlayed || 0) >= 10,
    progress: (p) => ({ current: Math.min(p?.totalGamesPlayed || 0, 10), target: 10 }),
  },
  {
    id: 'games_50',
    title: 'Champion',
    description: 'Play 50 games total.',
    icon: '🏆',
    xp: 300,
    category: 'platform',
    check: (p) => (p?.totalGamesPlayed || 0) >= 50,
    progress: (p) => ({ current: Math.min(p?.totalGamesPlayed || 0, 50), target: 50 }),
  },
  {
    id: 'games_100',
    title: 'Legend',
    description: 'Play 100 games total.',
    icon: '👑',
    xp: 600,
    category: 'platform',
    check: (p) => (p?.totalGamesPlayed || 0) >= 100,
    progress: (p) => ({ current: Math.min(p?.totalGamesPlayed || 0, 100), target: 100 }),
  },
  {
    id: 'streak_3',
    title: '3-Day Warrior',
    description: 'Maintain a 3-day gameplay streak.',
    icon: '🔥',
    xp: 75,
    category: 'platform',
    check: (p) => (p?.currentGameStreak || 0) >= 3,
    progress: (p) => ({ current: Math.min(p?.currentGameStreak || 0, 3), target: 3 }),
  },
  {
    id: 'streak_7',
    title: '7-Day Warrior',
    description: 'Maintain a 7-day gameplay streak.',
    icon: '🔥',
    xp: 200,
    category: 'platform',
    check: (p) => (p?.currentGameStreak || 0) >= 7,
    progress: (p) => ({ current: Math.min(p?.currentGameStreak || 0, 7), target: 7 }),
  },
  {
    id: 'streak_30',
    title: 'Monthly Legend',
    description: 'Maintain a 30-day gameplay streak.',
    icon: '🔥',
    xp: 1000,
    category: 'platform',
    check: (p) => (p?.currentGameStreak || 0) >= 30,
    progress: (p) => ({ current: Math.min(p?.currentGameStreak || 0, 30), target: 30 }),
  },
  {
    id: 'level_5',
    title: 'Rising Star',
    description: 'Reach player level 5.',
    icon: '⭐',
    xp: 100,
    category: 'platform',
    check: (p) => (p?.level || 1) >= 5,
  },
  {
    id: 'level_10',
    title: 'Gesture Master Rank',
    description: 'Reach player level 10.',
    icon: '💫',
    xp: 250,
    category: 'platform',
    check: (p) => (p?.level || 1) >= 10,
  },
  {
    id: 'level_20',
    title: 'Legendary',
    description: 'Reach player level 20.',
    icon: '🌟',
    xp: 500,
    category: 'platform',
    check: (p) => (p?.level || 1) >= 20,
  },
  {
    id: 'score_hunter',
    title: 'Score Hunter',
    description: 'Accumulate 10,000 total score across all games.',
    icon: '🎯',
    xp: 300,
    category: 'platform',
    check: (p) => (p?.totalScore || 0) >= 10000,
    progress: (p) => ({ current: Math.min(p?.totalScore || 0, 10000), target: 10000 }),
  },
  {
    id: 'game_explorer',
    title: 'Game Explorer',
    description: 'Play every available game at least once.',
    icon: '🗺️',
    xp: 200,
    category: 'platform',
    check: (p) => {
      const games = p?.gamesPlayedByGame || {};
      const required = ['fruit-ninja', 'flappy-bird', 'archery', 'bird-hunter', 'hill-climb', 'air-draw'];
      return required.every((g) => games[g]);
    },
  },
  {
    id: 'gesture_master',
    title: 'Gesture Master',
    description: 'Complete the Gesture Academy.',
    icon: '🎓',
    xp: 200,
    category: 'platform',
    check: (p) => Boolean(p?.tutorialCompleted),
  },
  {
    id: 'daily_claim_first',
    title: 'Daily Devotee',
    description: 'Claim your first daily reward.',
    icon: '🎁',
    xp: 25,
    category: 'platform',
    check: (p) => (p?.dailyRewardDay || 0) >= 1,
  },

  // ── Fruit Ninja ────────────────────────────────────────────────────────────
  {
    id: 'fruit_ninja_first',
    title: 'First Slice',
    description: 'Play your first game of Fruit Ninja.',
    icon: '🍉',
    xp: 30,
    category: 'game',
    gameId: 'fruit-ninja',
    check: (p) => (p?.gamesPlayedByGame?.['fruit-ninja']),
  },
  {
    id: 'fruit_ninja_100',
    title: 'Fruit Ninja Sensei',
    description: 'Score 100 or more in Fruit Ninja.',
    icon: '🔪',
    xp: 75,
    category: 'game',
    gameId: 'fruit-ninja',
    check: (p, gr) => gr?.gameId === 'fruit-ninja' ? (gr?.score || 0) >= 100 : false,
  },
  {
    id: 'fruit_ninja_300',
    title: 'Fruit Master',
    description: 'Score 300 or more in Fruit Ninja.',
    icon: '🍍',
    xp: 150,
    category: 'game',
    gameId: 'fruit-ninja',
    check: (p, gr) => gr?.gameId === 'fruit-ninja' ? (gr?.score || 0) >= 300 : false,
  },

  // ── Flappy Bird ────────────────────────────────────────────────────────────
  {
    id: 'flappy_first',
    title: 'First Flap',
    description: 'Play your first game of Flappy Bird.',
    icon: '🐦',
    xp: 30,
    category: 'game',
    gameId: 'flappy-bird',
    check: (p) => (p?.gamesPlayedByGame?.['flappy-bird']),
  },
  {
    id: 'flappy_10',
    title: 'Pipe Dodger',
    description: 'Score 10 or more in Flappy Bird.',
    icon: '🌬️',
    xp: 75,
    category: 'game',
    gameId: 'flappy-bird',
    check: (p, gr) => gr?.gameId === 'flappy-bird' ? (gr?.score || 0) >= 10 : false,
  },
  {
    id: 'flappy_30',
    title: 'Flap Legend',
    description: 'Score 30 or more in Flappy Bird.',
    icon: '🦅',
    xp: 200,
    category: 'game',
    gameId: 'flappy-bird',
    check: (p, gr) => gr?.gameId === 'flappy-bird' ? (gr?.score || 0) >= 30 : false,
  },

  // ── Archery ────────────────────────────────────────────────────────────────
  {
    id: 'archery_first',
    title: 'First Arrow',
    description: 'Play your first game of Archery Challenge.',
    icon: '🏹',
    xp: 30,
    category: 'game',
    gameId: 'archery',
    check: (p) => (p?.gamesPlayedByGame?.['archery']),
  },
  {
    id: 'archery_50',
    title: 'Sharpshooter',
    description: 'Score 50 or more in Archery Challenge.',
    icon: '🎯',
    xp: 100,
    category: 'game',
    gameId: 'archery',
    check: (p, gr) => gr?.gameId === 'archery' ? (gr?.score || 0) >= 50 : false,
  },
  {
    id: 'archery_combo_5',
    title: 'Combo Archer',
    description: 'Get a 5x combo in Archery Challenge.',
    icon: '⚡',
    xp: 125,
    category: 'game',
    gameId: 'archery',
    check: (p, gr) => gr?.gameId === 'archery' ? (gr?.combo || 0) >= 5 : false,
  },
  {
    id: 'archery_100',
    title: "Bull's Eye Master",
    description: 'Score 100 or more in Archery Challenge.',
    icon: '🏆',
    xp: 200,
    category: 'game',
    gameId: 'archery',
    check: (p, gr) => gr?.gameId === 'archery' ? (gr?.score || 0) >= 100 : false,
  },

  // ── Bird Hunter ────────────────────────────────────────────────────────────
  {
    id: 'bird_hunter_first',
    title: 'First Hunt',
    description: 'Play your first game of Bird Hunter.',
    icon: '🦅',
    xp: 30,
    category: 'game',
    gameId: 'bird-hunter',
    check: (p) => (p?.gamesPlayedByGame?.['bird-hunter']),
  },
  {
    id: 'bird_hunter_50',
    title: 'Falconer',
    description: 'Score 50 or more in Bird Hunter.',
    icon: '🎯',
    xp: 100,
    category: 'game',
    gameId: 'bird-hunter',
    check: (p, gr) => gr?.gameId === 'bird-hunter' ? (gr?.score || 0) >= 50 : false,
  },
  {
    id: 'bird_hunter_200',
    title: 'Master Falconer',
    description: 'Score 200 or more in Bird Hunter.',
    icon: '👑',
    xp: 200,
    category: 'game',
    gameId: 'bird-hunter',
    check: (p, gr) => gr?.gameId === 'bird-hunter' ? (gr?.score || 0) >= 200 : false,
  },

  // ── Crazy Road ────────────────────────────────────────────────────────────
  {
    id: 'crazy_road_first',
    title: 'Road Warrior',
    description: 'Play your first game of Crazy Road.',
    icon: '🏎️',
    xp: 30,
    category: 'game',
    gameId: 'hill-climb',
    check: (p) => (p?.gamesPlayedByGame?.['hill-climb']),
  },
  {
    id: 'crazy_road_500',
    title: 'Speed Demon',
    description: 'Score 500 or more in Crazy Road.',
    icon: '🚀',
    xp: 150,
    category: 'game',
    gameId: 'hill-climb',
    check: (p, gr) => gr?.gameId === 'hill-climb' ? (gr?.score || 0) >= 500 : false,
  },

  // ── Air Draw ───────────────────────────────────────────────────────────────
  {
    id: 'air_draw_first',
    title: 'First Stroke',
    description: 'Create your first Air Draw masterpiece.',
    icon: '🎨',
    xp: 30,
    category: 'game',
    gameId: 'air-draw',
    check: (p) => (p?.gamesPlayedByGame?.['air-draw']),
  },
  {
    id: 'air_draw_10',
    title: 'Digital Artist',
    description: 'Complete 10 Air Draw sessions.',
    icon: '✏️',
    xp: 100,
    category: 'game',
    gameId: 'air-draw',
    check: (p) => {
      // Tracked via gameStats
      return false; // Resolved via gameStats subcollection in progressionService
    },
  },
];

/**
 * Get achievements for a specific game (or all if no gameId given).
 */
export function getAchievementsForGame(gameId) {
  if (!gameId) return ACHIEVEMENTS;
  return ACHIEVEMENTS.filter(
    (a) => a.category === 'platform' || a.gameId === gameId
  );
}

/**
 * Check which achievements should be unlocked based on player state + game result.
 * Returns only achievement IDs that are newly unlocked (not already in alreadyUnlocked).
 *
 * @param {object} playerData — full player profile from Firestore
 * @param {string[]} alreadyUnlocked — list of already unlocked achievement IDs
 * @param {object|null} gameResult — { gameId, score, combo, ... }
 * @returns {string[]} — IDs of newly unlocked achievements
 */
export function checkNewAchievements(playerData, alreadyUnlocked = [], gameResult = null) {
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    if (alreadyUnlocked.includes(ach.id)) continue;
    try {
      if (ach.check(playerData, gameResult)) {
        newlyUnlocked.push(ach.id);
      }
    } catch {
      // Silent fail — don't crash if check fails
    }
  }

  return newlyUnlocked;
}

/**
 * Get a single achievement definition by ID.
 */
export function getAchievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}

/**
 * Get measurable progress for an achievement (if it has a progress fn).
 * @returns {{ current: number, target: number, percent: number } | null}
 */
export function getAchievementProgress(achievementId, playerData) {
  const ach = getAchievementById(achievementId);
  if (!ach || !ach.progress) return null;
  const { current, target } = ach.progress(playerData);
  return {
    current,
    target,
    percent: Math.min(100, Math.round((current / target) * 100)),
  };
}

