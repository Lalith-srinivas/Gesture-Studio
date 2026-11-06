/**
 * DualHandDetector — Robust MediaPipe Dual-Hand Gesture Recognition
 * ────────────────────────────────────────────────────────────────────────────
 * Full Gesture Table:
 * | Gesture                      | Game Action              | Hand       |
 * | Open Palm ✋                 | Neutral / Stop           | Left       |
 * | Move Left                    | Move character left      | Left       |
 * | Move Right                   | Move character right     | Left       |
 * | Quick upward hand movement   | Jump                     | Left       |
 * | Pinch (thumb + index)        | Draw bowstring           | Right      |
 * | Release pinch                | Shoot arrow              | Right      |
 * | Move right hand up/down      | Adjust aiming angle      | Right      |
 * | Thumbs Up 👍                 | Activate special ability | Left       |
 * | Victory Sign ✌️              | Switch arrow type        | Left       |
 * | Closed Fist ✊               | Melee attack             | Left       |
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
    this.prevLeftWristY = null;
    this.prevRightWristY = null;
    this.prevWristY = null;
    this.wasDrawing = false;
    this.wasRightPinching = false;
    this.victoryCooldown = 0;
    this.specialCooldown = 0;
    this.jumpCooldown = 0;
    this.meleeCooldown = 0;
  }

  /**
   * Process landmarks for hands
   * @param {Array} multiHandLandmarks - array of 1 or 2 hand landmark arrays
   * @param {boolean} facingRight - player facing direction
   * @param {Array} [multiHandedness] - optional MediaPipe handedness array
   */
  process(multiHandLandmarks, facingRight = true, multiHandedness = null) {
    const result = {
      // Left Hand outputs
      leftHandDetected: false,
      leftGesture: 'Open Palm ✋',
      moveX: 0,
      jump: false,
      specialAbility: false,
      switchArrow: false,
      meleeAttack: false,

      // Right Hand outputs
      rightHandDetected: false,
      isDrawing: false,
      attackRelease: false,
      aimAngle: facingRight ? -0.2 : Math.PI + 0.2,
      rightHandY: 0.5,
      pinchDistance: 1.0,
    };

    if (this.victoryCooldown > 0) this.victoryCooldown--;
    if (this.specialCooldown > 0) this.specialCooldown--;
    if (this.jumpCooldown > 0) this.jumpCooldown--;
    if (this.meleeCooldown > 0) this.meleeCooldown--;

    if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
      this.prevLeftWristY = null;
      this.prevRightWristY = null;
      this.prevWristY = null;
      if (this.wasDrawing || this.wasRightPinching) {
        result.attackRelease = true;
        this.wasDrawing = false;
        this.wasRightPinching = false;
      }
      return result;
    }

    // Identify Left vs Right Hand
    let leftLm = null;
    let rightLm = null;

    if (multiHandLandmarks.length >= 2) {
      // Two hands detected
      // Check multiHandedness if available
      if (multiHandedness && multiHandedness.length >= 2) {
        // MediaPipe in selfie camera: label 'Right' is user's physical LEFT hand.
        const h0 = multiHandedness[0]?.label;
        if (h0 === 'Right') {
          leftLm = multiHandLandmarks[0];
          rightLm = multiHandLandmarks[1];
        } else {
          leftLm = multiHandLandmarks[1];
          rightLm = multiHandLandmarks[0];
        }
      } else {
        // Fallback: sort by X in mirrored camera view (smaller X = user's Left Hand)
        const sorted = [...multiHandLandmarks].sort((a, b) => a[0].x - b[0].x);
        leftLm = sorted[0];
        rightLm = sorted[1];
      }
    } else {
      // Exactly 1 hand detected
      const lm = multiHandLandmarks[0];
      const h0 = multiHandedness?.[0]?.label;

      if (h0 === 'Right') {
        leftLm = lm;
      } else if (h0 === 'Left') {
        rightLm = lm;
      } else {
        // By position: left half = Left Hand, right half = Right Hand
        if (lm[0].x < 0.5) {
          leftLm = lm;
        } else {
          rightLm = lm;
        }
      }

      // Single-hand versatility: If only 1 hand is visible, also detect pinch & release on it
      const pDist = dist(lm[4], lm[8]);
      if (pDist < 0.085) {
        result.rightHandDetected = true;
        result.isDrawing = true;
        this.wasDrawing = true;
        this.wasRightPinching = true;

        // Aim angle from vertical position
        const handY = (lm[4].y + lm[8].y) * 0.5;
        const clampedY = Math.max(0.15, Math.min(0.75, handY));
        const factor = (clampedY - 0.45) / 0.3;
        result.aimAngle = facingRight ? factor * 0.65 : Math.PI - factor * 0.65;
      } else if (this.wasDrawing || this.wasRightPinching) {
        result.attackRelease = true;
        this.wasDrawing = false;
        this.wasRightPinching = false;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. LEFT HAND: Open Palm, Move Left/Right, Jump, Thumbs Up, Victory, Fist
    // ─────────────────────────────────────────────────────────────────────────
    if (leftLm) {
      result.leftHandDetected = true;
      const wrist = leftLm[0];
      const indexExt = isFingerExtended(leftLm, 8, 6);
      const middleExt = isFingerExtended(leftLm, 12, 10);
      const ringExt = isFingerExtended(leftLm, 16, 14);
      const pinkyExt = isFingerExtended(leftLm, 20, 18);
      const extCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

      // Thumb upwards check for Thumbs Up 👍
      const thumbUp = leftLm[4].y < leftLm[3].y && leftLm[3].y < leftLm[2].y && leftLm[4].y < leftLm[8].y - 0.04;

      // A. Thumbs Up 👍 -> Activate special ability
      if (thumbUp && extCount <= 1) {
        result.leftGesture = 'Thumbs Up 👍';
        if (this.specialCooldown === 0) {
          result.specialAbility = true;
          this.specialCooldown = 25;
        }
      }
      // B. Victory Sign ✌️ -> Switch arrow type
      else if (indexExt && middleExt && !ringExt && !pinkyExt) {
        result.leftGesture = 'Victory Sign ✌️';
        if (this.victoryCooldown === 0) {
          result.switchArrow = true;
          this.victoryCooldown = 20;
        }
      }
      // C. Closed Fist ✊ -> Melee attack
      else if (extCount === 0) {
        result.leftGesture = 'Closed Fist ✊';
        if (this.meleeCooldown === 0) {
          result.meleeAttack = true;
          this.meleeCooldown = 15;
        }
      }
      // D. Open Palm ✋ & Horizontal Movement (Move Left / Move Right / Neutral)
      else {
        // Horizontal Movement based on Hand X position
        // In mirrored view: leftZoneCenter ~ 0.28
        const leftZoneCenterX = 0.28;
        const deltaX = wrist.x - leftZoneCenterX;

        if (deltaX < -0.055) {
          result.moveX = -1; // Move Left
          result.leftGesture = 'Move Left 👈';
        } else if (deltaX > 0.055) {
          result.moveX = 1; // Move Right
          result.leftGesture = 'Move Right 👉';
        } else {
          result.moveX = 0; // Neutral / Stop
          result.leftGesture = 'Open Palm ✋';
        }
      }

      // Quick Upward Hand Movement -> Jump
      if (this.prevLeftWristY !== null) {
        const dy = wrist.y - this.prevLeftWristY;
        // Fast upward movement or raised high above threshold
        if ((dy < -0.045 || wrist.y < 0.25) && this.jumpCooldown === 0) {
          result.jump = true;
          this.jumpCooldown = 18;
          result.leftGesture = 'Jump ⏫';
        }
      }
      this.prevLeftWristY = wrist.y;
    } else {
      this.prevLeftWristY = null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. RIGHT HAND: Pinch (Draw Bowstring), Release (Shoot), Up/Down (Aim Angle)
    // ─────────────────────────────────────────────────────────────────────────
    if (rightLm) {
      result.rightHandDetected = true;
      const thumbTip = rightLm[4];
      const indexTip = rightLm[8];

      // Pinch Distance (Thumb Tip to Index Tip)
      const pDist = dist(thumbTip, indexTip);
      result.pinchDistance = pDist;
      const isPinching = pDist < 0.088;

      if (isPinching) {
        result.isDrawing = true;
        this.wasRightPinching = true;
        this.wasDrawing = true;
      } else {
        if (this.wasRightPinching || this.wasDrawing) {
          // Exactly released pinch -> Shoot arrow!
          result.attackRelease = true;
          this.wasRightPinching = false;
          this.wasDrawing = false;
        }
        result.isDrawing = false;
      }

      // Aiming Angle (Up/Down Hand Position)
      const handY = (thumbTip.y + indexTip.y) * 0.5;
      result.rightHandY = handY;

      // Normalization: hand higher (y ~ 0.15) aims upward, lower (y ~ 0.75) aims downward
      const clampedY = Math.max(0.15, Math.min(0.75, handY));
      const factor = (clampedY - 0.45) / 0.3; // -1 to +1

      if (facingRight) {
        result.aimAngle = factor * 0.7; // negative points up-right, positive points down-right
      } else {
        result.aimAngle = Math.PI - (factor * 0.7); // points up-left or down-left
      }
    } else {
      if (this.wasRightPinching && !leftLm) {
        result.attackRelease = true;
        this.wasRightPinching = false;
        this.wasDrawing = false;
      }
    }

    return result;
  }
}
