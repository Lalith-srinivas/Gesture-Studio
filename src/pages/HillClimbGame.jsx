/**
 * HillClimbGame.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * A production-ready 2D Hill Climb Racing–style physics game built with:
 *   • React (functional component + hooks)
 *   • HTML5 Canvas
 *   • requestAnimationFrame game loop
 *   • Abstracted Input System (ready for MediaPipe hand-tracking plug-in)
 *
 * Usage:
 *   import HillClimbGame from './HillClimbGame';
 *   <HillClimbGame />
 *
 * No external dependencies required beyond React itself.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';
import { GESTURES, getGestureLabel, getHandRotation } from '../utils/gestureDetector';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const PHYSICS = {
  GRAVITY: 0.35,
  ENGINE_FORCE: 0.32,
  NITRO_FORCE: 0.7,
  BRAKE_FORCE: 0.18,
  MAX_SPEED: 10,
  MAX_NITRO_SPD: 16,
  DAMPING_LIN: 0.99,
  DAMPING_ROT: 0.85,
  MAX_ANG_VEL: 0.04,     // prevent wild spinning
  SUSPENSION_K: 0.45,
  RESTITUTION: 0.05,     // very low bounce — cars don't bounce
  FRICTION: 0.5,
  FUEL_IDLE_RATE: 0.006,
  FUEL_ACCEL_RATE: 0.055,
  FUEL_NITRO_RATE: 0.16,
};

const CAR = {
  WIDTH: 52,
  HEIGHT: 26,
  WHEEL_RADIUS: 16,
  WHEEL_FWD_OFF: 0.38,
};

const TERRAIN = {
  SEGMENT: 8,
  BASE_Y: 250,   // shifted down so car has more room
};

const ITEM = {
  COIN_SCORE: 10,
  FUEL_RESTORE: 30,
  COLLECT_RADIUS: 26,
  BOB_SPEED: 2,
  BOB_AMP: 3,
};

const CAMERA = {
  LAG: 0.08,
  CAR_X_PCT: 0.30,
  CAR_Y_PCT: 0.50,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TERRAIN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function hashNoise(n) {
  let v = n;
  v = ((v >> 8) ^ v) * 0x45d9f3b;
  v = ((v >> 8) ^ v) * 0x45d9f3b;
  v = (v >> 8) ^ v;
  return (v & 0xffff) / 0xffff - 0.5;
}

function smoothNoise(x, freq, amp) {
  const ix = Math.floor(x * freq);
  const fx = x * freq - ix;
  const h1 = hashNoise(ix);
  const h2 = hashNoise(ix + 1);
  const t = fx * fx * (3 - 2 * fx);
  return (h1 + t * (h2 - h1)) * amp;
}

/**
 * Returns the Y pixel coordinate of the terrain surface at world-x.
 * GENTLE rolling hills — no spikes, no cliffs.
 */
function getTerrainHeightAt(x) {
  const base = TERRAIN.BASE_Y;
  // Only very gentle, wide-frequency rolling hills
  const h = base
    + smoothNoise(x, 0.0008, 120)   // Very wide, gentle valleys
    + smoothNoise(x, 0.002, 40)     // Smooth rolling hills
    + smoothNoise(x, 0.005, 10);    // Slight natural waviness
  // Flat starting area
  if (x < 400) {
    const t = Math.max(0, x / 400);
    return base + (h - base) * t * t; // quadratic ease-in from flat to hills
  }
  return h;
}

