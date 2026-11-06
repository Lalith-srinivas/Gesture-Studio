/**
 * InputProviders — Unified Controller Architecture for Stickman Showdown
 * Supports Keyboard, Mouse, Mobile Multi-Touch Controls, and AI Hand Gestures simultaneously.
 */

export class BaseInputProvider {
  getState() {
    return {
      moveX: 0,             // -1 (left), 0 (none), 1 (right)
      jump: false,          // true when jump pressed
      aimAngle: 0,          // radians pointing from player to crosshair
      isDrawing: false,     // true while holding down attack/bowstring
      attackRelease: false, // true on the exact frame attack is released
      meleeAttack: false,   // true for quick melee attack
      weaponIndex: 0,
      arrowTypeIndex: 0,
      specialAbility: false,
    };
  }

  destroy() {}
}

export class KeyboardMouseInputProvider extends BaseInputProvider {
  constructor(canvasElement) {
    super();
    this.canvas = canvasElement;
    this.keys = {};
    this.mouse = {
      x: 300,
      y: 250,
      isDown: false,
      justReleased: false,
    };

    this.playerScreenPos = { x: 120, y: 358 };

    // Mobile Virtual Touch Controls state
    this.virtualMoveX = 0;
    this.virtualJump = false;

    // Track touch identifier specifically used for aiming on mobile
    this.aimTouchId = null;

    // AI Hand Gesture inputs
    this.gestureState = {
      moveX: 0,
      jump: false,
      aimAngle: null,
      isDrawing: false,
      attackRelease: false,
      specialAbility: false,
      switchArrow: false,
      meleeAttack: false,
    };

    this.requestedWeapon = null;
    this.requestedArrow = null;
    this.specialRequested = false;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    if (this.canvas) {
      this.canvas.addEventListener('mousemove', this.onMouseMove);
      this.canvas.addEventListener('mousedown', this.onMouseDown);
      window.addEventListener('mouseup', this.onMouseUp);

      // Dedicated Touch listeners on canvas
      this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
      this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
      this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
      this.canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
    }
  }

  setPlayerScreenPos(x, y) {
    this.playerScreenPos.x = x;
    this.playerScreenPos.y = y;
  }

  setVirtualMove(dir) {
    this.virtualMoveX = dir;
  }

  triggerVirtualJump() {
    this.virtualJump = true;
  }

  setGestureState(gestures) {
    if (!gestures) return;
    this.gestureState = {
      ...this.gestureState,
      ...gestures,
    };
  }

  onKeyDown(e) {
    this.keys[e.key.toLowerCase()] = true;
    this.keys[e.code] = true;

    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      this.requestedWeapon = parseInt(e.key, 10) - 1;
    }

