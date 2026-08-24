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
import { playPinchSound, playFailSound, resumeAudio } from "../utils/soundEffects";

/* ─── Constants ─────────────────────────────────────────── */
const BASE_W = 480;
const BASE_H = 640;

const GRAVITY = 0.32;
const FLAP_FORCE = -8.0;
const PIPE_SPEED = 2.5;
const PIPE_INTERVAL = 1600; // ms
const PIPE_GAP = 175;
const PIPE_WIDTH = 64;
const BIRD_RADIUS = 18;
const GROUND_H = 72;
const MAX_FALL_SPEED = 10; // terminal velocity cap

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
    resumeAudio();
    const s = stateRef.current;
    if (!s) return;
    if (s.phase === "idle") {
      s.phase = "playing";
      setUiState("playing");
    }
    if (s.phase === "playing") {
      playPinchSound();
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
    const dt = Math.min((now - lastTimeRef.current) / 16.67, 2); // cap at 2x frame
    const { scale } = s;

    // Bird physics
    s.bird.vy += GRAVITY * scale * dt;
    s.bird.vy = Math.min(s.bird.vy, MAX_FALL_SPEED * scale); // terminal velocity
    s.bird.y += s.bird.vy * dt;
    s.bird.angle = Math.max(-30, Math.min(85, (s.bird.vy / (scale * 6)) * 45));

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
      playFailSound();
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

  const handOverlayRef = useRef(null);
  const [handDetected, setHandDetected] = useState(false);

  const handleGesture = useCallback((gesture, indexTip, dims, landmarks) => {
    setHandDetected(!!landmarks || !!indexTip);
    setCurrentGesture(gesture);

    const isAction = gesture === GESTURES.PINCH || gesture === GESTURES.PAN || gesture === GESTURES.DRAW;

    if (isAction) {
      if (!lastGestureRef.current) {
        lastGestureRef.current = true;
        const s = stateRef.current;
        if (s?.phase === "playing") {
          triggerFlap();
        } else {
          startGame();
        }
      }
    } else {
      // Clear action state immediately so next pinch/tap triggers a new flap
      lastGestureRef.current = false;
    }
  }, [triggerFlap]);

  useHandTracking({
    videoRef,
    overlayCanvasRef: handOverlayRef,
    onGesture: handleGesture,
  });

  /* ── Start / Restart ── */
  function startGame() {
    resumeAudio();
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-neo-dots text-black select-none relative overflow-hidden font-sans">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 neo-btn-white px-3 py-2 text-xs font-mono font-black uppercase z-50 flex items-center gap-1.5"
        title="Back to Home"
      >
        <span>←</span>
        <span>HOME</span>
      </button>

      {/* Gesture hints overlay */}
      <div className="fixed bottom-[130px] right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {[
          { emoji: '✋', label: 'Ready', active: !isFlapping && currentGesture !== GESTURES.NONE },
          { emoji: '🤏', label: 'Flap', active: isFlapping },
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

      {/* Pip camera */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 130,
          height: 98,
          border: '3px solid #000000',
          boxShadow: '4px 4px 0px 0px #000000',
          zIndex: 50,
          background: '#000',
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
            opacity: 0.9,
            pointerEvents: 'none',
          }}
        />
        <canvas
          ref={handOverlayRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transform: 'scaleX(-1)',
            pointerEvents: 'none',
          }}
        />
      </div>

      <div className="relative w-full max-w-[480px] border-4 border-black shadow-neo-2xl bg-black">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-pointer touch-none"
          style={{ imageRendering: "pixelated" }}
        />

        {/* Start overlay */}
        {uiState === "idle" && (
          <Overlay>
            <div className="neo-box-lg p-6 sm:p-8 max-w-xs sm:max-w-sm w-full mx-4 text-center bg-neo-cream flex flex-col items-center">
              <div className="w-14 h-14 bg-neo-yellow border-2 border-black shadow-neo-sm flex items-center justify-center text-3xl mb-3">
                🐦
              </div>
              <h1 className="font-display font-black text-3xl uppercase tracking-tight text-black mb-1">
                Flappy Bird
              </h1>
              <p className="font-mono text-xs font-bold text-zinc-700 mb-4 uppercase">
                SPACE · TAP · PINCH TO FLAP
              </p>
              {highScore > 0 && (
                <div className="neo-tag bg-neo-yellow mb-5">
                  ★ BEST SCORE: {highScore}
                </div>
              )}
              <button
                id="flappy-action-btn"
                onClick={startGame}
                className="neo-btn-primary w-full py-3 text-base uppercase"
              >
                ▶ START FLAPPING
              </button>
            </div>
          </Overlay>
        )}

        {/* Game Over overlay */}
        {uiState === "dead" && (
          <Overlay>
            <div className="neo-box-lg p-6 sm:p-8 max-w-xs sm:max-w-sm w-full mx-4 text-center bg-[#FFFDF5] flex flex-col items-center">
              <div className="w-14 h-14 bg-neo-red text-white border-2 border-black shadow-neo-sm flex items-center justify-center text-3xl mb-3">
                💥
              </div>
              <h2 className="font-display font-black text-2xl uppercase tracking-tight text-neo-red mb-1">
                GAME OVER
              </h2>
              
              <div className="my-4 p-4 bg-neo-yellow border-2 border-black shadow-neo-sm w-full">
                <div className="font-mono text-[10px] font-black uppercase text-black">SCORE</div>
                <div className="font-display font-black text-5xl text-black">
                  {stateRef.current?.score ?? 0}
                </div>
                <div className="font-mono text-xs font-bold text-zinc-800 mt-1">
                  BEST: {getHighScore()}
                </div>
              </div>

              <button
                id="flappy-action-btn"
                onClick={restartGame}
                className="neo-btn-primary w-full py-3 text-base uppercase"
              >
                ↺ PLAY AGAIN
              </button>
            </div>
          </Overlay>
        )}
      </div>

      <div className="mt-4 neo-tag bg-white font-mono text-xs text-black">
        TIP: PINCH FINGERS OR HIT SPACE TO FLAP
      </div>
    </div>
  );
}

function Overlay({ children }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      {children}
    </div>
  );
}
