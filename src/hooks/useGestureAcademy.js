/**
 * useGestureAcademy
 * Manages tutorial progress and settings via localStorage.
 * No re-renders on change — callers read values synchronously from storage.
 *
 * localStorage keys:
 *   gesture_academy_global_completed  → "true" when full academy finished
 *   gesture_tutorial_<gameName>       → "true" per game
 *   gesture_settings_show_guide       → "false" to hide in-game overlay
 *   gesture_settings_dont_show        → "true" to skip tutorial for every game
 *   gesture_settings_show_tips        → "false" to hide gesture tips
 */

import { useCallback } from 'react';

const GAME_NAMES = [
  'fruit-ninja',
  'hill-climb',
  'flappy-bird',
  'archery',
  'bird-hunter',
];

export const GESTURE_KEYS = {
  global:      'gesture_academy_global_completed',
  game:        (name) => `gesture_tutorial_${name}`,
  showGuide:   'gesture_settings_show_guide',
  dontShow:    'gesture_settings_dont_show',
  showTips:    'gesture_settings_show_tips',
};

export function useGestureAcademy(gameName) {
  // ── Read state from localStorage (sync) ──────────────────────────────────
  const isGlobalDone = localStorage.getItem(GESTURE_KEYS.global) === 'true';
  const isGameDone   = gameName
    ? localStorage.getItem(GESTURE_KEYS.game(gameName)) === 'true'
    : false;

  // ── Actions ───────────────────────────────────────────────────────────────
  /**
   * Mark a specific game's tutorial as complete.
   * Only affects the given game.
   */
  const completeGame = useCallback((name) => {
    const g = name || gameName;
    if (g) {
      localStorage.setItem(GESTURE_KEYS.game(g), 'true');
    }
  }, [gameName]);

  /**
   * Mark the full academy as globally complete.
   * Does NOT auto-complete individual game tutorials, ensuring each game
   * still teaches its specific controls when first launched.
   */
  const completeGlobal = useCallback(() => {
    localStorage.setItem(GESTURE_KEYS.global, 'true');
  }, []);

  /**
   * Reset all tutorial progress (called from Settings).
   */
  const resetAll = useCallback(() => {
    localStorage.removeItem(GESTURE_KEYS.global);
    GAME_NAMES.forEach((n) => localStorage.removeItem(GESTURE_KEYS.game(n)));
    localStorage.removeItem(GESTURE_KEYS.dontShow);
  }, []);

  // ── Settings (read + setters) ─────────────────────────────────────────────
  const settings = {
    showGuide: localStorage.getItem(GESTURE_KEYS.showGuide) !== 'false',  // default ON
    dontShow:  localStorage.getItem(GESTURE_KEYS.dontShow)  === 'true',   // default OFF
    showTips:  localStorage.getItem(GESTURE_KEYS.showTips)  !== 'false',  // default ON

    setShowGuide: (v) => localStorage.setItem(GESTURE_KEYS.showGuide, String(v)),
    setDontShow:  (v) => {
      if (v) localStorage.setItem(GESTURE_KEYS.dontShow, 'true');
      else   localStorage.removeItem(GESTURE_KEYS.dontShow);
    },
    setShowTips: (v) => localStorage.setItem(GESTURE_KEYS.showTips, String(v)),
  };

  return {
    isGlobalDone,
    isGameDone,
    completeGame,
    completeGlobal,
    resetAll,
    settings,
    GAME_NAMES,
  };
}

