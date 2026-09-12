/**
 * Gesture Academy & Tutorial Storage Service
 * Handles persistence for Gesture Academy, per-game tutorial completion,
 * and user settings with local cache and cloud synchronization.
 */

const STORAGE_KEYS = {
  GLOBAL_ACADEMY_COMPLETED: 'gesture_academy_completed',
  GAME_TUTORIAL_PREFIX: 'gesture_tutorial_game_',
  SETTINGS: 'gesture_studio_settings',
  ACADEMY_VERSION: 'gesture_academy_version',
  ACADEMY_CERTIFICATE: 'gesture_academy_certificate'
};

export const CURRENT_ACADEMY_VERSION = 1;

export const DEFAULT_SETTINGS = {
  showGestureGuideInGame: true,
  enableGestureTips: true,
  dontShowAgain: false,
  soundEffects: true
};

/**
 * Checks if the global Gesture Academy has been completed.
 */
export function isGlobalAcademyCompleted() {
  try {
    return localStorage.getItem(STORAGE_KEYS.GLOBAL_ACADEMY_COMPLETED) === 'true';
  } catch {
    return false;
  }
}

/**
 * Marks global Gesture Academy as completed.
 */
export function setGlobalAcademyCompleted() {
  try {
    localStorage.setItem(STORAGE_KEYS.GLOBAL_ACADEMY_COMPLETED, 'true');
    localStorage.setItem(STORAGE_KEYS.ACADEMY_VERSION, String(CURRENT_ACADEMY_VERSION));
    localStorage.setItem(STORAGE_KEYS.ACADEMY_CERTIFICATE, new Date().toISOString());
  } catch (e) {
    console.warn('[Storage] Error saving academy completion:', e);
  }
}

/**
 * Checks if a specific game tutorial has been completed.
 * @param {string} gameKey - e.g. 'fruit-ninja', 'flappy-bird', 'archery', etc.
 */
export function isGameTutorialCompleted(gameKey) {
  try {
    // If user turned on "Don't show tutorials again", treat as completed
    const settings = getGestureSettings();
    if (settings.dontShowAgain) return true;

    return localStorage.getItem(`${STORAGE_KEYS.GAME_TUTORIAL_PREFIX}${gameKey}`) === 'true';
  } catch {
    return false;
  }
}

/**
 * Marks a game tutorial as completed.
 * @param {string} gameKey
 */
export function setGameTutorialCompleted(gameKey) {
  try {
    localStorage.setItem(`${STORAGE_KEYS.GAME_TUTORIAL_PREFIX}${gameKey}`, 'true');
  } catch (e) {
    console.warn('[Storage] Error saving game tutorial:', e);
  }
}

/**
 * Resets all tutorial progress (both global and per-game).
 */
export function resetAllTutorials() {
  try {
    localStorage.removeItem(STORAGE_KEYS.GLOBAL_ACADEMY_COMPLETED);
    localStorage.removeItem(STORAGE_KEYS.ACADEMY_CERTIFICATE);
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(STORAGE_KEYS.GAME_TUTORIAL_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
    return true;
  } catch (e) {
    console.warn('[Storage] Error resetting tutorials:', e);
    return false;
  }
}

/**
 * Reads user gesture & tutorial settings.
 */
export function getGestureSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Updates user gesture & tutorial settings.
 */
export function updateGestureSettings(newSettings) {
  try {
    const current = getGestureSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('[Storage] Error saving settings:', e);
    return DEFAULT_SETTINGS;
  }
}
