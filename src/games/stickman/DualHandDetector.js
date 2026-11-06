/**
 * DualHandDetector — Real-time MediaPipe Dual-Hand Gesture Recognition
 * ────────────────────────────────────────────────────────────────────────────
 * Left Hand:
 *   ✋ Open Palm (Neutral / Stop)
 *   Move Left / Move Right (Horizontal position)
 *   Quick Upward Motion (Jump)
 *   👍 Thumbs Up (Special Ability)
 *   ✌️ Victory Sign (Switch Arrow Type)
 *   ✊ Closed Fist (Melee Attack)
 *
 * Right Hand:
 *   🤏 Pinch (thumb + index) -> Draw bowstring
 *   Release pinch -> Shoot arrow
 *   Move Up / Down -> Adjust aiming angle
 */

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function isFingerExtended(lm, tipIdx, pipIdx) {
  const wrist = lm[0];
  return dist(wrist, lm[tipIdx]) > dist(wrist, lm[pipIdx]) * 1.12;
}

export class DualHandDetector {
  constructor() {
    this.prevLeftWristY = null;
    this.prevRightWristY = null;
    this.wasRightPinching = false;
    this.victoryCooldown = 0;
    this.specialCooldown = 0;
    this.jumpCooldown = 0;
  }

  /**
   * Process landmarks for both hands
   * @param {Array} multiHandLandmarks - array of 1 or 2 hand landmark arrays
   * @param {boolean} facingRight - player facing direction
   */
  process(multiHandLandmarks, facingRight = true) {
    const result = {
      // Left Hand outputs
      leftHandDetected: false,
      leftGesture: 'NONE',
      moveX: 0,
      jump: false,
      specialAbility: false,
      switchArrow: false,
      meleeAttack: false,

      // Right Hand outputs
      rightHandDetected: false,
      isDrawing: false,
      attackRelease: false,
      aimAngle: facingRight ? -0.15 : Math.PI + 0.15,
      rightHandY: 0.5,
      pinchDistance: 1.0,
    };

    if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
      this.prevLeftWristY = null;
      this.prevRightWristY = null;
      if (this.wasRightPinching) {
        result.attackRelease = true;
        this.wasRightPinching = false;
      }
      return result;
    }

    if (this.victoryCooldown > 0) this.victoryCooldown--;
    if (this.specialCooldown > 0) this.specialCooldown--;
    if (this.jumpCooldown > 0) this.jumpCooldown--;

    // Distinguish Left and Right hands.
    // In mirrored webcam view, the hand with smaller X is on the user's left side.
    let leftLm = null;
    let rightLm = null;

    if (multiHandLandmarks.length === 1) {
      const lm = multiHandLandmarks[0];
      // If hand is on left half of screen, treat as Left Hand; else Right Hand
      if (lm[0].x < 0.5) {
        leftLm = lm;
      } else {
        rightLm = lm;
      }
    } else {
      // Two hands: sort by X
      const sorted = [...multiHandLandmarks].sort((a, b) => a[0].x - b[0].x);
      leftLm = sorted[0];
      rightLm = sorted[1];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. LEFT HAND PROCESSING (Movement, Jump, Special, Switch Arrow, Melee)
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
      const thumbUp = leftLm[4].y < leftLm[3].y && leftLm[3].y < leftLm[2].y && leftLm[4].y < leftLm[8].y;

      // A. Thumbs Up 👍: Thumb up, 4 other fingers closed
      if (thumbUp && extCount === 0) {
        result.leftGesture = 'THUMBS_UP';
        if (this.specialCooldown === 0) {
          result.specialAbility = true;
          this.specialCooldown = 30; // 0.5s cooldown
        }
      }
      // B. Victory Sign ✌️: Index + Middle up, Ring + Pinky closed
      else if (indexExt && middleExt && !ringExt && !pinkyExt) {
        result.leftGesture = 'VICTORY';
        if (this.victoryCooldown === 0) {
          result.switchArrow = true;
          this.victoryCooldown = 25; // debounce arrow toggle
        }
      }
      // C. Closed Fist ✊: All fingers curled
      else if (extCount === 0) {
        result.leftGesture = 'FIST';
        result.meleeAttack = true;
      }
      // D. Open Palm ✋ / Neutral / Move Left / Move Right
      else {
        result.leftGesture = 'OPEN_PALM';

        // Horizontal Movement based on Hand X relative to left-side zone (center ~0.26)
        const leftZoneCenterX = 0.28;
        const deltaX = wrist.x - leftZoneCenterX;

        if (deltaX < -0.065) {
          result.moveX = -1; // Move Left
        } else if (deltaX > 0.065) {
          result.moveX = 1; // Move Right
        } else {
          result.moveX = 0; // Neutral / Stop
        }
      }

      // Upward motion detection for Jump
      if (this.prevLeftWristY !== null) {
        const dy = wrist.y - this.prevLeftWristY;
        // Fast upward flick or held in high jump zone (y < 0.28)
        if ((dy < -0.055 || wrist.y < 0.26) && this.jumpCooldown === 0) {
          result.jump = true;
          this.jumpCooldown = 20;
        }
      }
      this.prevLeftWristY = wrist.y;
    } else {
      this.prevLeftWristY = null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. RIGHT HAND PROCESSING (Aim Angle, Pinch Draw, Release Shoot)
    // ─────────────────────────────────────────────────────────────────────────
    if (rightLm) {
      result.rightHandDetected = true;
      const thumbTip = rightLm[4];
      const indexTip = rightLm[8];
      const wrist = rightLm[0];

      // Pinch check (Thumb tip to Index tip distance)
      const pDist = dist(thumbTip, indexTip);
      result.pinchDistance = pDist;
      const isPinching = pDist < 0.082;

      if (isPinching) {
        result.isDrawing = true;
        this.wasRightPinching = true;
      } else {
        if (this.wasRightPinching) {
          // Exactly released pinch -> Shoot arrow!
          result.attackRelease = true;
          this.wasRightPinching = false;
        }
        result.isDrawing = false;
      }

      // Vertical Aiming Angle (Up/Down)
      // Mirror-friendly Y mapping: hand higher up (smaller y) raises angle into sky
      const handY = (thumbTip.y + indexTip.y) * 0.5;
      result.rightHandY = handY;

      // Normalize Y from [0.15 (high) .. 0.75 (low)] -> tilt [-0.75 rad .. +0.4 rad]
      const clampedY = Math.max(0.15, Math.min(0.75, handY));
      const factor = (clampedY - 0.45) / 0.3; // -1 (high up) to +1 (low)

      if (facingRight) {
        result.aimAngle = factor * 0.65; // negative points up-right, positive points down-right
      } else {
        result.aimAngle = Math.PI - (factor * 0.65); // points up-left or down-left
      }
    } else {
      if (this.wasRightPinching) {
        result.attackRelease = true;
        this.wasRightPinching = false;
      }
    }

    return result;
  }
}

