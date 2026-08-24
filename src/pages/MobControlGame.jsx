import React, { useRef, useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHandTracking } from "../hooks/useHandTracking";
import { GESTURES } from "../utils/gestureDetector";
import { playPlusSound, playFightSound, resumeAudio } from "../utils/soundEffects";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG & GAME LEVELS
// ─────────────────────────────────────────────────────────────────────────────
const FORWARD_SPEED = 0.055;
const GATE_SPACING = 8.5; // Z units between gates

const LEVELS = [
  { enemyCount: 15, gateCount: 4, startCount: 3, label: "Level 1" },
  { enemyCount: 30, gateCount: 5, startCount: 5, label: "Level 2" },
  { enemyCount: 60, gateCount: 6, startCount: 6, label: "Level 3" },
  { enemyCount: 95, gateCount: 7, startCount: 8, label: "Level 4" },
  { enemyCount: 150, gateCount: 8, startCount: 10, label: "Level 5" },
];

const POSITIVE_OPS = [
  { label: "+20", fn: (n) => n + 20, isPositive: true },
  { label: "+15", fn: (n) => n + 15, isPositive: true },
  { label: "+10", fn: (n) => n + 10, isPositive: true },
  { label: "+25", fn: (n) => n + 25, isPositive: true },
  { label: "×2", fn: (n) => n * 2, isPositive: true },
  { label: "×3", fn: (n) => n * 3, isPositive: true },
];

const NEGATIVE_OPS = [
  { label: "-15", fn: (n) => Math.max(1, n - 15), isPositive: false },
  { label: "-09", fn: (n) => Math.max(1, n - 9), isPositive: false },
  { label: "-05", fn: (n) => Math.max(1, n - 5), isPositive: false },
  { label: "-20", fn: (n) => Math.max(1, n - 20), isPositive: false },
  { label: "÷2", fn: (n) => Math.max(1, Math.floor(n / 2)), isPositive: false },
];

