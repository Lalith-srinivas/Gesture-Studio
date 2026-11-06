/**
 * DualHandDetector — Right-Hand Dominant Motion & Gesture Control
 * ────────────────────────────────────────────────────────────────────────────
 * Right Hand Controls:
 * 1. Move Left / Move Right:
 *    - Move hand left of center -> Move Left 👈
 *    - Move hand right of center -> Move Right 👉
 *    - Centered -> Stop / Neutral ✋
 *
 * 2. Jump:
 *    - Open Palm to Closed Fist ✊ -> Jump ⏫
 *    - Making a quick fist leaps onto sky platforms
 *
 * 3. Archery (Aim & Shoot):
 *    - Pinch (Thumb + Index) 🤏 -> Draw bowstring & charge power
 *    - Move hand up / down ↕️ -> Adjust aiming trajectory angle
 *    - Release pinch 🏹 -> Shoot arrow!
 * ────────────────────────────────────────────────────────────────────────────
 */

function dist(a, b) {
  if (!a || !b) return 1.0;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function isFingerExtended(lm, tipIdx, pipIdx) {
  const wrist = lm[0];
  return dist(wrist, lm[tipIdx]) > dist(wrist, lm[pipIdx]) * 1.08;
}

export class DualHandDetector {
  constructor() {
    this.wasOpenPalm = false;
    this.wasPinching = false;
    this.jumpCooldown = 0;
    this.shootCooldown = 0;
    this.arrowCycleCooldown = 0;
    this.lastHandX = 0.5;
  }

  /**
   * Process landmarks for right-hand dominant control
   * @param {Array} multiHandLandmarks - array of detected hand landmark arrays
   * @param {boolean} facingRight - player facing direction
   * @param {Array} [multiHandedness] - MediaPipe handedness array
   */
  process(multiHandLandmarks, facingRight = true, multiHandedness = null) {
    const result = {
      handDetected: false,
      leftHandDetected: false,
      rightHandDetected: false,
      gestureName: 'Searching for hand...',
      leftGesture: 'Neutral ✋',
      rightGesture: 'Neutral ✋',

      // Movement & Jump
      moveX: 0,
      jump: false,

      // Archery
      isDrawing: false,
      attackRelease: false,
      aimAngle: facingRight ? -0.2 : Math.PI + 0.2,

      // Powers & Tactics
      specialAbility: false,
      switchArrow: false,
      meleeAttack: false,
      pinchDistance: 1.0,
    };

    if (this.jumpCooldown > 0) this.jumpCooldown--;
    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.arrowCycleCooldown > 0) this.arrowCycleCooldown--;

    if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
      if (this.wasPinching) {
        result.attackRelease = true;
        this.wasPinching = false;
      }
      this.wasOpenPalm = false;
      return result;
    }

    result.handDetected = true;
    result.rightHandDetected = true;

    // Pick dominant hand (Right Hand preferred, or first available hand)
    let dominantLm = multiHandLandmarks[0];

    if (multiHandLandmarks.length >= 2) {
      if (multiHandedness && multiHandedness.length >= 2) {
        // In selfie camera: MediaPipe label 'Left' corresponds to user's physical RIGHT hand
        const rightIdx = multiHandedness.findIndex((h) => h?.label === 'Left');
        if (rightIdx >= 0) dominantLm = multiHandLandmarks[rightIdx];
        else dominantLm = multiHandLandmarks[1];
      } else {
        // Mirrored camera: hand on the right side of the screen (larger X)
        const sorted = [...multiHandLandmarks].sort((a, b) => b[0].x - a[0].x);
        dominantLm = sorted[0];
      }
    }

    const lm = dominantLm;
    const wrist = lm[0];
    const thumbTip = lm[4];
    const indexTip = lm[8];

    // Calculate finger extensions
    const indexExt = isFingerExtended(lm, 8, 6);
    const middleExt = isFingerExtended(lm, 12, 10);
    const ringExt = isFingerExtended(lm, 16, 14);
    const pinkyExt = isFingerExtended(lm, 20, 18);
    const extCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

    // Pinch distance check (Thumb Tip to Index Tip)
    const pDist = dist(thumbTip, indexTip);
    result.pinchDistance = pDist;
    const isPinching = pDist < 0.088;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. ARCHERY: Pinch to Draw Bow, Adjust Aim Up/Down, Release to Shoot
    // ─────────────────────────────────────────────────────────────────────────
    // Calculate Aiming Angle based on hand Y position
    const handY = (thumbTip.y + indexTip.y) * 0.5;
    const clampedY = Math.max(0.12, Math.min(0.78, handY));
    const verticalFactor = (clampedY - 0.45) / 0.33; // -1 (aim high up) to +1 (aim low)

    if (facingRight) {
      result.aimAngle = verticalFactor * 0.72; // negative points up-right, positive points down-right
    } else {
      result.aimAngle = Math.PI - (verticalFactor * 0.72); // points up-left
    }

    if (isPinching) {
      result.isDrawing = true;
      this.wasPinching = true;
      result.gestureName = '🤏 Pinch (Drawing Bow)';
      result.rightGesture = '🤏 Pinch (Drawing Bow)';
    } else {
      if (this.wasPinching && this.shootCooldown === 0) {
        // Release Pinch -> Fire Arrow!
        result.attackRelease = true;
        this.wasPinching = false;
        this.shootCooldown = 6;
        result.gestureName = '🏹 Release (Arrow Shot!)';
        result.rightGesture = '🏹 Release (Arrow Shot!)';
      }
      result.isDrawing = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. JUMP: Open Palm ✋ and then Make Fist ✊ to Jump!
    // ─────────────────────────────────────────────────────────────────────────
    const isOpenPalm = extCount >= 3;
    const isFist = extCount === 0 && !isPinching;

    if (isOpenPalm) {
      this.wasOpenPalm = true;
    }

    if (isFist) {
      // Transition from Open Palm to Fist, or direct Fist gesture
      if (this.wasOpenPalm && this.jumpCooldown === 0) {
        result.jump = true;
        this.jumpCooldown = 20; // debounce jump
        this.wasOpenPalm = false;
        result.gestureName = '✊ Fist (Jump!)';
        result.rightGesture = '✊ Fist (Jump!)';
      } else if (this.jumpCooldown === 0) {
        result.jump = true;
        this.jumpCooldown = 20;
        result.gestureName = '✊ Fist (Jump!)';
        result.rightGesture = '✊ Fist (Jump!)';
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. MOVEMENT: Move Left / Move Right using Right Hand X Position
    // ─────────────────────────────────────────────────────────────────────────
    // In mirrored selfie camera view:
    // Screen X = 1.0 - rawX (so what user sees in mirror directly matches direction)
    // User moves hand to their left (screen left, screenX < 0.40) -> Move Left
    // User moves hand to their right (screen right, screenX > 0.60) -> Move Right
    // Center deadzone between 0.40 and 0.60 -> Neutral / Stop
    const rawX = (lm[0].x + lm[9].x) * 0.5;
    const screenX = 1.0 - rawX;
    this.lastHandX = screenX;

    if (!isFist) {
      if (screenX < 0.40) {
        result.moveX = -1; // Move Left
        if (!isPinching) {
          result.gestureName = '👈 Move Left';
          result.rightGesture = '👈 Move Left';
        }
      } else if (screenX > 0.60) {
        result.moveX = 1; // Move Right
        if (!isPinching) {
          result.gestureName = '👉 Move Right';
          result.rightGesture = '👉 Move Right';
        }
      } else {
        result.moveX = 0; // Neutral / Stop
        if (!isPinching && isOpenPalm) {
          result.gestureName = '✋ Open Palm (Neutral)';
          result.rightGesture = '✋ Open Palm (Neutral)';
        }
      }
    }

    // Victory sign ✌️ check for cycling arrows
    if (indexExt && middleExt && !ringExt && !pinkyExt && !isPinching) {
      if (this.arrowCycleCooldown === 0) {
        result.switchArrow = true;
        this.arrowCycleCooldown = 25;
        result.gestureName = '✌️ Victory (Switch Arrow)';
        result.rightGesture = '✌️ Victory (Switch Arrow)';
      }
    }

    // Mirror statuses
    result.leftGesture = result.gestureName;

    return result;
  }
}
