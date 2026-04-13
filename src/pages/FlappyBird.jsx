/**
 * FlappyBird.jsx — Production-ready Flappy Bird game
 *
 * INTEGRATION:
 *   1. Copy this file into your src/components/ folder
 *   2. Import: import FlappyBird from './components/FlappyBird'
 *   3. Use: <FlappyBird />
 *
 * GESTURE INTEGRATION (future):
 *   - Call flap() from anywhere via the exported ref:
 *       const birdRef = useRef();
 *       <FlappyBird onReady={(flap) => (birdRef.current = flap)} />
 *       birdRef.current?.flap(); // call on pinch gesture detect
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHandTracking } from "../hooks/useHandTracking";
import { GESTURES } from "../utils/gestureDetector";

/* ─── Constants ─────────────────────────────────────────── */
const BASE_W = 480;
const BASE_H = 640;

const GRAVITY = 0.5;
const FLAP_FORCE = -9.5;
const PIPE_SPEED = 2.8;
const PIPE_INTERVAL = 1500; // ms
const PIPE_GAP = 160;
const PIPE_WIDTH = 64;
const BIRD_RADIUS = 18;
const GROUND_H = 72;

/* ─── Helpers ────────────────────────────────────────────── */
function getScale(canvas) {
  return canvas.width / BASE_W;
}

function randomGapY(scale) {
  const gapH = PIPE_GAP * scale;
  const minY = 80 * scale;
  const maxY = canvas_h(scale) - GROUND_H * scale - gapH - 80 * scale;
  return minY + Math.random() * (maxY - minY);
}
function canvas_h(scale) {
  return BASE_H * scale;
}