    if (e.key.toLowerCase() === 'q') {
      this.specialRequested = true;
    }
  }

  onKeyUp(e) {
    this.keys[e.key.toLowerCase()] = false;
    this.keys[e.code] = false;
  }

  onMouseMove(e) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const canvasRatio = 960 / 540;
    const elemRatio = rect.width / rect.height;
    let actualW = rect.width;
    let actualH = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (elemRatio > canvasRatio) {
      actualW = rect.height * canvasRatio;
      offsetX = (rect.width - actualW) / 2;
    } else {
      actualH = rect.width / canvasRatio;
      offsetY = (rect.height - actualH) / 2;
    }

    const relX = (e.clientX - (rect.left + offsetX)) / actualW;
    const relY = (e.clientY - (rect.top + offsetY)) / actualH;

    this.mouse.x = Math.max(0, Math.min(960, relX * 960));
    this.mouse.y = Math.max(0, Math.min(540, relY * 540));
  }

  onMouseDown(e) {
    if (e.button === 0) {
      this.mouse.isDown = true;
      this.mouse.justReleased = false;
    }
  }

  onMouseUp(e) {
    if (e.button === 0) {
      if (this.mouse.isDown) {
        this.mouse.justReleased = true;
      }
      this.mouse.isDown = false;
    }
  }

  updateAimTouch(touch) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const canvasRatio = 960 / 540;
    const elemRatio = rect.width / rect.height;
    let actualW = rect.width;
    let actualH = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (elemRatio > canvasRatio) {
      actualW = rect.height * canvasRatio;
      offsetX = (rect.width - actualW) / 2;
    } else {
      actualH = rect.width / canvasRatio;
      offsetY = (rect.height - actualH) / 2;
    }

    const relX = (touch.clientX - (rect.left + offsetX)) / actualW;
    const relY = (touch.clientY - (rect.top + offsetY)) / actualH;

    this.mouse.x = Math.max(0, Math.min(960, relX * 960));
    this.mouse.y = Math.max(0, Math.min(540, relY * 540));
  }

  onTouchStart(e) {
    if (e.changedTouches && e.changedTouches.length > 0) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (this.aimTouchId === null) {
          this.aimTouchId = touch.identifier;
          this.updateAimTouch(touch);
          this.mouse.isDown = true;
          this.mouse.justReleased = false;
          break;
        }
      }
    }
  }

  onTouchMove(e) {
    if (e.changedTouches && e.changedTouches.length > 0 && this.aimTouchId !== null) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.aimTouchId) {
          this.updateAimTouch(touch);
          break;
        }
      }
    }
  }

  onTouchEnd(e) {
    if (e.changedTouches && this.aimTouchId !== null) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.aimTouchId) {
          this.aimTouchId = null;
          if (this.mouse.isDown) {
            this.mouse.justReleased = true;
          }
          this.mouse.isDown = false;
          break;
        }
      }
    }
  }

  triggerTouchDraw() {
    this.mouse.isDown = true;
    this.mouse.justReleased = false;
  }

  triggerTouchRelease() {
    if (this.mouse.isDown) {
      this.mouse.justReleased = true;
    }
    this.mouse.isDown = false;
  }

  selectArrowType(idx) {
    this.requestedArrow = idx;
  }

  selectWeapon(idx) {
    this.requestedWeapon = idx;
  }

  getState() {
    // 1. Horizontal movement from Keyboard, Virtual D-pad, or AI Gestures
    let moveX = 0;
    if (this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
    if (this.keys['d'] || this.keys['arrowright']) moveX += 1;

    if (this.virtualMoveX !== 0) {
      moveX = this.virtualMoveX;
    }

    if (this.gestureState.moveX !== 0) {
      moveX = this.gestureState.moveX;
    }

    // 2. Jump
    let jump = Boolean(
      this.keys['w'] ||
      this.keys['arrowup'] ||
      this.keys[' '] ||
      this.keys['space'] ||
      this.virtualJump ||
      this.gestureState.jump
    );

    // Consume single-frame jump triggers
    this.virtualJump = false;
    this.gestureState.jump = false;

    // 3. Aiming Angle
    let aimAngle = 0;
    if (this.gestureState.aimAngle !== null && this.gestureState.aimAngle !== undefined) {
      aimAngle = this.gestureState.aimAngle;
    } else {
      const dx = this.mouse.x - this.playerScreenPos.x;
      const dy = this.mouse.y - this.playerScreenPos.y;
      aimAngle = Math.atan2(dy, dx);
    }

    // 4. Bow Draw & Release
    const isDrawing = this.mouse.isDown || Boolean(this.gestureState.isDrawing);

    const attackRelease = this.mouse.justReleased || Boolean(this.gestureState.attackRelease);
    this.mouse.justReleased = false;
    this.gestureState.attackRelease = false;

    const meleeAttack = Boolean(this.gestureState.meleeAttack);
    this.gestureState.meleeAttack = false;

    const special = this.specialRequested || Boolean(this.gestureState.specialAbility);
    this.specialRequested = false;
    this.gestureState.specialAbility = false;

    const switchArrow = Boolean(this.gestureState.switchArrow);
    this.gestureState.switchArrow = false;

    const weapon = this.requestedWeapon;
    this.requestedWeapon = null;

    const arrow = this.requestedArrow;
    this.requestedArrow = null;

    return {
      moveX,
      jump,
      aimAngle,
      isDrawing,
      attackRelease,
      meleeAttack,
      switchArrow,
      weaponIndex: weapon,
      arrowTypeIndex: arrow,
      specialAbility: special,
      mousePos: { x: this.mouse.x, y: this.mouse.y },
    };
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.onMouseMove);
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      window.removeEventListener('mouseup', this.onMouseUp);

      this.canvas.removeEventListener('touchstart', this.onTouchStart);
      this.canvas.removeEventListener('touchmove', this.onTouchMove);
      this.canvas.removeEventListener('touchend', this.onTouchEnd);
      this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
    }
  }
}
