/**
 * InputProviders — Unified Controller Architecture for Stickman Showdown
 * Supports Keyboard, Mouse, Mobile Touch Controls, and AI Hand Gestures simultaneously.
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
      weaponIndex: 0,       // 0..4
      arrowTypeIndex: 0,    // 0..5
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
      x: 200,
      y: 300,
      isDown: false,
      justReleased: false,
    };

    this.playerScreenPos = { x: 200, y: 400 };

    // Mobile Virtual Touch Controls state
    this.virtualMoveX = 0;
    this.virtualJump = false;

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

      // Touch events for direct touch-to-aim and touch-to-shoot on mobile
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

  setVirtualInput({ moveX = 0, jump = false }) {
    this.virtualMoveX = moveX;
    this.virtualJump = jump;
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
    this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
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

  onTouchStart(e) {
    if (e.touches && e.touches.length > 0) {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouse.y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
      this.mouse.isDown = true;
      this.mouse.justReleased = false;
    }
  }

  onTouchMove(e) {
    if (e.touches && e.touches.length > 0) {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouse.y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
    }
  }

  onTouchEnd(e) {
    e.preventDefault();
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
    // 1. Horizontal movement from Keyboard, Mobile Virtual Buttons, or AI Gestures
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

    // Consume single-frame gesture jump
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

    // 4. Bow Draw & Release (Mouse, Touch, or AI Pinch Gesture)
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
