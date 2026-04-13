/**
 * Gesture Detection Utility
 * Analyzes 21 MediaPipe hand landmarks to detect user gestures.
 *
 * Landmark indices reference:
 *  0 = wrist
 *  4 = thumb tip
 *  5,6,7,8 = index (MCP, PIP, DIP, tip)
 *  9,10,11,12 = middle
 *  13,14,15,16 = ring
 *  17,18,19,20 = pinky
 */

export const GESTURES = {
  DRAW: 'DRAW',     // ☝️ index only
  ERASE: 'ERASE',   // ✌️ index + middle
  PAN: 'PAN',       // ✊ closed fist
  STOP: 'STOP',     // ✋ open hand
  PINCH: 'PINCH',   // 🤏 thumb + index
  NONE: 'NONE',
};

/**
 * Returns true if a finger tip is extended.
 * Uses Euclidean distance from the wrist (lm[0]) to make it rotation-invariant.
 * If the distance from wrist to tip is greater than wrist to PIP joint, it is extended.
 * @param {Array} lm - landmark array [{x, y, z}, ...]
 * @param {number} tipIdx - landmark index for finger tip
 * @param {number} pipIdx - landmark index for PIP joint
 */
function isFingerExtended(lm, tipIdx, pipIdx) {
  const wrist = lm[0];
  return landmarkDistance(wrist, lm[tipIdx]) > landmarkDistance(wrist, lm[pipIdx]);
}

/**
 * Calculates euclidean distance between two landmarks (x, y only).
 */
function landmarkDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Returns true if thumb and index tips are close together.
 */
function isPinch(lm) {
  return landmarkDistance(lm[4], lm[8]) < 0.045;
}

/**
 * Returns a normalized rotation value from -1 (left tilt) to 1 (right tilt).
 * Uses the horizontal offset between wrist (0) and Middle MCP (9).
 */
export function getHandRotation(landmarks) {
  if (!landmarks || landmarks.length < 21) return 0;
  // Sensitivity factor: how much offset equals a full 1.0 tilt
  const SENSITIVITY = 0.18;
  const dx = landmarks[9].x - landmarks[0].x;
  // Clamp and normalize
  return Math.max(-1, Math.min(1, dx / SENSITIVITY));
}

/**
 * Main gesture detector.
 * @param {Array} landmarks - array of 21 {x, y, z} normalized landmarks
 * @returns {string} one of GESTURES values
 */
export function detectGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) return GESTURES.NONE;

  const lm = landmarks;

  // Finger extended checks (tip vs PIP joint) rotation invariant
  const indexExtended  = isFingerExtended(lm, 8, 6);
  const middleExtended = isFingerExtended(lm, 12, 10);
  const ringExtended   = isFingerExtended(lm, 16, 14);
  const pinkyExtended  = isFingerExtended(lm, 20, 18);

  const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended]
    .filter(Boolean).length;

  // 1. Pinch Detection (High priority for specific interactions)
  if (isPinch(lm)) {
    return GESTURES.PINCH;
  }

  // 2. Open hand: most fingers extended
  if (extendedCount >= 3) {
    return GESTURES.STOP;
  }

  // 3. Two fingers: index + middle up
  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return GESTURES.ERASE;
  }

  // 4. One finger: index only
  if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return GESTURES.DRAW;
  }

  // 5. Closed fist: no fingers extended
  if (extendedCount === 0) {
    return GESTURES.PAN;
  }

  return GESTURES.NONE;
}

/**
 * Returns a human-friendly label and emoji for each gesture mode.
 */
export function getGestureLabel(gesture) {
  const labels = {
    [GESTURES.DRAW]:  { emoji: '☝️',  label: 'Draw',  color: 'text-violet-400' },
    [GESTURES.ERASE]: { emoji: '✌️',  label: 'Erase', color: 'text-sky-400'    },
    [GESTURES.PAN]:   { emoji: '✊',  label: 'Pan',   color: 'text-amber-400'  },
    [GESTURES.STOP]:  { emoji: '✋',  label: 'Stop',  color: 'text-rose-400'   },
    [GESTURES.PINCH]: { emoji: '🤏',  label: 'Pinch', color: 'text-emerald-400' },
    [GESTURES.NONE]:  { emoji: '—',   label: 'None',  color: 'text-zinc-500'   },
  };
  return labels[gesture] ?? labels[GESTURES.NONE];
}
