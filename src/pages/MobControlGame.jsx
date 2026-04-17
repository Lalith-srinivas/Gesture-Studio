import React, { useRef, useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHandTracking } from "../hooks/useHandTracking";
import { GESTURES } from "../utils/gestureDetector";// ─────────────────────────────────────────────
// CONSTANTS & CONFIG
// ─────────────────────────────────────────────
const UNIT_RADIUS = 7;
const CROWD_SPREAD = 28;
const MOVE_SPEED = 1.3;
const GATE_WIDTH = 90;
const GATE_HEIGHT = 60;
const GATE_PAIR_INTERVAL = 340; // px between gate pairs on the "road"
const ROAD_WIDTH = 300;
const PARTICLE_COUNT = 18;

const LEVELS = [
  { enemyCount: 15, gateCount: 4, startCount: 10, label: "Level 1" },
  { enemyCount: 30, gateCount: 5, startCount: 10, label: "Level 2" },
  { enemyCount: 55, gateCount: 6, startCount: 12, label: "Level 3" },
  { enemyCount: 90, gateCount: 7, startCount: 14, label: "Level 4" },
  { enemyCount: 140, gateCount: 8, startCount: 16, label: "Level 5" },
];

const GATE_COLOR = "#48dbfb";
const GATE_GLOW = "#48dbfb88";

const GATE_OPS = [
  { label: "×2", fn: (n) => n * 2, color: GATE_COLOR, glow: GATE_GLOW },
  { label: "+10", fn: (n) => n + 10, color: GATE_COLOR, glow: GATE_GLOW },
  { label: "+5", fn: (n) => n + 5, color: GATE_COLOR, glow: GATE_GLOW },
  { label: "−5", fn: (n) => Math.max(1, n - 5), color: GATE_COLOR, glow: GATE_GLOW },
  { label: "−10", fn: (n) => Math.max(1, n - 10), color: GATE_COLOR, glow: GATE_GLOW },
  { label: "÷2", fn: (n) => Math.max(1, Math.floor(n / 2)), color: GATE_COLOR, glow: GATE_GLOW },
  { label: "+20", fn: (n) => n + 20, color: GATE_COLOR, glow: GATE_GLOW },
  { label: "×3", fn: (n) => n * 3, color: GATE_COLOR, glow: GATE_GLOW },
];

function pickGatePair(level) {
  const pool = [...GATE_OPS];
  const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  return [a, b];
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function lerp(a, b, t) { return a + (b - a) * t; }

// ─────────────────────────────────────────────
// UNIT POSITIONS LAYOUT
// ─────────────────────────────────────────────
function layoutUnits(count, cx, cy) {
  const units = [];
  if (count === 0) return units;
  const cols = Math.min(count, 6);
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const totalCols = Math.min(count - row * cols, cols);
    const offsetX = (col - (totalCols - 1) / 2) * CROWD_SPREAD;
    const offsetY = row * CROWD_SPREAD * 0.8; // tighter y spacing
    units.push({ x: cx + offsetX, y: cy + offsetY });
  }
  return units;
}

// ─────────────────────────────────────────────
// PARTICLE SYSTEM
// ─────────────────────────────────────────────
function spawnParticles(particles, x, y, color, count = PARTICLE_COUNT) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.025 + Math.random() * 0.02,
      color,
      r: 2 + Math.random() * 3,
    });
  }
}