/* ─── Drawing helpers ────────────────────────────────────── */
function drawRoundRect(ctx, x, y, w, h, r) {
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

/* ─── Main Component ─────────────────────────────────────── */
export default function FlappyBird({ onReady }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const lastPipeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const videoRef = useRef(null);
  const lastPinchRef = useRef(0);
  const lastGestureRef = useRef(false);
  const [uiState, setUiState] = useState("idle"); // idle | playing | dead
  const [currentGesture, setCurrentGesture] = useState(GESTURES.NONE);

  /* ── Init game state ── */
  function createState(scale) {
    return {
      scale,
      bird: {
        x: BASE_W * 0.25 * scale,
        y: (BASE_H / 2) * scale,
        vy: 0,
        angle: 0,
      },
      pipes: [],
      score: 0,
      phase: "idle", // idle | playing | dead
    };
  }

  /* ── triggerFlap — PUBLIC API for gesture integration ── */
  const triggerFlap = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase === "idle") {
      s.phase = "playing";
      setUiState("playing");
    }
    if (s.phase === "playing") {
      s.bird.vy = FLAP_FORCE * s.scale;
    }
  }, []);

  /* ── Expose flap to parent via onReady ── */
  useEffect(() => {
    onReady?.(triggerFlap);
  }, [triggerFlap, onReady]);

  /* ── Resize canvas ── */
  function resizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const maxW = Math.min(parent.clientWidth, BASE_W);
    const scale = maxW / BASE_W;
    canvas.width = maxW;
    canvas.height = BASE_H * scale;
    if (stateRef.current) {
      stateRef.current.scale = scale;
      // reposition bird proportionally on resize only
      stateRef.current.bird.x = BASE_W * 0.25 * scale;
    }
    return scale;
  }

  /* ── Spawn pipe ── */
  function spawnPipe(scale) {
    const gapY = randomGapY(scale);
    const gapH = PIPE_GAP * scale;
    return {
      x: BASE_W * scale,
      topH: gapY,
      botY: gapY + gapH,
      botH: BASE_H * scale - (gapY + gapH) - GROUND_H * scale,
      passed: false,
    };
  }

  /* ── Collision ── */
  function checkCollision(bird, pipes, scale) {
    const bx = bird.x;
    const by = bird.y;
    const br = BIRD_RADIUS * scale * 0.75; // slightly forgiving
    const pw = PIPE_WIDTH * scale;
    const ground = BASE_H * scale - GROUND_H * scale;
    if (by + br >= ground) return true;
    if (by - br <= 0) return true;
    for (const p of pipes) {
      if (bx + br > p.x && bx - br < p.x + pw) {
        if (by - br < p.topH || by + br > p.botY) return true;
      }
    }
    return false;
  }

  /* ── UPDATE ── */
  function update(now) {
    const s = stateRef.current;
    if (!s || s.phase !== "playing") return;
    const dt = Math.min((now - lastTimeRef.current) / 16.67, 3); // cap at 3x
    const { scale } = s;

    // Bird physics
    s.bird.vy += GRAVITY * scale * dt;
    s.bird.y += s.bird.vy * dt;
    s.bird.angle = Math.max(-30, Math.min(90, (s.bird.vy / (scale * 8)) * 45));

    // Spawn pipes
    if (now - lastPipeRef.current > PIPE_INTERVAL) {
      s.pipes.push(spawnPipe(scale));
      lastPipeRef.current = now;
    }

    // Move pipes & score
    for (const p of s.pipes) {
      p.x -= PIPE_SPEED * scale * dt;
      if (!p.passed && p.x + PIPE_WIDTH * scale < s.bird.x) {
        p.passed = true;
        s.score++;
      }
    }

    // Cull off-screen pipes
    s.pipes = s.pipes.filter((p) => p.x + PIPE_WIDTH * scale > -20);

    // Collision
    if (checkCollision(s.bird, s.pipes, scale)) {
      s.phase = "dead";
      setUiState("dead");
      saveHighScore(s.score);
    }
  }

  /* ── RENDER ── */
  function render() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;
    const W = canvas.width;
    const H = canvas.height;
    const scale = s?.scale ?? 1;

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0d1b2a");
    sky.addColorStop(1, "#1a3a5c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars (static, seeded)
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137.5) % 1) * W || ((i * 53) % W);
      const sy = ((i * 97.3) % 0.75) * H || ((i * 31) % (H * 0.6));
      const sr = (i % 3 === 0 ? 1.5 : 1) * scale;
      ctx.beginPath();
      ctx.arc(
        Math.abs(Math.sin(i * 2.4) * W),
        Math.abs(Math.cos(i * 1.7) * H * 0.65),
        sr * 0.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    if (!s) return;

    // Pipes
    for (const p of s.pipes) {
      const pw = PIPE_WIDTH * scale;
      const capH = 20 * scale;
      const capW = pw + 10 * scale;

      // Pipe gradient
      const pipeFill = ctx.createLinearGradient(p.x, 0, p.x + pw, 0);
      pipeFill.addColorStop(0, "#2ecc71");
      pipeFill.addColorStop(0.4, "#27ae60");
      pipeFill.addColorStop(1, "#1e8449");

      ctx.fillStyle = pipeFill;
      // Top pipe body
      ctx.fillRect(p.x, 0, pw, p.topH - capH);
      // Top pipe cap
      drawRoundRect(ctx, p.x - 5 * scale, p.topH - capH, capW, capH, 4 * scale);
      ctx.fill();
      // Bottom pipe body
      ctx.fillRect(p.x, p.botY + capH, pw, p.botH);
      // Bottom pipe cap
      drawRoundRect(ctx, p.x - 5 * scale, p.botY, capW, capH, 4 * scale);
      ctx.fill();

      // Pipe highlight
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(p.x + 6 * scale, 0, 8 * scale, p.topH - capH);
      ctx.fillRect(p.x + 6 * scale, p.botY + capH, 8 * scale, p.botH);
    }

    // Ground
    const groundY = H - GROUND_H * scale;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
    groundGrad.addColorStop(0, "#5d4037");
    groundGrad.addColorStop(0.3, "#795548");
    groundGrad.addColorStop(1, "#4e342e");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, W, GROUND_H * scale);
    // Grass strip
    ctx.fillStyle = "#4caf50";
    ctx.fillRect(0, groundY, W, 8 * scale);
    ctx.fillStyle = "#66bb6a";
    ctx.fillRect(0, groundY, W, 4 * scale);

    // Bird
    ctx.save();
    ctx.translate(s.bird.x, s.bird.y);
    ctx.rotate((s.bird.angle * Math.PI) / 180);
    const br = BIRD_RADIUS * scale;

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, Math.PI * 2);
    const birdGrad = ctx.createRadialGradient(-br * 0.2, -br * 0.2, br * 0.1, 0, 0, br);
    birdGrad.addColorStop(0, "#ffe082");
    birdGrad.addColorStop(0.6, "#ffb300");
    birdGrad.addColorStop(1, "#e65100");
    ctx.fillStyle = birdGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = scale;
    ctx.stroke();

    // Wing
    ctx.beginPath();
    ctx.ellipse(-br * 0.3, br * 0.2, br * 0.5, br * 0.25, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffa000";
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(br * 0.45, -br * 0.2, br * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(br * 0.52, -br * 0.18, br * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(br * 0.7, br * 0.1);
    ctx.lineTo(br * 1.2, br * 0.25);
    ctx.lineTo(br * 0.7, br * 0.4);
    ctx.fillStyle = "#ef6c00";
    ctx.fill();

    ctx.restore();

    // Score HUD
    const score = s.score;
    const highScore = getHighScore();
    ctx.textAlign = "center";
    ctx.font = `bold ${28 * scale}px 'Segoe UI', sans-serif`;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillText(score, W / 2 + 2 * scale, 52 * scale + 2 * scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(score, W / 2, 52 * scale);

    ctx.font = `${13 * scale}px 'Segoe UI', sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`Best: ${highScore}`, W / 2, 72 * scale);
  }

  /* ── GAME LOOP ── */
  function loop(now) {
    lastTimeRef.current = lastTimeRef.current || now;
    update(now);
    render();
    lastTimeRef.current = now;
    rafRef.current = requestAnimationFrame(loop);
  }

  /* ── High Score ── */
  function getHighScore() {
    try {
      return parseInt(localStorage.getItem("flappy_hs") || "0", 10);
    } catch {
      return 0;
    }
  }
  function saveHighScore(score) {
    try {
      const prev = getHighScore();
      if (score > prev) localStorage.setItem("flappy_hs", String(score));
    } catch {}
  }

  const handleGesture = useCallback((gesture) => {
    setCurrentGesture(prev => prev !== gesture ? gesture : prev);

    const isAction = gesture === GESTURES.PINCH || gesture === GESTURES.PAN;

    if (isAction && !lastGestureRef.current) {
      lastGestureRef.current = true;
      const s = stateRef.current;
      if (s?.phase === "playing") {
        triggerFlap();
      } else {
        const btn = document.getElementById("flappy-action-btn");
        if (btn) btn.click();
      }
    } else if (!isAction && gesture !== GESTURES.NONE) {
      // Clear action state only when we explicitly see an open hand (or other non-action pose)
      lastGestureRef.current = false;
    }
  }, [triggerFlap]);

  useHandTracking({
    videoRef,
    onGesture: handleGesture,
  });

  /* ── Start / Restart ── */
  function startGame() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = resizeCanvas() || stateRef.current?.scale || 1;
    stateRef.current = createState(scale);
    lastPipeRef.current = performance.now() + 1200; // delay first pipe
    lastTimeRef.current = 0;
    setUiState("playing");
    stateRef.current.phase = "playing";
  }

  function restartGame() {
    startGame();
  }

  /* ── Setup effects ── */
  useEffect(() => {
    const scale = resizeCanvas();
    stateRef.current = createState(scale);

    // Input handlers
    const onKey = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        triggerFlap();
      }
    };
    const onClick = () => triggerFlap();
    window.addEventListener("keydown", onKey);
    canvasRef.current?.addEventListener("click", onClick);
    canvasRef.current?.addEventListener("touchstart", onClick, { passive: true });

    // Resize
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);

    // Start loop
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      canvasRef.current?.removeEventListener("click", onClick);
      canvasRef.current?.removeEventListener("touchstart", onClick);
    };
  }, []);

  const highScore = getHighScore();
  const isFlapping = currentGesture === GESTURES.PINCH || currentGesture === GESTURES.PAN;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 select-none relative overflow-hidden">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-zinc-300 hover:text-white z-50 backdrop-blur-md border border-white/10"
        title="Back to Home"
      >
        ←
      </button>

      {/* Gesture hints overlay */}
      <div className="fixed bottom-[140px] right-5 z-50 flex flex-col gap-1.5 pointer-events-none">
        {[
          { emoji: '✋', label: 'Ready', active: !isFlapping && currentGesture !== GESTURES.NONE },
          { emoji: '🤏', label: 'Flap', active: isFlapping },
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

      <div className="relative w-full max-w-[480px]">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-pointer touch-none"
          style={{ imageRendering: "pixelated" }}
        />

        {/* Start overlay */}
        {uiState === "idle" && (
          <Overlay>
            <p className="text-5xl mb-1">🐦</p>
            <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">Flappy Bird</h1>
            <p className="text-sm text-white/50 mb-6">Space / Tap to flap</p>
            {highScore > 0 && (
              <p className="text-yellow-400 text-sm mb-4">Best: {highScore}</p>
            )}
            <button
              id="flappy-action-btn"
              onClick={startGame}
              className="px-8 py-3 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-gray-900 font-bold rounded-full text-lg transition-all"
            >
              Play
            </button>
          </Overlay>
        )}

        {/* Game Over overlay */}
        {uiState === "dead" && (
          <Overlay>
            <p className="text-4xl mb-2">💥</p>
            <h2 className="text-2xl font-bold text-white mb-1">Game Over</h2>
            <p className="text-4xl font-black text-yellow-400 mb-1">
              {stateRef.current?.score ?? 0}
            </p>
            <p className="text-sm text-white/50 mb-1">Score</p>
            <p className="text-sm text-white/40 mb-6">Best: {getHighScore()}</p>
            <button
              id="flappy-action-btn"
              onClick={restartGame}
              className="px-8 py-3 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-gray-900 font-bold rounded-full text-lg transition-all"
            >
              Restart
            </button>
          </Overlay>
        )}
      </div>

      <p className="text-white/20 text-xs mt-4 z-10">Space / Tap / Pinch to flap</p>
    </div>
  );
}

function Overlay({ children }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-none">
      {children}
    </div>
  );
}
