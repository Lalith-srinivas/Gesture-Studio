/**
 * DualHandDetector — Right-Hand Dominant Motion & Gesture Control
 * ────────────────────────────────────────────────────────────────────────────
 * Right Hand Controls:
 * 1. Open Palm ✋:
 *    - Stand still / Neutral / STOP
 *    - Calibrates neutral anchor to user's resting hand position
 *
 * 2. Move Left / Move Right ↔️:
 *    - Move hand left from resting position or tilt hand left -> Move Left 👈
 *    - Move hand right from resting position or tilt hand right -> Move Right 👉
 *    - Centered / upright -> Neutral / STOP ✋
 *
 * 3. Jump ⏫:
 *    - Open Palm to Closed Fist ✊ -> Jump!
 *    - Closing all fingers leaps onto platforms without confusion with pinch
 *
 * 4. Archery (Aim & Shoot) 🏹:
 *    - Pinch (Thumb + Index) 🤏 -> Draw bowstring & charge power
 *    - Move hand up / down ↕️ -> Adjust aiming trajectory angle
 *    - Release pinch 🏹 -> Shoot arrow!
 *
 * 5. Switch Arrow ✌️:
 *    - Victory sign (index + middle) cycles arrow types
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
  return dist(wrist, lm[tipIdx]) > dist(wrist, lm[pipIdx]) * 1.10;
}

export class DualHandDetector {
  constructor() {
    this.wasOpenPalm = false;
    this.wasPinching = false;
    this.jumpCooldown = 0;
    this.shootCooldown = 0;
    this.arrowCycleCooldown = 0;
    this.neutralX = 0.65; // natural right-hand resting position
    this.hasNeutralCalibration = false;
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

    // Pick dominant hand (Right Hand preferred in selfie mirror)
    let dominantLm = multiHandLandmarks[0];

    if (multiHandLandmarks.length >= 2) {
      if (multiHandedness && multiHandedness.length >= 2) {
        // In selfie camera: MediaPipe label 'Left' corresponds to user's physical RIGHT hand
        const rightIdx = multiHandedness.findIndex((h) => h?.label === 'Left');
        if (rightIdx >= 0) dominantLm = multiHandLandmarks[rightIdx];
        else dominantLm = multiHandLandmarks[1];
      } else {
        // Mirrored camera: hand on the right side of the screen (smaller raw X)
        const sorted = [...multiHandLandmarks].sort((a, b) => a[0].x - b[0].x);
        dominantLm = sorted[0];
      }
    }

    const lm = dominantLm;
    const wrist = lm[0];
    const thumbTip = lm[4];
    const indexTip = lm[8];
    const palmCenter = lm[9];

    // Screen X (Mirrored selfie view: 0.0 = left of screen, 1.0 = right of screen)
    const rawX = (wrist.x + palmCenter.x) * 0.5;
    const screenX = 1.0 - rawX;

    // Tilt vector: positive leans right, negative leans left
    const tiltX = wrist.x - palmCenter.x;

    // Calculate finger extensions
    const indexExt = isFingerExtended(lm, 8, 6);
    const middleExt = isFingerExtended(lm, 12, 10);
    const ringExt = isFingerExtended(lm, 16, 14);
    const pinkyExt = isFingerExtended(lm, 20, 18);
    const extCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. GESTURE STATES & NORMALIZED DISTANCES
    // ─────────────────────────────────────────────────────────────────────────
    // Hand scale reference (wrist to middle knuckle) for distance normalization
    const handScale = Math.max(0.12, dist(wrist, palmCenter));

    // A Fist has 0 extended fingers
    const isFist = extCount === 0;

    // Open Palm has at least 3 extended fingers
    const isOpenPalm = extCount >= 3;

    // Pinch distance check (Thumb Tip to Index Tip)
    const pDist = dist(thumbTip, indexTip);
    const normalizedPinch = pDist / handScale;
    result.pinchDistance = pDist;

    // Archery Pinch requires thumb & index tips touching, but NEVER in an open palm or closed fist!
    const isPinching = normalizedPinch < 0.38 && !isOpenPalm && !isFist;

    // ─────────────────────────────────────────────────────────────────────────
    // 2. JUMP: Open Palm ✋ then Make Fist ✊ to Jump!
    // ─────────────────────────────────────────────────────────────────────────
    if (isOpenPalm) {
      this.wasOpenPalm = true;
      // Adapt neutral calibration baseline to user's natural resting hand position
      if (!this.hasNeutralCalibration) {
        this.neutralX = screenX;
        this.hasNeutralCalibration = true;
      } else {
        this.neutralX = this.neutralX * 0.92 + screenX * 0.08;
      }
    }

    if (isFist) {
      if (this.jumpCooldown === 0) {
        result.jump = true;
        this.jumpCooldown = 22; // debounce jump
        this.wasOpenPalm = false;
        result.gestureName = '✊ Fist (Jump!)';
        result.rightGesture = '✊ Fist (Jump!)';
      }
      result.moveX = 0; // maintain horizontal stability while leaping
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. ARCHERY: Pinch to Draw Bow, Adjust Aim Up/Down, Release to Shoot
    // ─────────────────────────────────────────────────────────────────────────
    // Calculate Aiming Angle based on hand Y position
    const handY = (thumbTip.y + indexTip.y) * 0.5;
    const clampedY = Math.max(0.12, Math.min(0.78, handY));
    const verticalFactor = (clampedY - 0.45) / 0.33; // -1 (aim high) to +1 (aim low)

    if (facingRight) {
      result.aimAngle = verticalFactor * 0.72; // negative points up-right, positive points down-right
    } else {
      result.aimAngle = Math.PI - (verticalFactor * 0.72); // points up-left
    }

    if (isPinching) {
      result.isDrawing = true;
      this.wasPinching = true;
      result.gestureName = '🤏 Pinch (Aiming Bow)';
      result.rightGesture = '🤏 Pinch (Aiming Bow)';
    } else {
      if (this.wasPinching && this.shootCooldown === 0) {
        result.attackRelease = true;
        this.wasPinching = false;
        this.shootCooldown = 8;
        result.gestureName = '🏹 Release (Shoot!)';
        result.rightGesture = '🏹 Release (Shoot!)';
      }
      result.isDrawing = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. MOVEMENT: Open Palm = Stop / Neutral, Move Left / Right = Move
    // ─────────────────────────────────────────────────────────────────────────
    if (!isFist && !isPinching) {
      const deltaX = screenX - this.neutralX;

      if (isOpenPalm) {
        // Open palm defaults to STOP / NEUTRAL unless deliberately moved/tilted far
        if (deltaX < -0.10 || tiltX < -0.09) {
          result.moveX = -1;
          result.gestureName = '👈 Move Left';
          result.rightGesture = '👈 Move Left';
        } else if (deltaX > 0.10 || tiltX > 0.09) {
          result.moveX = 1;
          result.gestureName = '👉 Move Right';
          result.rightGesture = '👉 Move Right';
        } else {
          result.moveX = 0; // STOP / NEUTRAL
          result.gestureName = '✋ Open Palm (Stop)';
          result.rightGesture = '✋ Open Palm (Stop)';
        }
      } else {
        // Pointing or semi-open hand moving left or right
        if (deltaX < -0.07 || tiltX < -0.07) {
          result.moveX = -1;
          result.gestureName = '👈 Move Left';
          result.rightGesture = '👈 Move Left';
        } else if (deltaX > 0.07 || tiltX > 0.07) {
          result.moveX = 1;
          result.gestureName = '👉 Move Right';
          result.rightGesture = '👉 Move Right';
        } else {
          result.moveX = 0;
          result.gestureName = '✋ Neutral (Stop)';
          result.rightGesture = '✋ Neutral (Stop)';
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. VICTORY SIGN ✌️: Cycle Arrow Types
    // ─────────────────────────────────────────────────────────────────────────
    if (indexExt && middleExt && !ringExt && !pinkyExt && !isPinching && !isFist) {
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
