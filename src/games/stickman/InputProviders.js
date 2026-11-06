/**
 * InputProviders — Modular Controller Architecture for Stickman Showdown
 * Separates input detection from the gameplay physics and engine.
 * Allows easy future addition of HandGestureInputProvider without rewriting the engine.
 */

export class BaseInputProvider {
  getState() {
    return {
      moveX: 0,           // -1 (left), 0 (none), 1 (right)
      jump: false,        // true when jump pressed
      aimAngle: 0,        // radians pointing from player to crosshair
      isDrawing: false,   // true while holding down attack/bowstring
      attackRelease: false, // true on the exact frame attack is released
      meleeAttack: false, // true for quick melee attack
      weaponIndex: 0,     // 0..4 (1-5 keys)
      arrowTypeIndex: 0,  // 0..5 (special arrows)
      specialAbility: false, // Q key
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
      x: 0,
      y: 0,
      isDown: false,
      justReleased: false,
    };

    this.playerScreenPos = { x: 200, y: 400 }; // Updated by engine each frame
    this.requestedWeapon = null;
    this.requestedArrow = null;
    this.specialRequested = false;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    if (this.canvas) {
      this.canvas.addEventListener('mousemove', this.onMouseMove);
      this.canvas.addEventListener('mousedown', this.onMouseDown);
      window.addEventListener('mouseup', this.onMouseUp);
    }
  }

  setPlayerScreenPos(x, y) {
    this.playerScreenPos.x = x;
    this.playerScreenPos.y = y;
  }

  onKeyDown(e) {
    this.keys[e.key.toLowerCase()] = true;
    this.keys[e.code] = true;

    // Weapon switching 1..5
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      this.requestedWeapon = parseInt(e.key, 10) - 1;
    }

    // Special ability
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
    if (e.button === 0) { // Left click
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

  selectArrowType(idx) {
    this.requestedArrow = idx;
  }

  selectWeapon(idx) {
    this.requestedWeapon = idx;
  }

  getState() {
    let moveX = 0;
    if (this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
    if (this.keys['d'] || this.keys['arrowright']) moveX += 1;

    const jump = Boolean(this.keys['w'] || this.keys['arrowup'] || this.keys[' '] || this.keys['space']);

    // Angle from player chest to mouse
    const dx = this.mouse.x - this.playerScreenPos.x;
    const dy = this.mouse.y - this.playerScreenPos.y;
    const aimAngle = Math.atan2(dy, dx);

    const isDrawing = this.mouse.isDown;
    const attackRelease = this.mouse.justReleased;
    this.mouse.justReleased = false;

    const weapon = this.requestedWeapon;
    this.requestedWeapon = null;

    const arrow = this.requestedArrow;
    this.requestedArrow = null;

    const special = this.specialRequested;
    this.specialRequested = false;

    return {
      moveX,
      jump,
      aimAngle,
      isDrawing,
      attackRelease,
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
    }
  }
}

/**
 * HandGestureInputProvider — Stub for future MediaPipe AI hand tracking integration
 * When ready, implements gesture mapping (e.g. index pinch to draw bowstring, point to aim)
 */
export class HandGestureInputProvider extends BaseInputProvider {
  constructor() {
    super();
    this.active = false;
  }
  getState() {
    return super.getState();
  }
}