function pickGatePair() {
  const neg = NEGATIVE_OPS[Math.floor(Math.random() * NEGATIVE_OPS.length)];
  const pos = POSITIVE_OPS[Math.floor(Math.random() * POSITIVE_OPS.length)];
  const leftIsPos = Math.random() < 0.35;
  return {
    left: leftIsPos ? pos : neg,
    right: leftIsPos ? neg : pos,
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─────────────────────────────────────────────────────────────────────────────
// 3D PROJECTION MATH (ZOOMED-IN PERSPECTIVE)
// ─────────────────────────────────────────────────────────────────────────────
function project3D(x, z, W, H) {
  // z: 0.4 (near) to 24 (horizon)
  const clampedZ = Math.max(0.2, z);
  const horizonY = H * 0.02; // Horizon positioned high up
  
  // Smooth, zoomed-in perspective decay
  const scale = 1 / (clampedZ * 0.16 + 0.84);
  const screenY = horizonY + (H - horizonY) * Math.pow(scale, 1.12);
  
  // Wide road perspective: from 32% of W at horizon to 92% at screen bottom
  const roadWidth = W * (0.32 + 0.62 * scale);
  const screenX = W / 2 + x * (roadWidth / 2);

  return { x: screenX, y: screenY, scale, roadWidth };
}

// Layout units in a cluster around center
function getCrowdPositions(count, cx, cz) {
  const positions = [];
  if (count <= 0) return positions;
  
  // Natural 3D cluster with proportional spacing
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      positions.push({ x: cx, z: cz });
      continue;
    }
    const angle = i * 2.39996;
    const dist = Math.sqrt(i) * 0.062;
    positions.push({
      x: cx + Math.cos(angle) * dist * 0.72,
      z: cz + Math.sin(angle) * dist * 0.95,
    });
  }
  return positions;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D PROCEDURAL DRAWING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// Draw 3D animated running humanoid stickman / gummy runner (Zoomed & Scaled up)
function draw3DRunner(ctx, x, y, scale, color, runCycle) {
  const headRadius = 13.5 * scale;
  const torsoHeight = 25 * scale;
  const legLength = 24 * scale;
  const armLength = 20 * scale;

  ctx.save();

  // 1. Ground Drop Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ctx.beginPath();
  ctx.ellipse(x - 2 * scale, y + 2 * scale, 19 * scale, 6.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Color shades
  const isRed = color === "red";
  const mainColor = isRed ? "#ff2a2a" : "#00d2ff";
  const darkColor = isRed ? "#990000" : "#006494";
  const lightColor = isRed ? "#ff9999" : "#cbf3f0";

  // Running Stride Angles
  const legAngle1 = Math.sin(runCycle) * 0.85;
  const legAngle2 = Math.sin(runCycle + Math.PI) * 0.85;
  const armAngle1 = Math.sin(runCycle + Math.PI) * 0.85;
  const armAngle2 = Math.sin(runCycle) * 0.85;

  const hipY = y - legLength;
  const neckY = hipY - torsoHeight;
  const headY = neckY - headRadius;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 2. Back Leg & Arm
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = 7.5 * scale;

  // Back Leg
  ctx.beginPath();
  ctx.moveTo(x + 3 * scale, hipY);
  ctx.lineTo(x + 3 * scale + Math.sin(legAngle2) * legLength * 0.7, hipY + Math.cos(legAngle2) * legLength * 0.7);
  ctx.lineTo(x + 3 * scale + Math.sin(legAngle2) * legLength, hipY + legLength);
  ctx.stroke();

  // Back Arm
  ctx.beginPath();
  ctx.moveTo(x, neckY + 4 * scale);
  ctx.lineTo(x + Math.sin(armAngle2) * armLength, neckY + 4 * scale + Math.cos(armAngle2) * armLength);
  ctx.stroke();

  // 3. Torso
  const torsoGrad = ctx.createLinearGradient(x, neckY, x, hipY);
  torsoGrad.addColorStop(0, lightColor);
  torsoGrad.addColorStop(1, mainColor);
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.roundRect(x - 7 * scale, neckY, 14 * scale, torsoHeight, 6 * scale);
  ctx.fill();
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = 1.8 * scale;
  ctx.stroke();

  // 4. Front Leg
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 8.5 * scale;
  ctx.beginPath();
  ctx.moveTo(x - 3 * scale, hipY);
  ctx.lineTo(x - 3 * scale + Math.sin(legAngle1) * legLength * 0.7, hipY + Math.cos(legAngle1) * legLength * 0.7);
  ctx.lineTo(x - 3 * scale + Math.sin(legAngle1) * legLength, hipY + legLength);
  ctx.stroke();

  // 5. Front Arm
  ctx.beginPath();
  ctx.moveTo(x, neckY + 4 * scale);
  ctx.lineTo(x + Math.sin(armAngle1) * armLength, neckY + 4 * scale + Math.cos(armAngle1) * armLength);
  ctx.stroke();

  // 6. 3D Head with Specular Highlight
  const headGrad = ctx.createRadialGradient(
    x - headRadius * 0.35, headY - headRadius * 0.35, headRadius * 0.1,
    x, headY, headRadius
  );
  headGrad.addColorStop(0, "#ffffff");
  headGrad.addColorStop(0.35, lightColor);
  headGrad.addColorStop(0.8, mainColor);
  headGrad.addColorStop(1, darkColor);

  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(x, headY, headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function MobControlGame() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const stateRef = useRef(null);
  const animRef = useRef(null);
  const activeGestureRef = useRef(GESTURES.NONE);
  const keysRef = useRef({ left: false, right: false });
  const [currentGesture, setCurrentGesture] = useState(GESTURES.NONE);

  function createGameState(levelIdx = 0) {
    const lvl = LEVELS[Math.min(levelIdx, LEVELS.length - 1)];
    const gates = [];
    for (let i = 0; i < lvl.gateCount; i++) {
      const pair = pickGatePair();
      gates.push({
        z: 4.5 + i * GATE_SPACING,
        left: pair.left,
        right: pair.right,
        passed: false,
        flash: 0,
      });
    }
    const battleZ = 4.5 + lvl.gateCount * GATE_SPACING + 3;

    return {
      phase: "running", // running | battle | win | lose
      levelIdx,
      levelLabel: lvl.label,
      playerCount: lvl.startCount,
      playerX: 0, // -0.7 to 0.7
      targetPlayerX: 0,
      playerZ: 1.0,
      progress: 0,
      gates,
      battleZ,
      enemyCount: lvl.enemyCount,
      enemyStartCount: lvl.enemyCount,
      enemyZ: battleZ,
      battleTimer: 0,
      particles: [],
      score: 0,
      highScore: parseInt(localStorage.getItem("mobHighScore") || "0", 10),
      flashMsg: "",
      flashColor: "#fff",
      flashAlpha: 0,
      waveOffset: 0,
    };
  }

  function applyGate(s, gate, side) {
    playPlusSound();
    gate.passed = true;
    gate.flash = 1;
    const op = side === "left" ? gate.left : gate.right;
    const before = s.playerCount;
    s.playerCount = Math.max(1, op.fn(s.playerCount));
    
    if (s.playerCount > before) {
      s.flashMsg = `${op.label}  ➔  ${s.playerCount} RUNNERS!`;
      s.flashColor = "#00f0ff";
      s.flashAlpha = 1;
      s.score += (s.playerCount - before) * 15;
    } else {
      s.flashMsg = `${op.label}  ➔  ${s.playerCount} RUNNERS`;
      s.flashColor = "#ff4444";
      s.flashAlpha = 1;
    }
  }

  // ── GAME LOOP ──
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;
    if (!s) return;

    const W = canvas.width;
    const H = canvas.height;

    // ── 1. UPDATE ──
    s.waveOffset += 0.03;

    if (s.phase === "running") {
      // Horizontal steer
      let dx = 0;
      if (keysRef.current.left || activeGestureRef.current === GESTURES.ERASE) dx = -1;
      if (keysRef.current.right || activeGestureRef.current === GESTURES.DRAW) dx = 1;
      s.targetPlayerX += dx * 0.045;
      s.targetPlayerX = clamp(s.targetPlayerX, -0.68, 0.68);
      s.playerX += (s.targetPlayerX - s.playerX) * 0.18;

      // Move forward along the bridge
      s.progress += FORWARD_SPEED;

      // Gate collisions
      for (const gate of s.gates) {
        const relativeZ = gate.z - s.progress;
        if (relativeZ < s.playerZ && !gate.passed) {
          applyGate(s, gate, s.playerX < 0 ? "left" : "right");
        }
      }

      // Check battle zone trigger
      if (s.battleZ - s.progress <= s.playerZ + 1.2) {
        s.phase = "battle";
        s.flashMsg = "⚔️ CLASH! BATTLE MOB!";
        s.flashColor = "#ff3333";
        s.flashAlpha = 1;
      }
    }

    if (s.phase === "battle") {
      s.battleTimer++;
      s.playerX += (0 - s.playerX) * 0.1; // merge to center

      // Slow-motion runner clashing
      if (s.battleTimer % 4 === 0 && s.playerCount > 0 && s.enemyCount > 0) {
        playFightSound();
        const pLoss = Math.max(1, Math.ceil(s.enemyCount * 0.04));
        const eLoss = Math.max(1, Math.ceil(s.playerCount * 0.04));
        s.playerCount = Math.max(0, s.playerCount - pLoss);
        s.enemyCount = Math.max(0, s.enemyCount - eLoss);

        // Spawn clash particles
        const p = project3D(0, 1.2, W, H);
        for (let i = 0; i < 4; i++) {
          s.particles.push({
            x: p.x + (Math.random() - 0.5) * 40,
            y: p.y - 20 + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            life: 1,
            color: Math.random() < 0.5 ? "#00f0ff" : "#ff3333",
          });
        }
      }

      if (s.playerCount === 0 || s.enemyCount === 0) {
        if (s.playerCount > 0) {
          s.phase = "win";
          s.score += s.playerCount * 25 + 500;
          if (s.score > s.highScore) {
            s.highScore = s.score;
            localStorage.setItem("mobHighScore", String(s.highScore));
          }
        } else {
          s.phase = "lose";
        }
      }
    }

    // Update particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life -= 0.035;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    if (s.flashAlpha > 0) s.flashAlpha = Math.max(0, s.flashAlpha - 0.02);

    // ── 2. RENDER 3D SCENE ──
    ctx.clearRect(0, 0, W, H);

    // A. Sky & Ocean Background
    drawSkyAndOcean(ctx, W, H, s.waveOffset);

    // B. Bridge Concrete Deck & Lane Markings
    draw3DBridge(ctx, W, H, s.progress);

    // C. Render 3D Objects Sorted by Depth (Far to Near)
    // Gather all gates, enemy runners, and player runners
    const renderList = [];

    // Add gates
    for (const gate of s.gates) {
      const relZ = gate.z - s.progress;
      if (relZ > 0.3 && relZ < 26) {
        renderList.push({ type: "gate", z: relZ, gate });
      }
    }

    // Add Enemy Runners
    if (s.enemyCount > 0) {
      const enemyRelZ = s.battleZ - s.progress;
      if (enemyRelZ > 0.4 && enemyRelZ < 26) {
        const positions = getCrowdPositions(s.enemyCount, 0, enemyRelZ);
        positions.forEach((pos, idx) => {
          renderList.push({
            type: "enemy",
            z: pos.z,
            x: pos.x,
            runCycle: (s.progress * 12 + idx * 0.8),
          });
        });
      }
    }

    // Add Player Runners
    if (s.playerCount > 0) {
      const positions = getCrowdPositions(s.playerCount, s.playerX, s.playerZ);
      positions.forEach((pos, idx) => {
        renderList.push({
          type: "player",
          z: pos.z,
          x: pos.x,
          runCycle: (s.progress * 14 + idx * 0.7),
        });
      });
    }

    // Sort by depth (farthest first)
    renderList.sort((a, b) => b.z - a.z);

    // Draw sorted objects
    for (const item of renderList) {
      if (item.type === "gate") {
        draw3DGate(ctx, item.gate, item.z, W, H);
      } else if (item.type === "enemy") {
        const p = project3D(item.x, item.z, W, H);
        draw3DRunner(ctx, p.x, p.y, p.scale, "red", item.runCycle);
      } else if (item.type === "player") {
        const p = project3D(item.x, item.z, W, H);
        draw3DRunner(ctx, p.x, p.y, p.scale, "blue", item.runCycle);
      }
    }

    // D. Particles
    for (const p of s.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // E. 3D "PICK YOUR LINE" Bottom Banner (as in screenshot)
    drawBottomPrompt(ctx, W, H, s.phase);

    // F. Top HUD (Score, Level, Count)
    drawHUD(ctx, s, W, H);

    // G. Flash Overlay Message
    if (s.flashAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = s.flashAlpha;
      ctx.font = `900 ${clamp(W * 0.06, 20, 32)}px "Space Grotesk", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = s.flashColor;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
      ctx.strokeText(s.flashMsg, W / 2, H * 0.4);
      ctx.fillText(s.flashMsg, W / 2, H * 0.4);
      ctx.restore();
    }

    // H. Victory / Defeat Overlays
    if (s.phase === "win") {
      drawModal(ctx, W, H, "VICTORY! 🏆", `Level Cleared!\nScore: ${s.score}`, "#FFE600", "▶ NEXT LEVEL");
    } else if (s.phase === "lose") {
      drawModal(ctx, W, H, "DEFEATED 💀", `The mob fell in battle!\nFinal Score: ${s.score}`, "#FF4D4D", "↺ PLAY AGAIN");
    }

    animRef.current = requestAnimationFrame(gameLoop);
  }, []);

  // ── DRAW SKY & OCEAN ──
  function drawSkyAndOcean(ctx, W, H, waveOffset) {
    const horizonY = H * 0.055;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, "#8ed4f8");
    sky.addColorStop(1, "#ccebfb");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizonY);

    // Ocean Water
    const ocean = ctx.createLinearGradient(0, horizonY, 0, H);
    ocean.addColorStop(0, "#0077b6");
    ocean.addColorStop(0.5, "#0096c7");
    ocean.addColorStop(1, "#023e8a");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // Sparkling Wave Patterns
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1.5;
    for (let y = horizonY + 10; y < H; y += 22) {
      const freq = 0.015;
      const phase = waveOffset * 2 + y * 0.05;
      ctx.beginPath();
      for (let x = 0; x < W; x += 15) {
        const wy = y + Math.sin(x * freq + phase) * 3;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
  }

  // ── DRAW 3D BRIDGE ROAD ──
  function draw3DBridge(ctx, W, H, progress) {
    const near = project3D(0, 0.3, W, H);
    const far = project3D(0, 24, W, H);

    const nearLeft = W / 2 - near.roadWidth / 2;
    const nearRight = W / 2 + near.roadWidth / 2;
    const farLeft = W / 2 - far.roadWidth / 2;
    const farRight = W / 2 + far.roadWidth / 2;

    // Concrete Bridge Road Deck
    ctx.save();
    const roadGrad = ctx.createLinearGradient(0, far.y, 0, near.y);
    roadGrad.addColorStop(0, "#d5dbe0");
    roadGrad.addColorStop(0.4, "#e2e6ea");
    roadGrad.addColorStop(1, "#edf0f2");
    ctx.fillStyle = roadGrad;

    ctx.beginPath();
    ctx.moveTo(farLeft, far.y);
    ctx.lineTo(farRight, far.y);
    ctx.lineTo(nearRight, near.y);
    ctx.lineTo(nearLeft, near.y);
    ctx.closePath();
    ctx.fill();

    // Road Edge Curbs
    ctx.strokeStyle = "#343a40";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Side Red/White Safety Railing Posts in Perspective
    const postCount = 20;
    for (let i = 0; i < postCount; i++) {
      const z = 0.5 + i * 1.2 - (progress % 1.2);
      if (z < 0.3 || z > 23) continue;
      const p = project3D(0, z, W, H);
      const postH = 42 * p.scale;
      const lx = W / 2 - p.roadWidth / 2;
      const rx = W / 2 + p.roadWidth / 2;

      // Left Post
      ctx.fillStyle = i % 2 === 0 ? "#dc2626" : "#ffffff";
      ctx.fillRect(lx - 7 * p.scale, p.y - postH, 7 * p.scale, postH);
      ctx.strokeRect(lx - 7 * p.scale, p.y - postH, 7 * p.scale, postH);

      // Right Post
      ctx.fillRect(rx, p.y - postH, 7 * p.scale, postH);
      ctx.strokeRect(rx, p.y - postH, 7 * p.scale, postH);
    }

    // Bridge Suspension Cables (Top Corners Angling Down)
    ctx.strokeStyle = "#5a6268";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(nearLeft + 12, near.y);
    ctx.moveTo(W, 0); ctx.lineTo(nearRight - 12, near.y);
    ctx.stroke();

    ctx.strokeStyle = "#343a40";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(nearLeft + 12, near.y);
    ctx.moveTo(W, 0); ctx.lineTo(nearRight - 12, near.y);
    ctx.stroke();

    // 3D Scrolling White Dashed Lane Lines (Thicker & Prominent)
    for (let lane = -0.5; lane <= 0.5; lane += 0.5) {
      if (lane === 0) continue;
      for (let i = 0; i < 20; i++) {
        const zNear = 0.5 + i * 1.1 - (progress % 1.1);
        const zFar = zNear + 0.55;
        if (zNear < 0.3 || zNear > 23) continue;

        const p1 = project3D(lane, zNear, W, H);
        const p2 = project3D(lane, zFar, W, H);

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        const w1 = 8 * p1.scale;
        const w2 = 8 * p2.scale;
        ctx.moveTo(p1.x - w1 / 2, p1.y);
        ctx.lineTo(p1.x + w1 / 2, p1.y);
        ctx.lineTo(p2.x + w2 / 2, p2.y);
        ctx.lineTo(p2.x - w2 / 2, p2.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // ── DRAW 3D MATH GATE ──
  function draw3DGate(ctx, gate, z, W, H) {
    const pCenter = project3D(0, z, W, H);
    const pLeft = project3D(-1, z, W, H);
    const pRight = project3D(1, z, W, H);

    const gateH = 105 * pCenter.scale;
    const postW = 20 * pCenter.scale;
    const postH = 145 * pCenter.scale;

    const yBase = pCenter.y;
    const yTop = yBase - gateH;

    ctx.save();

    // Left Gate Panel (Negative = Red translucent, Positive = Blue)
    const leftIsPos = gate.left.isPositive;
    ctx.fillStyle = leftIsPos ? "rgba(47, 128, 237, 0.48)" : "rgba(235, 87, 87, 0.50)";
    ctx.strokeStyle = leftIsPos ? "#1d4ed8" : "#dc2626";
    ctx.lineWidth = 3.5 * pCenter.scale;
    ctx.beginPath();
    ctx.rect(pLeft.x, yTop, pCenter.x - pLeft.x, gateH);
    ctx.fill();
    ctx.stroke();

    // Right Gate Panel
    const rightIsPos = gate.right.isPositive;
    ctx.fillStyle = rightIsPos ? "rgba(47, 128, 237, 0.48)" : "rgba(235, 87, 87, 0.50)";
    ctx.strokeStyle = rightIsPos ? "#1d4ed8" : "#dc2626";
    ctx.beginPath();
    ctx.rect(pCenter.x, yTop, pRight.x - pCenter.x, gateH);
    ctx.fill();
    ctx.stroke();

    // 3D Goal Posts (Left, Middle, Right)
    // Left Post
    ctx.fillStyle = leftIsPos ? "#1e40af" : "#b91c1c";
    ctx.fillRect(pLeft.x - postW / 2, yBase - postH, postW, postH);
    ctx.strokeRect(pLeft.x - postW / 2, yBase - postH, postW, postH);

    // Right Post
    ctx.fillStyle = rightIsPos ? "#1e40af" : "#b91c1c";
    ctx.fillRect(pRight.x - postW / 2, yBase - postH, postW, postH);
    ctx.strokeRect(pRight.x - postW / 2, yBase - postH, postW, postH);

    // Middle Post
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(pCenter.x - postW * 0.4, yBase - postH * 0.95, postW * 0.8, postH * 0.95);
    ctx.strokeRect(pCenter.x - postW * 0.4, yBase - postH * 0.95, postW * 0.8, postH * 0.95);

    // Gate Bold Math Text with Thick Black Outline
    const fontSize = clamp(52 * pCenter.scale, 16, 68);
    ctx.font = `900 ${fontSize}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 5 * pCenter.scale;

    // Left text
    const textLX = (pLeft.x + pCenter.x) / 2;
    const textY = yTop + gateH / 2;
    ctx.strokeText(gate.left.label, textLX, textY);
    ctx.fillText(gate.left.label, textLX, textY);

    // Right text
    const textRX = (pCenter.x + pRight.x) / 2;
    ctx.strokeText(gate.right.label, textRX, textY);
    ctx.fillText(gate.right.label, textRX, textY);

    ctx.restore();
  }

  // ── DRAW BOTTOM "PICK YOUR LINE" BANNER ──
  function drawBottomPrompt(ctx, W, H, phase) {
    if (phase !== "running") return;
    
    ctx.save();
    const fontSize = clamp(W * 0.08, 26, 42);
    ctx.font = `900 ${fontSize}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const text = "PICK YOUR LINE";
    const x = W / 2;
    const y = H - 24;

    // Hard 3D text shadow
    ctx.fillStyle = "#000000";
    ctx.fillText(text, x + 4, y + 4);

    // Black stroke
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 7;
    ctx.strokeText(text, x, y);

    // Neon text fill
    ctx.fillStyle = "#80b9ff";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ── DRAW HUD ──
  function drawHUD(ctx, s, W, H) {
    // Top HUD Bar in Neo-Brutalism Style
    ctx.save();

    // Score & Level Container
    ctx.fillStyle = "#FFE600";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#000000";
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // Top Pill
    const pillW = Math.min(W - 120, 320);
    const pillH = 44;
    const pillX = W / 2 - pillW / 2;
    const pillY = 16;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = "transparent";

    // Text info inside pill
    ctx.font = `900 13px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#000000";
    ctx.fillText(`🏆 ${s.score}`, pillX + 16, pillY + 27);

    ctx.textAlign = "center";
    ctx.fillText(s.levelLabel, pillX + pillW / 2, pillY + 27);

    ctx.textAlign = "right";
    ctx.fillText(`HI ${s.highScore}`, pillX + pillW - 16, pillY + 27);

    // Live Crowd Count Badge above player
    const p = project3D(s.playerX, s.playerZ, W, H);
    const badgeW = 70;
    const badgeH = 26;
    ctx.fillStyle = "#00d2ff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#000000";
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.roundRect(p.x - badgeW / 2, p.y - 68 * p.scale, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#000000";
    ctx.font = `900 13px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`👥 ${s.playerCount}`, p.x, p.y - 68 * p.scale + 18);

    ctx.restore();
  }

  // ── DRAW MODAL (Victory / Defeat) ──
  function drawModal(ctx, W, H, title, body, color, buttonText) {
    ctx.save();
    // Dim background
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, W, H);

    const cw = Math.min(W - 40, 360);
    const ch = 230;
    const cx = W / 2;
    const cy = H / 2;

    // Card Box
    ctx.fillStyle = "#FFFDF5";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#000000";
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 12);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = "transparent";

    // Title Badge
    ctx.fillStyle = color;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx - 110, cy - ch / 2 + 18, 220, 38, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#000000";
    ctx.font = `900 18px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(title, cx, cy - ch / 2 + 43);

    // Body
    ctx.font = `700 14px "Plus Jakarta Sans", sans-serif`;
    const lines = body.split("\n");
    lines.forEach((l, i) => ctx.fillText(l, cx, cy + 10 + i * 22));

    // CTA Hint
    ctx.fillStyle = "#000000";
    ctx.font = `900 13px "JetBrains Mono", monospace`;
    ctx.fillText(`PRESS SPACE / TAP: ${buttonText}`, cx, cy + ch / 2 - 20);

    ctx.restore();
  }

  // ── RESIZE & BOOT ──
  function resizeCanvas() {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }

  function advanceLevel() {
    const s = stateRef.current;
    if (!s) return;
    const nextLevel = s.levelIdx + 1;
    if (nextLevel >= LEVELS.length) {
      stateRef.current = { ...createGameState(0), score: s.score, highScore: s.highScore };
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

  // ── INPUT HANDLERS ──
  useEffect(() => {
    const onKeyDown = (e) => {
      const s = stateRef.current;
      if (!s) return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") keysRef.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") keysRef.current.right = true;
      if (e.code === "Space" || e.code === "Enter") {
        if (s.phase === "win") advanceLevel();
        else if (s.phase === "lose") restartGame();
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

  // Pointer drag & touch controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerAction = (clientX) => {
      const s = stateRef.current;
      if (!s) return;
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / canvas.width; // 0 to 1

      if (s.phase === "running") {
        s.targetPlayerX = clamp((x - 0.5) * 1.6, -0.68, 0.68);
      } else if (s.phase === "win") {
        advanceLevel();
      } else if (s.phase === "lose") {
        restartGame();
      }
    };

    const onPointerMove = (e) => {
      if (e.buttons > 0) handlePointerAction(e.clientX);
    };
    const onTouch = (e) => {
      e.preventDefault();
      handlePointerAction(e.touches[0].clientX);
    };

    canvas.addEventListener("mousemove", onPointerMove);
    canvas.addEventListener("mousedown", (e) => handlePointerAction(e.clientX));
    canvas.addEventListener("touchmove", onTouch, { passive: false });
    canvas.addEventListener("touchstart", onTouch, { passive: false });

    return () => {
      canvas.removeEventListener("mousemove", onPointerMove);
      canvas.removeEventListener("touchmove", onTouch);
      canvas.removeEventListener("touchstart", onTouch);
    };
  }, []);

  // Resize observer
  useEffect(() => {
    const observer = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) observer.observe(containerRef.current);
    resizeCanvas();
    return () => observer.disconnect();
  }, []);

  // Boot loop
  useEffect(() => {
    const savedLevel = parseInt(localStorage.getItem("mobLevel") || "0", 10);
    stateRef.current = createGameState(savedLevel);
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameLoop]);

  // Hand gesture tracking
  const handleGesture = useCallback((gesture) => {
    setCurrentGesture((prev) => (prev !== gesture ? gesture : prev));
    activeGestureRef.current = gesture;

    const isAction = gesture === GESTURES.DRAW || gesture === GESTURES.ERASE;
    if (isAction) {
      const s = stateRef.current;
      if (!s) return;
      if (s.phase === "win") advanceLevel();
      else if (s.phase === "lose") restartGame();
    }
  }, []);

  useHandTracking({
    videoRef,
    onGesture: handleGesture,
  });

  return (
    <div
      ref={containerRef}
      className="w-full h-[100dvh] bg-neo-dots flex items-center justify-center overflow-hidden relative select-none font-sans"
    >
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 neo-btn-white px-3.5 py-2 text-xs font-mono font-black uppercase z-50 flex items-center gap-1.5"
        title="Back to Home"
      >
        <span>←</span> HOME
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
          width: 130,
          height: 98,
          border: '3px solid #000000',
          boxShadow: '4px 4px 0px 0px #000000',
          zIndex: 50,
          transform: 'scaleX(-1)',
          opacity: 0.85,
          pointerEvents: 'none',
          background: '#000',
        }}
      />

      {/* Gesture hints badge */}
      <div className="fixed bottom-[130px] right-5 z-50 flex flex-col gap-1.5 pointer-events-none">
        {[
          { emoji: '✌️', label: 'Left', active: currentGesture === GESTURES.ERASE },
          { emoji: '☝️', label: 'Right', active: currentGesture === GESTURES.DRAW },
        ].map((h) => (
          <div
            key={h.label}
            className={`
              flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-black uppercase
              border-2 border-black transition-all duration-150 shadow-neo-sm
              ${h.active 
                ? 'bg-neo-yellow text-black scale-105 translate-x-[-2px]' 
                : 'bg-white text-zinc-700'}
            `}
          >
            <span className="text-sm">{h.emoji}</span>
            <span>{h.label}</span>
          </div>
        ))}
      </div>

      {/* Main 3D Canvas Frame */}
      <div className="relative w-full max-w-[680px] lg:max-w-[760px] h-full max-h-[95dvh] border-4 border-black shadow-neo-2xl bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-pointer"
        />
      </div>
    </div>
  );
}