function updateParticles(particles, timeScale = 1) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * timeScale;
    p.y += p.vy * timeScale;
    p.vy += 0.08 * timeScale;
    p.life -= p.decay * timeScale;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function MobControlGame() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const animRef = useRef(null);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const lastGestureRef = useRef(false);
  const activeGestureRef = useRef(GESTURES.NONE);
  const keysRef = useRef({ left: false, right: false });
  const [currentGesture, setCurrentGesture] = useState(GESTURES.NONE);

  // ── Initialize / reset game state ──
  function createGameState(levelIdx = 0) {
    const lvl = LEVELS[Math.min(levelIdx, LEVELS.length - 1)];
    const gates = [];
    for (let i = 0; i < lvl.gateCount; i++) {
      const pair = pickGatePair(levelIdx);
      gates.push({
        y: -(500 + i * GATE_PAIR_INTERVAL), // world coords (camera scrolls)
        left: pair[0],
        right: pair[1],
        passed: false,
        chosen: null, // 'left' | 'right'
        flash: 0,
      });
    }
    const battleY = -(500 + lvl.gateCount * GATE_PAIR_INTERVAL + 400);

    return {
      phase: "running", // running | choosing | battle | win | lose | levelComplete | gameOver
      levelIdx,
      levelLabel: lvl.label,
      crowdCount: lvl.startCount,
      crowdX: 0, // center x in world (always 0 for our road)
      crowdY: 0, // camera world Y (units rendered relative to camera)
      cameraY: 300, // camera offset: lower = further down the road
      targetCameraY: 300,
      gates,
      battleY,
      enemyCount: lvl.enemyCount,
      enemyStartCount: lvl.enemyCount,
      battleStarted: false,
      battleDone: false,
      battleTimer: 0,
      particles: [],
      score: 0,
      highScore: parseInt(localStorage.getItem("mobHighScore") || "0"),
      pendingGate: null, // gate awaiting choice
      choiceTimer: 0,
      winTimer: 0,
      flashMsg: "",
      flashAlpha: 0,
      unitTargets: [], // animated unit positions
    };
  }

  function initState() {
    const savedLevel = parseInt(localStorage.getItem("mobLevel") || "0", 10);
    stateRef.current = createGameState(savedLevel);
    stateRef.current.score = 0;
  }

  // ── ABSTRACT INPUT SYSTEM ──
  function applyGate(s, gate, side) {
    gate.chosen = side;
    gate.passed = true;
    gate.flash = 1;
    const op = side === "left" ? gate.left : gate.right;
    const before = s.crowdCount;
    s.crowdCount = Math.max(1, op.fn(s.crowdCount));
    const cx = canvasRef.current ? canvasRef.current.width / 2 : 200;
    const cy = canvasRef.current ? canvasRef.current.height * 0.6 : 300;
    const spawnX = cx + s.crowdX;
    if (s.crowdCount > before) {
      spawnParticles(s.particles, spawnX, cy, "#00e5ff", 22);
      showFlash(s, `${op.label}  ➜  ${s.crowdCount} units!`, "#00e5ff");
    } else if (s.crowdCount < before) {
      spawnParticles(s.particles, spawnX, cy, "#ff6b6b", 16);
      showFlash(s, `${op.label}  ➜  ${s.crowdCount} units`, "#ff6b6b");
    } else {
      showFlash(s, `${op.label}`, "#fff");
    }
    s.score += Math.floor(s.crowdCount * 0.5);
  }

  function showFlash(s, msg, color) {
    s.flashMsg = msg;
    s.flashColor = color;
    s.flashAlpha = 1;
  }

  // ── GAME LOOP ──
  function gameLoop() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;
    if (!s) return;

    updateGame(s, canvas);
    renderGame(ctx, s, canvas);

    animRef.current = requestAnimationFrame(gameLoop);
  }

  function updateGame(s, canvas) {
    if (s.phase === "running") {
      // Movement logic
      let dx = 0;
      if (keysRef.current.left || activeGestureRef.current === GESTURES.ERASE) dx = -1;
      if (keysRef.current.right || activeGestureRef.current === GESTURES.DRAW) dx = 1;
      s.crowdX += dx * 6.5;
      s.crowdX = clamp(s.crowdX, -ROAD_WIDTH / 2 + 25, ROAD_WIDTH / 2 - 25);

      // Scroll camera forward
      s.cameraY += MOVE_SPEED;
      s.targetCameraY = s.cameraY;

      // Check gate proximity
      for (const gate of s.gates) {
        if (gate.passed) continue;
        const screenY = canvas.height * 0.6 + (gate.y + s.cameraY);
        if (gate.flash > 0) gate.flash = Math.max(0, gate.flash - 0.04);
        
        // Pass gate automatically based on current X position
        if (screenY >= canvas.height * 0.6 && screenY < canvas.height * 0.6 + 50) {
           applyGate(s, gate, s.crowdX < 0 ? "left" : "right");
        }
      }

      // Check battle zone
      const battleScreenY = canvas.height * 0.6 + (s.battleY + s.cameraY);
      if (battleScreenY > canvas.height * 0.45 && !s.battleStarted) {
        s.battleStarted = true;
        s.phase = "battle";
        s.crowdX = 0; // Move back to center for battle
        spawnParticles(s.particles, canvas.width / 2, canvas.height * 0.5, "#ff4444", 30);
      }

      updateParticles(s.particles, 1);
      // Flash decay
      if (s.flashAlpha > 0) s.flashAlpha = Math.max(0, s.flashAlpha - 0.018);
    }

    if (s.phase === "battle") {
      s.battleTimer++;
      updateParticles(s.particles, 0.25); // SLOW MOTION PARTICLES 🎬

      // Slow down unit deaths for slow motion effect
      if (s.battleTimer % 24 === 0 && !s.battleDone) {
        const cx = canvas.width / 2;
        const cy = canvas.height * 0.5;
        if (s.crowdCount > 0 && s.enemyCount > 0) {
          const playerLoss = Math.max(0, Math.ceil(s.enemyCount * 0.12));
          const enemyLoss = Math.max(0, Math.ceil(s.crowdCount * 0.12));
          s.crowdCount = Math.max(0, s.crowdCount - playerLoss);
          s.enemyCount = Math.max(0, s.enemyCount - enemyLoss);
          if (playerLoss > 0) spawnParticles(s.particles, cx - 60, cy, "#3a7bd5", 6);
          if (enemyLoss > 0) spawnParticles(s.particles, cx + 60, cy, "#ff6b6b", 6);
        }

        if (s.crowdCount === 0 || s.enemyCount === 0) {
          s.battleDone = true;
          if (s.crowdCount > 0) {
            // WIN
            s.score += s.crowdCount * 10 + 200;
            spawnParticles(s.particles, cx, cy, "#ffd700", 40);
            showFlash(s, "VICTORY! 🏆", "#ffd700");
            s.phase = "levelComplete";
          } else {
            showFlash(s, "DEFEATED 💀", "#ff4444");
            s.phase = "lose";
          }
          if (s.score > s.highScore) {
            s.highScore = s.score;
            localStorage.setItem("mobHighScore", s.highScore);
          }
          s.winTimer = 0;
        }
      }
    }

    if (s.phase === "levelComplete" || s.phase === "lose" || s.phase === "gameOver") {
      s.winTimer++;
      updateParticles(s.particles, 1);
      if (s.flashAlpha > 0) s.flashAlpha = Math.max(0, s.flashAlpha - 0.006);
    }
  }

  // ── RENDER ──
  function renderGame(ctx, s, canvas) {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0f0c29");
    sky.addColorStop(0.5, "#302b63");
    sky.addColorStop(1, "#24243e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    // We use a seeded simple star pattern
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 137 + 41) % W);
      const sy = ((i * 71 + 13) % (H * 0.7));
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const cx = W / 2;
    const crowdScreenY = H * 0.6;

    // Road
    drawRoad(ctx, s, W, H, cx, crowdScreenY);

    // Gates
    for (const gate of s.gates) {
      const gy = crowdScreenY + (gate.y + s.cameraY);
      if (gy < -80 || gy > H + 80) continue;
      drawGate(ctx, gate, cx, gy, W);
    }

    // Battle zone
    if (s.battleStarted || s.phase === "battle" || s.phase === "levelComplete" || s.phase === "lose") {
      const by = crowdScreenY + (s.battleY + s.cameraY);
      if (by > -100 && by < H + 100) {
        drawBattleZone(ctx, s, cx, by, W, H);
      }
    }

    // Player crowd
    if (s.phase === "running" || s.phase === "battle" || s.phase === "levelComplete") {
      drawCrowd(ctx, s.crowdCount, cx + s.crowdX, crowdScreenY, "#3a7bd5", "#74b9ff");
    }

    // Particles
    drawParticles(ctx, s.particles);

    // HUD
    drawHUD(ctx, s, W, H);

    // Flash message
    if (s.flashAlpha > 0.01) {
      ctx.globalAlpha = s.flashAlpha;
      ctx.font = `bold ${clamp(W * 0.055, 20, 36)}px 'Segoe UI', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = s.flashColor || "#fff";
      ctx.shadowColor = s.flashColor || "#fff";
      ctx.shadowBlur = 18;
      ctx.fillText(s.flashMsg, cx, H * 0.35);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Overlays
    if (s.phase === "levelComplete") {
      drawOverlay(ctx, W, H, "LEVEL COMPLETE! 🏆", `Score: ${s.score}`, "#ffd700", "Press SPACE / Tap to continue");
    } else if (s.phase === "lose") {
      drawOverlay(ctx, W, H, "DEFEATED 💀", `Score: ${s.score}`, "#ff6b6b", "Press SPACE / Tap to restart");
    } else if (s.phase === "gameOver") {
      drawOverlay(ctx, W, H, "GAME OVER", `Final Score: ${s.score}\nHigh Score: ${s.highScore}`, "#ff9f43", "Press SPACE / Tap to play again");
    }
  }

  function drawRoad(ctx, s, W, H, cx, crowdScreenY) {
    const roadLeft = cx - ROAD_WIDTH / 2;
    const roadRight = cx + ROAD_WIDTH / 2;

    // Road surface
    const roadGrad = ctx.createLinearGradient(roadLeft, 0, roadRight, 0);
    roadGrad.addColorStop(0, "#1a1a2e");
    roadGrad.addColorStop(0.5, "#16213e");
    roadGrad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = roadGrad;
    ctx.fillRect(roadLeft, 0, ROAD_WIDTH, H);

    // Road edges
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(roadLeft, 0); ctx.lineTo(roadLeft, H);
    ctx.moveTo(roadRight, 0); ctx.lineTo(roadRight, H);
    ctx.stroke();

    // Dashed center line scrolling
    const dashOffset = s.cameraY % 60;
    ctx.setLineDash([30, 30]);
    ctx.lineDashOffset = dashOffset;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawGate(ctx, gate, cx, gy, W) {
    const lx = cx - ROAD_WIDTH / 2 + 10;
    const rx = cx + 30;
    const gw = ROAD_WIDTH / 2 - 40;
    const gh = GATE_HEIGHT;

    const drawSingleGate = (x, op, side) => {
      const chosen = gate.chosen === side;
      const other = gate.chosen && gate.chosen !== side;
      const alpha = other ? 0.35 : 1;
      ctx.globalAlpha = alpha;

      // Glow
      if (!other) {
        ctx.shadowColor = op.glow;
        ctx.shadowBlur = gate.flash > 0 && chosen ? 40 : 16;
      }

      // Gate body
      const gr = ctx.createLinearGradient(x, gy - gh / 2, x, gy + gh / 2);
      gr.addColorStop(0, op.color + "33");
      gr.addColorStop(0.5, op.color + "66");
      gr.addColorStop(1, op.color + "33");
      ctx.fillStyle = gr;
      ctx.beginPath();
      roundRect(ctx, x, gy - gh / 2, gw, gh, 12);
      ctx.fill();

      // Gate border
      ctx.strokeStyle = op.color;
      ctx.lineWidth = chosen ? 3 : 1.5;
      ctx.beginPath();
      roundRect(ctx, x, gy - gh / 2, gw, gh, 12);
      ctx.stroke();

      // Label
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${clamp(gw * 0.28, 16, 26)}px 'Courier New', monospace`;
      ctx.textAlign = "center";
      ctx.fillText(op.label, x + gw / 2, gy + 8);

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    drawSingleGate(lx, gate.left, "left");
    drawSingleGate(rx, gate.right, "right");
  }

  function drawCrowd(ctx, count, cx, cy, colorDark, colorLight) {
    if (count <= 0) return;
    const units = layoutUnits(count, cx, cy);
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const grad = ctx.createRadialGradient(u.x - 2, u.y - 2, 1, u.x, u.y, UNIT_RADIUS);
      grad.addColorStop(0, colorLight);
      grad.addColorStop(1, colorDark);
      ctx.fillStyle = grad;
      ctx.shadowColor = colorLight;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(u.x, u.y, UNIT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Count badge
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${clamp(20, 14, 24)}px 'Courier New', monospace`;
    ctx.textAlign = "center";
    ctx.shadowColor = colorDark;
    ctx.shadowBlur = 8;
    ctx.fillText(count, cx, cy - UNIT_RADIUS * 4 - 8);
    ctx.shadowBlur = 0;
  }

  function drawBattleZone(ctx, s, cx, by, W, H) {
    // Battle line
    ctx.strokeStyle = "rgba(255,100,100,0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(cx - ROAD_WIDTH / 2, by);
    ctx.lineTo(cx + ROAD_WIDTH / 2, by);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,80,80,0.15)";
    ctx.font = `bold 13px 'Courier New', monospace`;
    ctx.textAlign = "center";
    ctx.fillText("⚔ BATTLE ZONE", cx, by - 10);

    // Enemy crowd (above battle line)
    if (s.enemyCount > 0) {
      drawCrowd(ctx, s.enemyCount, cx, by - 60, "#c0392b", "#ff6b6b");
    }
  }

  function drawHUD(ctx, s, W, H) {
    // Top bar
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, 10, 10, W - 20, 52, 10);
    ctx.fill();

    ctx.font = `bold ${clamp(W * 0.038, 13, 18)}px 'Courier New', monospace`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffd700";
    ctx.fillText(`⭐ ${s.score}`, 22, 38);

    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText(s.levelLabel, W / 2, 38);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(`HI ${s.highScore}`, W - 22, 38);

    // Crowd counter pill
    ctx.fillStyle = "rgba(58,123,213,0.8)";
    roundRect(ctx, W / 2 - 40, H - 68, 80, 34, 17);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold 16px 'Courier New', monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`👥 ${s.crowdCount}`, W / 2, H - 45);

    // Controls hint
    if (s.phase === "running") {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = `bold 14px 'Courier New', monospace`;
      ctx.textAlign = "center";
      ctx.fillText("✌️ (Two Fingers) = Left   |   ☝️ (Index) = Right", W / 2, H - 16);
    }
  }

  function drawOverlay(ctx, W, H, title, body, color, hint) {
    // Dim
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, W, H);

    // Card
    const cw = Math.min(W - 40, 340);
    const ch = 200;
    const cx = W / 2;
    const cy = H / 2;
    ctx.fillStyle = "rgba(20,20,40,0.97)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 18);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = color;
    ctx.font = `bold ${clamp(W * 0.065, 22, 34)}px 'Courier New', monospace`;
    ctx.textAlign = "center";
    ctx.fillText(title, cx, cy - 30);

    ctx.fillStyle = "#fff";
    ctx.font = `${clamp(W * 0.04, 14, 20)}px 'Segoe UI', sans-serif`;
    const lines = body.split("\n");
    lines.forEach((line, i) => ctx.fillText(line, cx, cy + 14 + i * 26));

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `12px 'Courier New', monospace`;
    ctx.fillText(hint, cx, cy + ch / 2 - 16);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── RESIZE ──
  function resizeCanvas() {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }

  // ── ADVANCE LEVEL / RESTART ──
  function advanceLevel() {
    const s = stateRef.current;
    if (!s) return;
    const nextLevel = s.levelIdx + 1;
    if (nextLevel >= LEVELS.length) {
      stateRef.current = { ...createGameState(0), phase: "gameOver", score: s.score, highScore: s.highScore };
      localStorage.setItem("mobLevel", "0");
    } else {
      localStorage.setItem("mobLevel", String(nextLevel));
      const prevScore = s.score;
      const prevHigh = s.highScore;
      stateRef.current = createGameState(nextLevel);
      stateRef.current.score = prevScore;
      stateRef.current.highScore = prevHigh;
    }
  }

  function restartGame() {
    const s = stateRef.current;
    const highScore = s ? s.highScore : 0;
    const levelIdx = s ? s.levelIdx : parseInt(localStorage.getItem("mobLevel") || "0", 10);
    stateRef.current = createGameState(levelIdx);
    stateRef.current.highScore = highScore;
  }

  // ── INPUT HANDLING ──
  useEffect(() => {
    const onKeyDown = (e) => {
      const s = stateRef.current;
      if (!s) return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") keysRef.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") keysRef.current.right = true;
      if (e.code === "Space" || e.code === "Enter") {
        if (s.phase === "levelComplete") advanceLevel();
        else if (s.phase === "lose" || s.phase === "gameOver") restartGame();
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keysRef.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keysRef.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ── TOUCH / MOUSE ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerAction = (clientX) => {
      const s = stateRef.current;
      if (!s) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const W = canvas.width;

      if (s.phase === "running") {
        keysRef.current.left = x < W / 2;
        keysRef.current.right = x >= W / 2;
      } else if (s.phase === "levelComplete") {
        advanceLevel();
      } else if (s.phase === "lose" || s.phase === "gameOver") {
        restartGame();
      }
    };

    const stopPointerAction = () => {
      keysRef.current.left = false;
      keysRef.current.right = false;
    };

    const onTouch = (e) => {
      e.preventDefault();
      handlePointerAction(e.changedTouches[0].clientX);
    };
    const onTouchEnd = (e) => {
      e.preventDefault();
      stopPointerAction();
    };
    const onMouseDown = (e) => handlePointerAction(e.clientX);
    const onMouseUp = () => stopPointerAction();

    canvas.addEventListener("touchstart", onTouch, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      canvas.removeEventListener("touchstart", onTouch);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // ── RESIZE OBSERVER ──
  useEffect(() => {
    const observer = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) observer.observe(containerRef.current);
    resizeCanvas();
    return () => observer.disconnect();
  }, []);

  // ── BOOT GAME LOOP ──
  useEffect(() => {
    initState();
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // ── GESTURE INTEGRATION POINT ──
  const handleGesture = useCallback((gesture) => {
    setCurrentGesture((prev) => (prev !== gesture ? gesture : prev));
    activeGestureRef.current = gesture;

    const isAction = gesture === GESTURES.DRAW || gesture === GESTURES.ERASE;

    if (isAction && !lastGestureRef.current) {
      lastGestureRef.current = true;
      const s = stateRef.current;
      if (!s) return;
      if (s.phase === "levelComplete") {
        advanceLevel();
      } else if (s.phase === "lose" || s.phase === "gameOver") {
        restartGame();
      }
    } else if (!isAction && gesture !== GESTURES.NONE) {
      // Clear action block
      lastGestureRef.current = false;
    }
  }, []);

  useHandTracking({
    videoRef,
    onGesture: handleGesture,
  });

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100dvh",
        background: "#0f0c29",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
      }}
      className="relative"
    >
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-zinc-300 hover:text-white z-50 backdrop-blur-md border border-white/10"
        title="Back to Home"
      >
        ←
      </button>

      {/* Pip camera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 140,
          height: 105,
          borderRadius: 12,
          border: '2px solid rgba(255,255,255,0.15)',
          zIndex: 50,
          transform: 'scaleX(-1)',
          opacity: 0.6,
          pointerEvents: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          background: '#000',
        }}
      />

      <div className="fixed bottom-[140px] right-5 z-50 flex flex-col gap-1.5 pointer-events-none">
        {[
          { emoji: '✌️', label: 'Left', active: currentGesture === GESTURES.ERASE },
          { emoji: '☝️', label: 'Right', active: currentGesture === GESTURES.DRAW },
        ].map((h) => (
          <div
            key={h.label}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm
              border transition-all duration-200 shadow-sm
              ${h.active 
                ? 'bg-violet-500/30 text-violet-200 border-violet-500/50 scale-105' 
                : 'bg-black/40 text-zinc-400 border-white/5 scale-100'}
            `}
          >
            <span className="text-sm">{h.emoji}</span>
            <span>{h.label}</span>
          </div>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          cursor: "pointer",
        }}
      />
    </div>
  );
}