/** Numerical derivative → slope at x (correct delta = 4px) */
function getTerrainSlope(x) {
  return (getTerrainHeightAt(x + 2) - getTerrainHeightAt(x - 2)) / 4;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function createInputManager() {
  const sources = [];
  const state = { accelerate: false, brake: false, nitro: false, tiltFwd: false, tiltBack: false, pause: false };

  return {
    addSource(src) { sources.push(src); },
    removeSource(src) {
      const i = sources.indexOf(src);
      if (i !== -1) sources.splice(i, 1);
    },
    update() {
      state.accelerate = false;
      state.brake = false;
      state.nitro = false;
      state.pause = false;
      for (const src of sources) {
        const s = src.read();
        if (s.accelerate) state.accelerate = true;
        if (s.brake) state.brake = true;
        if (s.nitro) state.nitro = true;
        if (s.pause) state.pause = true;
      }
    },
    getState() { return { ...state }; },
  };
}

function createKeyboardSource() {
  const keys = {};
  const onDown = (e) => {
    keys[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  };
  const onUp = (e) => { keys[e.key] = false; };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  return {
    read() {
      return {
        accelerate: !!keys['ArrowRight'],
        brake: !!keys['ArrowLeft'],
        nitro: !!keys['n'] || !!keys['N'],
        pause: !!keys['p'] || !!keys['P'],
      };
    },
    destroy() {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    },
  };
}

function createTouchSource() {
  const state = { accelerate: false, brake: false, nitro: false, tiltFwd: false, tiltBack: false, pause: false };
  return {
    state,
    read() { return { ...state }; },
  };
}

function createHandTrackingSource(handStateRef) {
  return {
    read() {
      const h = handStateRef.current;
      if (!h || !h.detected) return { accelerate: false, brake: false, nitro: false, pause: false };

      return {
        accelerate: h.gesture === GESTURES.DRAW,
        brake: h.gesture === GESTURES.STOP,
        nitro: h.gesture === GESTURES.PINCH,
        pause: h.gesture === GESTURES.PAN,
      };
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICLE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function createParticleSystem() {
  const pool = [];
  return {
    spawn(x, y, color, count = 6) {
      for (let i = 0; i < count; i++) {
        pool.push({
          x, y,
          vx: (Math.random() - 0.5) * 3.5,
          vy: -Math.random() * 3.5 - 0.5,
          color,
          life: 20 + Math.floor(Math.random() * 20),
          maxLife: 40,
          size: 2.5 + Math.random() * 3,
        });
      }
    },
    update() {
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.vx *= 0.97;
        p.life--;
        if (p.life <= 0) pool.splice(i, 1);
      }
    },
    draw(ctx) {
      for (const p of pool) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    getPool() { return pool; },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME OBJECT FACTORIES
// ═══════════════════════════════════════════════════════════════════════════════

function createCar(startX) {
  const groundY = getTerrainHeightAt(startX);
  return {
    x: startX,
    y: groundY - CAR.WHEEL_RADIUS - CAR.HEIGHT * 0.35, // sit ON the ground, not floating
    vx: 0,
    vy: 0,
    angle: 0,
    angVel: 0,
    onGround: false,
    engineOn: false,
    dead: false,
    flipped: false,
    flipTimer: 0,
    wheelAngle: 0,
    nitroActive: false,
    startTime: performance.now(),
  };
}

function createItem(x, type) {
  return {
    x,
    y: getTerrainHeightAt(x) - 22,
    type,
    collected: false,
    bob: Math.random() * Math.PI * 2,
  };
}

function createRock(x) {
  return {
    x,
    y: 0,
    r: 9 + Math.random() * 8,
    hit: false,
  };
}

function spawnItems(startX, count, type, spacing, scatter) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = startX + i * spacing + (Math.random() - 0.5) * scatter;
    out.push(createItem(x, type));
  }
  return out;
}

function spawnRocks(startX, count, spacing) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = startX + i * spacing + (Math.random() - 0.5) * spacing * 0.55 + 80;
    out.push(createRock(x));
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME STATE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

function createGameState() {
  return {
    car: createCar(80),
    camera: { x: 0, y: 0 },
    score: 0,
    coins: 0,
    fuel: 100,
    distance: 0,
    maxDist: 0,
    items: [
      createItem(400, 'coin'),
      createItem(650, 'coin'),
      createItem(900, 'fuel'),
      createItem(1100, 'coin'),
      createItem(1500, 'coin'),
      createItem(1900, 'fuel'),
    ],
    rocks: [createRock(1300)],
    // Track next spawn x for each type independently
    nextCoinX: 2200,
    nextFuelX: 2800,
    nextRockX: 2600,
    tick: 0,
    running: false,
    over: false,
    phase: 'menu',
  };
}

/**
 * Infinite spawning: spawns ONE item at a time when the car gets close.
 * Each item type has its own "nextX" position — no loops, no batches.
 */
function spawnAhead(gs) {
  const car = gs.car;
  const spawnHorizon = car.x + 1500; // only spawn within this range

  // ── Coins: one at a time, every 500-800px ──────────────────────────────
  if (gs.nextCoinX < spawnHorizon) {
    gs.items.push(createItem(gs.nextCoinX + (Math.random() - 0.5) * 50, 'coin'));
    gs.nextCoinX += 500 + Math.random() * 300;
  }

  // ── Fuel: one at a time, every 1200-1800px ─────────────────────────────
  if (gs.nextFuelX < spawnHorizon) {
    gs.items.push(createItem(gs.nextFuelX + (Math.random() - 0.5) * 40, 'fuel'));
    gs.nextFuelX += 1200 + Math.random() * 600;
  }

  // ── Rocks: one at a time, every 800-1200px ─────────────────────────────
  if (gs.nextRockX < spawnHorizon) {
    gs.rocks.push(createRock(gs.nextRockX));
    gs.nextRockX += 800 + Math.random() * 400;
  }

  // Cleanup old items far behind camera (memory management)
  if (gs.tick % 120 === 0) { // every 2 seconds
    const cleanupX = car.x - 1200;
    gs.items = gs.items.filter(item => item.x > cleanupX);
    gs.rocks = gs.rocks.filter(rock => rock.x > cleanupX);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHYSICS UPDATE
// ═══════════════════════════════════════════════════════════════════════════════

function updatePhysics(gs, input, particles) {
  const car = gs.car;
  if (car.dead) return true;

  // ── Infinite item spawning ─────────────────────────────────────────────
  spawnAhead(gs);

  // ── Gravity ────────────────────────────────────────────────────────────
  car.vy += PHYSICS.GRAVITY;

  // ── Engine & fuel ──────────────────────────────────────────────────────
  const useNitro = input.nitro && gs.fuel > 0.5;
  car.nitroActive = useNitro;

  // Engine force always pushes HORIZONTALLY (not along car angle)
  // This prevents the car from launching itself into the air on hills
  if (useNitro) {
    car.vx += PHYSICS.NITRO_FORCE;
    gs.fuel = Math.max(0, gs.fuel - PHYSICS.FUEL_NITRO_RATE);
    car.engineOn = true;
  } else if (input.accelerate && gs.fuel > 0) {
    car.vx += PHYSICS.ENGINE_FORCE;
    gs.fuel = Math.max(0, gs.fuel - PHYSICS.FUEL_ACCEL_RATE);
    car.engineOn = true;
  } else {
    car.engineOn = false;
    gs.fuel = Math.max(0, gs.fuel - PHYSICS.FUEL_IDLE_RATE);
  }

  if (input.brake) {
    car.vx *= 0.92; // proportional braking instead of fixed force
  }

  // ── Speed cap ──────────────────────────────────────────────────────────
  const maxSpd = useNitro ? PHYSICS.MAX_NITRO_SPD : PHYSICS.MAX_SPEED;
  if (Math.abs(car.vx) > maxSpd) {
    car.vx = Math.sign(car.vx) * maxSpd;
  }

  // ── Damping ────────────────────────────────────────────────────────────
  car.vx *= PHYSICS.DAMPING_LIN;
  car.vy *= PHYSICS.DAMPING_LIN;
  car.angVel *= PHYSICS.DAMPING_ROT;

  // ── Angular velocity cap ───────────────────────────────────────────────
  if (Math.abs(car.angVel) > PHYSICS.MAX_ANG_VEL) {
    car.angVel = Math.sign(car.angVel) * PHYSICS.MAX_ANG_VEL;
  }

  // ── Integrate angle ────────────────────────────────────────────────────
  car.angle += car.angVel;
  car.angle = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, car.angle));
  car.wheelAngle += car.vx * 0.06;

  // ── Integrate position ─────────────────────────────────────────────────
  car.x += car.vx;
  car.y += car.vy;

  // ── Wheel-ground collision ─────────────────────────────────────────────
  car.onGround = false;

  // Sample terrain height under both wheels
  const cosA = Math.cos(car.angle);
  const sinA = Math.sin(car.angle);
  const wheelOff = CAR.WIDTH * CAR.WHEEL_FWD_OFF;

  const rearWX = car.x - cosA * wheelOff;
  const rearWY = car.y + sinA * wheelOff + CAR.HEIGHT * 0.35;
  const frontWX = car.x + cosA * wheelOff;
  const frontWY = car.y + sinA * wheelOff + CAR.HEIGHT * 0.35;

  const rearGH = getTerrainHeightAt(rearWX);
  const frontGH = getTerrainHeightAt(frontWX);

  // Process each wheel
  const wheels = [
    { wx: rearWX, wy: rearWY, gh: rearGH },
    { wx: frontWX, wy: frontWY, gh: frontGH },
  ];

  for (const w of wheels) {
    const pen = (w.wy + CAR.WHEEL_RADIUS) - w.gh;

    if (pen > 0) {
      car.onGround = true;

      // Push car up out of ground
      car.y -= pen * PHYSICS.SUSPENSION_K;

      // Kill downward velocity on contact
      if (car.vy > 0) {
        car.vy *= -PHYSICS.RESTITUTION; // near-zero bounce
      }
    }
  }

  // ── Align car angle to terrain ─────────────────────────────────────────
  if (car.onGround) {
    // Target angle = angle of line between terrain under rear and front wheels
    const targetAngle = Math.atan2(frontGH - rearGH, wheelOff * 2);
    const angleDiff = targetAngle - car.angle;
    // Smooth, stable alignment
    car.angVel += angleDiff * 0.08;
    car.angVel *= 0.8; // heavy rotational damping when grounded
  }

  // ── Keep car from going below ground (safety) ──────────────────────────
  const centerGH = getTerrainHeightAt(car.x);
  const minY = centerGH - CAR.WHEEL_RADIUS - CAR.HEIGHT * 0.35;
  if (car.y > minY) {
    car.y = minY;
    if (car.vy > 0) car.vy = 0;
    car.onGround = true;
  }

  // ── Flip detection ─────────────────────────────────────────────────────
  const gracePeriod = performance.now() - car.startTime < 3000;
  if (!gracePeriod && Math.abs(car.angle) > 1.4 && car.onGround) {
    car.flipTimer = (car.flipTimer || 0) + 1;
    if (car.flipTimer > 120) {
      car.dead = true;
      car.flipped = true;
    }
  } else {
    car.flipTimer = 0;
  }

  // ── Rock collisions ────────────────────────────────────────────────────
  for (const rock of gs.rocks) {
    if (rock.hit) continue;
    rock.y = getTerrainHeightAt(rock.x) - rock.r * 0.65;
    const dx = car.x - rock.x, dy = car.y - rock.y;
    if (Math.hypot(dx, dy) < rock.r + 22) {
      rock.hit = true;
      car.vx *= 0.3;
      car.vy -= 0.5;
      particles.spawn(rock.x, rock.y, '#888', 7);
    }
  }

  // ── Item collection ────────────────────────────────────────────────────
  for (const item of gs.items) {
    if (item.collected) continue;
    item.y = getTerrainHeightAt(item.x) - 22;
    if (Math.hypot(car.x - item.x, car.y - item.y) < ITEM.COLLECT_RADIUS) {
      item.collected = true;
      if (item.type === 'coin') {
        gs.coins++;
        gs.score += ITEM.COIN_SCORE;
        particles.spawn(item.x, item.y, '#facc15', 6);
      } else {
        gs.fuel = Math.min(100, gs.fuel + ITEM.FUEL_RESTORE);
        particles.spawn(item.x, item.y, '#22c55e', 6);
      }
    }
  }

  // ── Score / distance ───────────────────────────────────────────────────
  gs.distance = Math.max(gs.distance, (car.x - 80) / 5);
  gs.score = Math.round(gs.distance + gs.coins * ITEM.COIN_SCORE);
  gs.maxDist = Math.max(gs.maxDist, gs.distance);
  gs.tick++;

  return gs.fuel <= 0 || car.dead;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAMERA UPDATE
// ═══════════════════════════════════════════════════════════════════════════════

function updateCamera(gs, W, H) {
  const targetX = gs.car.x - W * CAMERA.CAR_X_PCT;
  const targetY = gs.car.y - H * CAMERA.CAR_Y_PCT;
  gs.camera.x += (targetX - gs.camera.x) * CAMERA.LAG;
  gs.camera.y += (targetY - gs.camera.y) * CAMERA.LAG;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

function renderGame(ctx, canvas, gs, particles) {
  const W = canvas.width, H = canvas.height;
  const { camera, car, items, rocks, tick } = gs;
  const t = tick / 60;

  ctx.clearRect(0, 0, W, H);

  // ── Sky ────────────────────────────────────────────────────────────────
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#4a90d9');
  sky.addColorStop(0.6, '#87CEEB');
  sky.addColorStop(1, '#c8e8f4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Distant mountains (parallax)
  drawMountains(ctx, W, H, camera.x * 0.2, camera.y * 0.1);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // ── Terrain ────────────────────────────────────────────────────────────
  drawTerrain(ctx, camera, W, H);

  // ── Rocks ──────────────────────────────────────────────────────────────
  drawRocks(ctx, rocks, camera, W);

  // ── Items ──────────────────────────────────────────────────────────────
  drawItems(ctx, items, camera, W, t);

  // ── Particles ──────────────────────────────────────────────────────────
  particles.draw(ctx);

  // ── Exhaust smoke & Nitro flames ───────────────────────────────────────
  if (car.nitroActive && !car.dead) {
    const ex = car.x - Math.cos(car.angle) * CAR.WIDTH * 0.5;
    const ey = car.y - Math.sin(car.angle) * CAR.WIDTH * 0.5;
    if (Math.random() < 0.8) particles.spawn(ex, ey, '#fb923c', 2);
    if (Math.random() < 0.4) particles.spawn(ex, ey, '#ef4444', 3);
    if (Math.random() < 0.3) particles.spawn(ex, ey, '#fff', 1);
  } else if (car.engineOn && !car.dead && Math.random() < 0.4) {
    const ex = car.x - Math.cos(car.angle) * CAR.WIDTH * 0.5 + Math.sin(car.angle) * 6;
    const ey = car.y - Math.sin(car.angle) * CAR.WIDTH * 0.5 - Math.cos(car.angle) * 6;
    particles.spawn(ex, ey, 'rgba(150,160,170,0.7)', 1);
  }

  // ── Dirt/dust from wheels on ground ────────────────────────────────────
  if (car.onGround && Math.abs(car.vx) > 2 && Math.random() < 0.3) {
    const wx = car.x - Math.cos(car.angle) * CAR.WIDTH * CAR.WHEEL_FWD_OFF;
    const wy = getTerrainHeightAt(wx);
    particles.spawn(wx, wy, '#a8a29e', 1);
  }

  // ── Car ────────────────────────────────────────────────────────────────
  drawCar(ctx, car);

  ctx.restore();

  // ── Damage vignette ────────────────────────────────────────────────────
  if (car.dead) {
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
    vig.addColorStop(0, 'rgba(200,0,0,0)');
    vig.addColorStop(1, 'rgba(200,0,0,0.35)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawMountains(ctx, W, H, offsetX, offsetY) {
  const peaks = [
    { x: 0.1, y: 0.55, w: 0.22 },
    { x: 0.28, y: 0.48, w: 0.18 },
    { x: 0.5, y: 0.60, w: 0.25 },
    { x: 0.72, y: 0.50, w: 0.20 },
    { x: 0.90, y: 0.56, w: 0.22 },
  ];
  for (const p of peaks) {
    const cx = (p.x * W + (offsetX % W) + W) % W;
    ctx.beginPath();
    ctx.moveTo(cx - p.w * W / 2, H * 0.72);
    ctx.lineTo(cx, H * p.y);
    ctx.lineTo(cx + p.w * W / 2, H * 0.72);
    ctx.closePath();
    ctx.fillStyle = '#b8cce0';
    ctx.fill();
    // Snow cap
    ctx.beginPath();
    ctx.moveTo(cx - 20, H * (p.y + 0.04));
    ctx.lineTo(cx, H * p.y);
    ctx.lineTo(cx + 20, H * (p.y + 0.04));
    ctx.closePath();
    ctx.fillStyle = '#e8f0f8';
    ctx.fill();
  }
}

function drawTerrain(ctx, camera, W, H) {
  const startX = Math.floor(camera.x / TERRAIN.SEGMENT) * TERRAIN.SEGMENT - TERRAIN.SEGMENT * 2;
  const endX = startX + W + 200;

  // 1. Soil / Ground Fill
  ctx.beginPath();
  ctx.moveTo(startX, H + camera.y + 500);
  for (let x = startX; x <= endX; x += TERRAIN.SEGMENT) {
    ctx.lineTo(x, getTerrainHeightAt(x) + 20);
  }
  ctx.lineTo(endX, H + camera.y + 500);
  ctx.closePath();

  const soilGrad = ctx.createLinearGradient(0, 200, 0, 800);
  soilGrad.addColorStop(0, '#5e4028');
  soilGrad.addColorStop(1, '#2d1b0d');
  ctx.fillStyle = soilGrad;
  ctx.fill();

  // 2. Asphalt Road Layer
  ctx.beginPath();
  for (let x = startX; x <= endX; x += TERRAIN.SEGMENT) {
    x === startX ? ctx.moveTo(x, getTerrainHeightAt(x)) : ctx.lineTo(x, getTerrainHeightAt(x));
  }
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.stroke();

  // 3. Centerline (dashed yellow)
  ctx.beginPath();
  ctx.setLineDash([15, 25]);
  for (let x = startX; x <= endX; x += TERRAIN.SEGMENT) {
    x === startX ? ctx.moveTo(x, getTerrainHeightAt(x)) : ctx.lineTo(x, getTerrainHeightAt(x));
  }
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  // 4. Grass Edge
  ctx.beginPath();
  for (let x = startX; x <= endX; x += TERRAIN.SEGMENT) {
    const y = getTerrainHeightAt(x);
    x === startX ? ctx.moveTo(x, y - 4) : ctx.lineTo(x, y - 4);
  }
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawRocks(ctx, rocks, camera, W) {
  for (const rock of rocks) {
    if (rock.x < camera.x - 80 || rock.x > camera.x + W + 80) continue;
    rock.y = getTerrainHeightAt(rock.x) - rock.r * 0.62;
    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.beginPath();
    ctx.ellipse(0, 0, rock.r, rock.r * 0.72, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = rock.hit ? '#aaa' : '#78716c';
    ctx.fill();
    ctx.strokeStyle = rock.hit ? '#999' : '#57534e';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-rock.r * 0.25, -rock.r * 0.25, rock.r * 0.3, rock.r * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
    ctx.restore();
  }
}

function drawItems(ctx, items, camera, W, t) {
  for (const item of items) {
    if (item.collected) continue;
    if (item.x < camera.x - 50 || item.x > camera.x + W + 50) continue;
    const iy = item.y + Math.sin(t * ITEM.BOB_SPEED + item.bob) * ITEM.BOB_AMP;

    ctx.save();
    ctx.translate(item.x, iy);

    if (item.type === 'coin') {
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#b45309';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-3, -3, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,200,0.6)';
      ctx.fill();
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0.5);
    } else {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.roundRect(-9, -13, 18, 20, 3);
      ctx.fill();
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(-5, -11, 6, 9);
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(-5, 4, 10, 4);
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.roundRect(-2, -17, 4, 6, 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', 0, -1);
    }

    ctx.restore();
  }
}

function drawCar(ctx, car) {
  const { x, y, angle, vx, engineOn, dead, wheelAngle } = car;
  const W = CAR.WIDTH, H = CAR.HEIGHT, WR = CAR.WHEEL_RADIUS;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = dead ? 0.65 : 1;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, H * 0.5 + 10, W * 0.42, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = dead ? '#666' : '#1d4ed8';
  ctx.beginPath();
  ctx.roundRect(-W / 2, -H / 2, W, H, [5, 5, 3, 3]);
  ctx.fill();

  // Body highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(-W / 2 + 2, -H / 2 + 2, W - 4, H / 2 - 2, [4, 4, 0, 0]);
  ctx.fill();

  // Cabin roof
  ctx.fillStyle = dead ? '#555' : '#1e40af';
  ctx.beginPath();
  ctx.roundRect(-W * 0.22, -H / 2 - 15, W * 0.44, 17, [4, 4, 0, 0]);
  ctx.fill();

  // Windshield
  ctx.fillStyle = dead ? '#999' : 'rgba(186,230,253,0.88)';
  ctx.beginPath();
  ctx.roundRect(-W * 0.18, -H / 2 - 13, W * 0.36, 14, 3);
  ctx.fill();
  // Windshield glare
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.roundRect(-W * 0.15, -H / 2 - 11, W * 0.10, 5, 2);
  ctx.fill();

  // Headlight
  ctx.fillStyle = dead ? '#aaa' : '#fef9c3';
  ctx.shadowColor = dead ? 'transparent' : '#fde047';
  ctx.shadowBlur = engineOn ? 8 : 2;
  ctx.beginPath();
  ctx.ellipse(W / 2 - 5, -1, 4.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Rear bumper
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(-W / 2, H / 2 - 5, 6, 5);

  // Exhaust pipe
  ctx.fillStyle = '#374151';
  ctx.fillRect(-W / 2 + 2, H / 2 - 2, 10, 3);

  // Underbody
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(-W * 0.44, H * 0.28, W * 0.88, 5);

  // Wheels
  const wXOffsets = [-W * CAR.WHEEL_FWD_OFF, W * CAR.WHEEL_FWD_OFF];
  const wY = H * 0.5;

  for (let wi = 0; wi < 2; wi++) {
    const wx = wXOffsets[wi];
    // Tyre
    ctx.beginPath();
    ctx.arc(wx, wY, WR, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1917';
    ctx.fill();

    // Nitro glow on wheels
    if (car.nitroActive) {
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(96,165,250,0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // Tyre tread
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 2;
    for (let seg = 0; seg < 8; seg++) {
      const a = (seg / 8) * Math.PI * 2 + wheelAngle;
      ctx.beginPath();
      ctx.arc(wx, wY, WR - 1, a, a + 0.25);
      ctx.stroke();
    }
    // Rim
    ctx.beginPath();
    ctx.arc(wx, wY, WR - 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Hub
    ctx.beginPath();
    ctx.arc(wx, wY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#d4d4d4';
    ctx.fill();
    // Spokes
    for (let s = 0; s < 5; s++) {
      const sa = (s / 5) * Math.PI * 2 + wheelAngle;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(sa) * 4, wY + Math.sin(sa) * 4);
      ctx.lineTo(wx + Math.cos(sa) * (WR - 5), wY + Math.sin(sa) * (WR - 5));
      ctx.strokeStyle = '#a8a29e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function HillClimbGame() {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const handOverlayRef = useRef(null);
  const gsRef = useRef(null);
  const particlesRef = useRef(null);
  const inputRef = useRef(null);
  const hSourceRef = useRef(null);
  const kbSourceRef = useRef(null);
  const touchSrcRef = useRef(null);
  const rafRef = useRef(null);
  const lastTsRef = useRef(0);
  const phaseRef = useRef('menu');
  const pausedRef = useRef(false);
  const pauseCooldownRef = useRef(0);

  const handStateRef = useRef({ detected: false, gesture: GESTURES.NONE, rotation: 0 });

  useHandTracking({
    videoRef,
    overlayCanvasRef: handOverlayRef,
    onGesture: (gesture, tip, dims, landmarks) => {
      const s = handStateRef.current;
      s.detected = tip !== null;
      s.gesture = gesture;
      s.rotation = getHandRotation(landmarks);
    }
  });

  // HUD DOM refs (no re-render, direct mutation)
  const hudDistRef = useRef(null);
  const hudScoreRef = useRef(null);
  const hudCoinsRef = useRef(null);
  const hudFuelRef = useRef(null);
  const hudFuelBarRef = useRef(null);
  const hudSpeedRef = useRef(null);
  const overlayRef = useRef(null);
  const olTitleRef = useRef(null);
  const olSubRef = useRef(null);
  const olStatsRef = useRef(null);
  const olBtnRef = useRef(null);

  // ── Canvas resize ──────────────────────────────────────────────────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrap = canvas.parentElement;
    canvas.width = wrap.clientWidth;
    canvas.height = Math.min(420, Math.max(280, wrap.clientWidth * 0.43));
  }, []);

  // ── HUD update ─────────────────────────────────────────────────────────────
  const updateHUD = useCallback(() => {
    const gs = gsRef.current;
    if (!gs) return;
    const spd = Math.round(Math.abs(gs.car.vx) * 12);
    const f = Math.max(0, gs.fuel);
    if (hudDistRef.current) hudDistRef.current.textContent = Math.round(gs.distance) + ' m';
    if (hudScoreRef.current) hudScoreRef.current.textContent = gs.score;
    if (hudCoinsRef.current) hudCoinsRef.current.textContent = gs.coins;
    if (hudFuelRef.current) hudFuelRef.current.textContent = Math.round(f) + '%';
    if (hudSpeedRef.current) hudSpeedRef.current.textContent = spd + ' km/h';
    if (hudFuelBarRef.current) {
      hudFuelBarRef.current.style.width = f + '%';
      hudFuelBarRef.current.style.background =
        f > 50 ? '#22c55e' : f > 25 ? '#f59e0b' : '#ef4444';
    }
  }, []);

  // ── Show overlay ───────────────────────────────────────────────────────────
  const showOverlay = useCallback((title, sub, statsHTML, btnText) => {
    if (olTitleRef.current) olTitleRef.current.textContent = title;
    if (olSubRef.current) olSubRef.current.textContent = sub;
    if (olStatsRef.current) olStatsRef.current.innerHTML = statsHTML;
    if (olBtnRef.current) olBtnRef.current.textContent = btnText;
    if (overlayRef.current) overlayRef.current.style.display = 'flex';
  }, []);

  const hideOverlay = useCallback(() => {
    if (overlayRef.current) overlayRef.current.style.display = 'none';
  }, []);

  // ── End game ──────────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    const gs = gsRef.current;
    if (!gs || gs.over) return;
    gs.over = true;
    gs.running = false;
    phaseRef.current = 'over';
    setTimeout(() => {
      showOverlay(
        gs.car.flipped ? '🚗 Flipped Over!' : '⛽ Out of Fuel!',
        'Game over — try again!',
        `<div style="font-size:13px;color:#6b7280;margin:4px 0">
           Distance: <strong style="color:#111">${Math.round(gs.maxDist)} m</strong>
         </div>
         <div style="font-size:13px;color:#6b7280;margin:4px 0">
           Score: <strong style="color:#111">${gs.score}</strong>
         </div>
         <div style="font-size:13px;color:#6b7280;margin:4px 0">
           Coins: <strong style="color:#111">${gs.coins}</strong>
         </div>`,
        'Play Again'
      );
    }, 500);
  }, [showOverlay]);

  // ── Init game ──────────────────────────────────────────────────────────────
  const initGame = useCallback(() => {
    gsRef.current = createGameState();
    particlesRef.current = createParticleSystem();
  }, []);

  // ── Game loop ──────────────────────────────────────────────────────────────
  const gameLoop = useCallback((ts) => {
    const gs = gsRef.current;
    if (!gs || !gs.running) return;
    rafRef.current = requestAnimationFrame(gameLoop);

    const dt = Math.min(ts - lastTsRef.current, 50);
    lastTsRef.current = ts;

    const input = inputRef.current.getState();

    // Pause toggle
    if (input.pause && performance.now() - pauseCooldownRef.current > 1000) {
      pausedRef.current = !pausedRef.current;
      pauseCooldownRef.current = performance.now();
      if (pausedRef.current) {
        showOverlay('Paused', 'Fist gesture to resume', '', 'Resume');
      } else {
        hideOverlay();
      }
    }

    if (pausedRef.current) return;

    const over = updatePhysics(gs, input, particlesRef.current);
    particlesRef.current.update();
    updateCamera(gs, canvasRef.current.width, canvasRef.current.height);
    renderGame(canvasRef.current.getContext('2d'), canvasRef.current, gs, particlesRef.current);
    updateHUD();

    if (over) endGame();
  }, [updateHUD, endGame, showOverlay, hideOverlay]);

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    hideOverlay();
    pausedRef.current = false;
    initGame();
    gsRef.current.running = true;
    phaseRef.current = 'playing';
    lastTsRef.current = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [hideOverlay, initGame, gameLoop]);

  // ── Mount / unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const manager = createInputManager();
    const keyboard = createKeyboardSource();
    const touch = createTouchSource();
    const hand = createHandTrackingSource(handStateRef);
    manager.addSource(keyboard);
    manager.addSource(touch);
    manager.addSource(hand);
    inputRef.current = manager;
    kbSourceRef.current = keyboard;
    touchSrcRef.current = touch;
    hSourceRef.current = hand;

    let pollId;
    const poll = () => { manager.update(); pollId = requestAnimationFrame(poll); };
    pollId = requestAnimationFrame(poll);

    initGame();
    const canvas = canvasRef.current;
    renderGame(canvas.getContext('2d'), canvas, gsRef.current, particlesRef.current);
    showOverlay(
      '🏎️ Hill Climb Racing',
      'Physics-based climbing challenge',
      `<div style="font-size:12px;color:#94a3b8;margin:8px 0">
        <div>→ or ☝️ = Throttle</div>
        <div>← or ✋ = Brake</div>
        <div>N or 🤏 = Nitro</div>
      </div>`,
      'Start Game'
    );

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      keyboard.destroy();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(pollId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Touch button binding ───────────────────────────────────────────────────
  const bindTouch = useCallback((key) => ({
    onMouseDown: () => { if (touchSrcRef.current) touchSrcRef.current.state[key] = true; },
    onMouseUp: () => { if (touchSrcRef.current) touchSrcRef.current.state[key] = false; },
    onMouseLeave: () => { if (touchSrcRef.current) touchSrcRef.current.state[key] = false; },
    onTouchStart: (e) => { e.preventDefault(); if (touchSrcRef.current) touchSrcRef.current.state[key] = true; },
    onTouchEnd: () => { if (touchSrcRef.current) touchSrcRef.current.state[key] = false; },
  }), []);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const styles = {
    root: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      userSelect: 'none',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      overflow: 'hidden',
    },
    hud: {
      display: 'flex', gap: 10, padding: '8px 12px', flexWrap: 'wrap',
      background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
    },
    hudCard: {
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 8, padding: '3px 10px', minWidth: 80,
    },
    hudLabel: { fontSize: 10, color: '#64748b', marginBottom: 1 },
    hudVal: { fontSize: 15, fontWeight: 500, color: '#0f172a' },
    fuelWrap: { display: 'flex', alignItems: 'center', gap: 6 },
    fuelBg: {
      width: 90, height: 9, background: '#e2e8f0',
      borderRadius: 5, overflow: 'hidden', border: '1px solid #cbd5e1',
    },
    gameWrap: { position: 'relative' },
    canvas: { display: 'block', width: '100%' },
    overlay: {
      position: 'absolute', inset: 0,
      display: 'none', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    },
    overlayBox: {
      background: '#fff', borderRadius: 12, padding: '28px 32px',
      textAlign: 'center', maxWidth: 300, width: '90%',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    },
    overlayTitle: { fontSize: 22, fontWeight: 500, color: '#0f172a', marginBottom: 6 },
    overlaySub: { fontSize: 14, color: '#64748b', marginBottom: 16 },
    startBtn: {
      marginTop: 18, padding: '10px 0', width: '100%',
      fontSize: 15, fontWeight: 500, cursor: 'pointer',
      border: '1px solid #cbd5e1', borderRadius: 8,
      background: '#1d4ed8', color: '#fff',
    },
    controlsHint: {
      padding: '7px 12px', display: 'flex', gap: 14, flexWrap: 'wrap',
      fontSize: 12, color: '#64748b',
      background: '#f8fafc', borderTop: '1px solid #e2e8f0',
    },
    keySpan: {
      display: 'inline-block', padding: '1px 5px',
      background: '#fff', border: '1px solid #cbd5e1',
      borderRadius: 4, fontSize: 11, fontWeight: 500, color: '#374151',
      marginRight: 4,
    },
    mobileRow: {
      display: 'flex', justifyContent: 'space-between', padding: '8px 10px',
      background: '#f8fafc', borderTop: '1px solid #e2e8f0',
    },
    mobileBtn: {
      width: 54, height: 42, fontSize: 18, cursor: 'pointer',
      border: '1px solid #cbd5e1', borderRadius: 8,
      background: '#fff', color: '#374151', touchAction: 'none',
    },
    mobileBtnAccel: {
      width: 54, height: 42, fontSize: 18, cursor: 'pointer',
      border: '1px solid #93c5fd', borderRadius: 8,
      background: '#dbeafe', color: '#1d4ed8', touchAction: 'none',
    },
    video: {
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      objectFit: 'cover', transform: 'scaleX(-1)', opacity: 0.15, pointerEvents: 'none',
    },
    handOverlay: {
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      transform: 'scaleX(-1)', pointerEvents: 'none',
    },
    gestureHints: {
      position: 'absolute', top: 12, right: 12,
      display: 'flex', flexDirection: 'column', gap: 6,
    },
    gestureHint: {
      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)',
      padding: '4px 10px', borderRadius: 8, fontSize: 11,
      display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e2e8f0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    nitroVignette: {
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: 'radial-gradient(circle, transparent 20%, rgba(59,130,246,0.15) 100%)',
      opacity: 0, transition: 'opacity 0.3s',
    },
  };

  // ── Gesture UI state ───────────────────────────────────────────────────────
  const [activeGesture, setActiveGesture] = useState(GESTURES.NONE);
  const [isNitroNow, setIsNitroNow] = useState(false);

  useEffect(() => {
    let id;
    const sync = () => {
      setActiveGesture(handStateRef.current.gesture);
      const gs = gsRef.current;
      setIsNitroNow(!!gs?.car?.nitroActive);
      id = requestAnimationFrame(sync);
    };
    id = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div style={styles.root}>
      {/* HUD */}
      <div style={styles.hud}>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            padding: '4px 10px', marginRight: 10,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
            fontSize: 12, cursor: 'pointer'
          }}
        >
          ← Home
        </button>
        <div style={styles.hudCard}>
          <div style={styles.hudLabel}>Distance</div>
          <div style={styles.hudVal} ref={hudDistRef}>0 m</div>
        </div>
        <div style={styles.hudCard}>
          <div style={styles.hudLabel}>Score</div>
          <div style={styles.hudVal} ref={hudScoreRef}>0</div>
        </div>
        <div style={styles.hudCard}>
          <div style={styles.hudLabel}>Coins</div>
          <div style={styles.hudVal} ref={hudCoinsRef}>0</div>
        </div>
        <div style={{ ...styles.hudCard, display: 'flex', alignItems: 'center', minWidth: 150 }}>
          <div>
            <div style={styles.hudLabel}>Fuel</div>
            <div style={styles.fuelWrap}>
              <div style={styles.fuelBg}>
                <div ref={hudFuelBarRef} style={{ height: '100%', background: '#22c55e', width: '100%', borderRadius: 5, transition: 'width 0.2s, background 0.3s' }} />
              </div>
              <span ref={hudFuelRef} style={{ fontSize: 11, color: '#64748b' }}>100%</span>
            </div>
          </div>
        </div>
        <div style={styles.hudCard}>
          <div style={styles.hudLabel}>Speed</div>
          <div style={styles.hudVal} ref={hudSpeedRef}>0 km/h</div>
        </div>
      </div>

      {/* Canvas area */}
      <div style={styles.gameWrap}>
        <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
        <canvas ref={handOverlayRef} style={styles.handOverlay} />

        <div style={{ ...styles.nitroVignette, opacity: isNitroNow ? 1 : 0 }} />

        <canvas ref={canvasRef} style={styles.canvas} />

        <div ref={overlayRef} style={styles.overlay}>
          <div style={styles.overlayBox}>
            <div ref={olTitleRef} style={styles.overlayTitle} />
            <div ref={olSubRef} style={styles.overlaySub} />
            <div ref={olStatsRef} />
            <button ref={olBtnRef} style={styles.startBtn} onClick={startGame}>
              Start Game
            </button>
          </div>
        </div>

        {/* Gesture HUD */}
        <div style={styles.gestureHints}>
          <div style={{ ...styles.gestureHint, opacity: activeGesture === GESTURES.DRAW ? 1 : 0.4, transform: activeGesture === GESTURES.DRAW ? 'scale(1.05)' : 'scale(1)' }}>
            <span style={{ fontSize: 16 }}>☝️</span> <span>Throttle</span>
          </div>
          <div style={{ ...styles.gestureHint, opacity: activeGesture === GESTURES.STOP ? 1 : 0.4 }}>
            <span style={{ fontSize: 16 }}>✋</span> <span>Brake</span>
          </div>
          <div style={{
            ...styles.gestureHint,
            opacity: activeGesture === GESTURES.PINCH ? 1 : 0.4,
            background: activeGesture === GESTURES.PINCH ? '#ecfdf5' : '#fff',
            borderColor: activeGesture === GESTURES.PINCH ? '#10b981' : '#e2e8f0',
            transform: activeGesture === GESTURES.PINCH ? 'scale(1.1)' : 'scale(1)'
          }}>
            <span style={{ fontSize: 16 }}>🤏</span> <span style={{ fontWeight: activeGesture === GESTURES.PINCH ? 700 : 400 }}>NITRO</span>
          </div>
          <div style={{ ...styles.gestureHint, opacity: activeGesture === GESTURES.PAN ? 1 : 0.4 }}>
            <span style={{ fontSize: 16 }}>✊</span> <span>Pause</span>
          </div>
        </div>
      </div>

      {/* Keyboard hints */}
      <div style={styles.controlsHint}>
        <span><span style={styles.keySpan}>→</span>Throttle</span>
        <span><span style={styles.keySpan}>←</span>Brake</span>
        <span><span style={styles.keySpan}>N</span>Nitro</span>
        <span><span style={styles.keySpan}>P</span>Pause</span>
        <span style={{ marginLeft: 'auto' }}>Collect coins · Grab fuel</span>
      </div>

      {/* Mobile touch controls */}
      <div style={styles.mobileRow}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.mobileBtn} {...bindTouch('brake')}>←</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...styles.mobileBtn, background: '#fef3c7', borderColor: '#fbbf24' }} {...bindTouch('nitro')}>🔥</button>
          <button style={styles.mobileBtnAccel} {...bindTouch('accelerate')}>→</button>
        </div>
      </div>
    </div>
  );
}
