import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { mapHandToScreen } from "../utils/resolution";
import { useHandTracking } from "../hooks/useHandTracking";
import { GESTURES } from "../utils/gestureDetector";
import { playSliceSound, playBombSound, resumeAudio } from "../utils/soundEffects";

// ─── Constants ────────────────────────────────────────────────────────────────
// ─── Constants ────────────────────────────────────────────────────────────────
const GRAVITY = 0.12;
const SPAWN_INTERVAL = 1200;
const MAX_FRUITS = 12;
const SLICE_RADIUS_FACTOR = 2.5;
const TRAIL_LENGTH = 12;
const MAX_MISSES = 10;        // lose a life for each missed fruit
const MAX_BOMBS = 3;         // slice this many bombs → game over
const SLOWMO_DURATION = 180; // frames (~3 s at 60fps) of slow-motion per bomb
const SLOWMO_FACTOR = 0.38;  // velocity multiplier while in slow-mo

const FRUIT_TYPES = [
  { emoji: "🍉", color: "#e74c3c", shadow: "#c0392b", radius: 32, score: 3 },
  { emoji: "🍊", color: "#e67e22", shadow: "#d35400", radius: 28, score: 2 },
  { emoji: "🍋", color: "#f1c40f", shadow: "#f39c12", radius: 26, score: 2 },
  { emoji: "🍇", color: "#8e44ad", shadow: "#6c3483", radius: 24, score: 4 },
  { emoji: "🍓", color: "#e74c3c", shadow: "#922b21", radius: 22, score: 3 },
  { emoji: "🍍", color: "#f39c12", shadow: "#d68910", radius: 30, score: 5 },
  { emoji: "🥝", color: "#27ae60", shadow: "#1e8449", radius: 24, score: 2 },
  { emoji: "🍑", color: "#fa8072", shadow: "#e55b4d", radius: 26, score: 3 },
];

const FRUIT_PHRASES = ["Awesome", "Slice It!", "Go", "Great", "Ninja!", "Wow", "Perfect"];

const BOMB = {
  emoji: "💣", color: "#2c3e50", shadow: "#1a252f",
  radius: 28, score: 0, isBomb: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomBetween(a, b) { return a + Math.random() * (b - a); }

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function lineIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
  return distToSegment(cx, cy, x1, y1, x2, y2) <= r * SLICE_RADIUS_FACTOR;
}

function getPlayableBounds(canvasWidth) {
  const margin = Math.max(160, canvasWidth * 0.17);
  return {
    minX: margin,
    maxX: canvasWidth - margin,
    centerX: canvasWidth / 2,
  };
}

function spawnFruit(canvasWidth) {
  const isBomb = Math.random() < 0.1;
  const type = isBomb ? BOMB : FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
  const r = type.radius;
  const { minX, maxX, centerX } = getPlayableBounds(canvasWidth);

  // Spawn strictly inside the playable bounds
  const spawnX = randomBetween(minX + r + 20, maxX - r - 20);
  // Bias horizontal trajectory towards the center
  const centerBias = (centerX - spawnX) * 0.005;
  const vx = centerBias + randomBetween(-0.5, 0.5);

  return {
    id: Math.random().toString(36).slice(2),
    x: spawnX,
    y: window.innerHeight + r + 10,
    vx,
    vy: randomBetween(-13.5, -10.5),
    ...type,
    sliced: false,
    missed: false,
    rotation: 0,
    rotSpeed: randomBetween(-0.08, 0.08),
    opacity: 1,
  };
}

function lighten(hex, amount) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FruitNinja() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  // All mutable game state — never triggers re-renders
  const stateRef = useRef({
    fruits: [],
    trail: [],
    particles: [],
    missedParticles: [],
    score: 0,
    misses: 0,
    bombs: 0,
    running: false,
    animId: null,
    spawnTimer: null,
    shakeFrames: 0,
    flashFrames: 0,
    flashColor: "rgba(255,0,0,0.18)",
    slowmoFrames: 0,
    floatingTexts: [],
  });

  // React state — UI only
  const [displayScore, setDisplayScore] = useState(0);
  const [displayMisses, setDisplayMisses] = useState(0);
  const [displayBombs, setDisplayBombs] = useState(0);
  const [highScore, setHighScore] = useState(
    () => parseInt(localStorage.getItem("fn_highscore") || "0", 10)
  );
  const [gameState, setGameState] = useState("idle");
  const [bombFlash, setBombFlash] = useState(false);
  const [slowmo, setSlowmo] = useState(false);
  const [overReason, setOverReason] = useState("");

  // Stable ref so the tick loop can call endGame without stale closures
  const endGameRef = useRef(null);

  // ── Canvas resize ──────────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Particle emitters ──────────────────────────────────────────────────────
  function emitParticles(x, y, color, count = 14) {
    const s = stateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomBetween(3, 9);
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 1, decay: randomBetween(0.025, 0.055),
        r: randomBetween(3, 8), color,
      });
    }
  }

  function emitMissParticles(x, y) {
    const s = stateRef.current;
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomBetween(2, 7);
      s.missedParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1, decay: randomBetween(0.03, 0.06),
        r: randomBetween(4, 10),
        color: "#e74c3c",
      });
    }
  }

  function spawnFloatingText(x, y, text, color) {
    const s = stateRef.current;
    s.floatingTexts.push({
      x, y,
      vx: randomBetween(-1, 1),
      vy: randomBetween(-2, -4),
      text,
      color,
      life: 1,
      decay: 0.02,
    });
  }

  // ── End game ───────────────────────────────────────────────────────────────
  const endGame = useCallback((reason) => {
    const s = stateRef.current;
    s.running = false;
    if (s.animId) cancelAnimationFrame(s.animId);
    if (s.spawnTimer) clearInterval(s.spawnTimer);
    s.spawnTimer = null;
    setOverReason(reason);
    setGameState("over");
    setSlowmo(false);
    const final = s.score;
    setHighScore(prev => {
      const next = Math.max(prev, final);
      localStorage.setItem("fn_highscore", String(next));
      return next;
    });
  }, []);

  useEffect(() => { endGameRef.current = endGame; }, [endGame]);

  // ── Game loop ──────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;
    const W = canvas.width, H = canvas.height;

    // Slow-motion factor
    const speedFactor = s.slowmoFrames > 0 ? SLOWMO_FACTOR : 1;
    if (s.slowmoFrames > 0) {
      s.slowmoFrames--;
      if (s.slowmoFrames === 0) setSlowmo(false);
    }

    // Screen shake
    let sx = 0, sy = 0;
    if (s.shakeFrames > 0) {
      sx = (Math.random() - 0.5) * 14;
      sy = (Math.random() - 0.5) * 14;
      s.shakeFrames--;
    }
    ctx.save();
    ctx.translate(sx, sy);

    // ── Background ───────────────────────────────────────────────────────────
    ctx.clearRect(-20, -20, W + 40, H + 40);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, s.slowmoFrames > 0 ? "rgba(20, 40, 120, 0.3)" : "rgba(10, 10, 20, 0.1)");
    bg.addColorStop(1, s.slowmoFrames > 0 ? "rgba(20, 40, 120, 0.6)" : "rgba(10, 10, 20, 0.4)");
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Slow-mo blue vignette
    if (s.slowmoFrames > 0) {
      const alpha = Math.min(0.4, (s.slowmoFrames / SLOWMO_DURATION) * 0.55);
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, `rgba(20,60,180,${alpha})`);
      ctx.fillStyle = vig;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    // Flash overlay
    if (s.flashFrames > 0) {
      ctx.fillStyle = s.flashColor;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      s.flashFrames--;
    }

    // ── Fruits ───────────────────────────────────────────────────────────────
    const { minX, maxX } = getPlayableBounds(W);

    s.fruits = s.fruits.filter(f => {
      f.vy += GRAVITY * speedFactor;
      f.x += f.vx * speedFactor;
      f.y += f.vy * speedFactor;
      f.rotation += f.rotSpeed * speedFactor;

      // Keep active fruits inside the designated playable zone
      if (!f.sliced) {
        if (f.x - f.radius < minX) {
          f.x = minX + f.radius;
          f.vx = Math.abs(f.vx) * 0.7;
        } else if (f.x + f.radius > maxX) {
          f.x = maxX - f.radius;
          f.vx = -Math.abs(f.vx) * 0.7;
        }
      }

      if (f.sliced) {
        f.opacity -= 0.06;
        return f.opacity > 0;
      }

      // Fell off bottom without being sliced
      if (f.y > H + f.radius + 20) {
        if (!f.isBomb && !f.missed) {
          f.missed = true;
          emitMissParticles(Math.max(30, Math.min(f.x, W - 30)), H - 24);
          s.misses++;
          setDisplayMisses(s.misses);
          if (s.misses >= MAX_MISSES) {
            endGameRef.current?.("miss");
            return false;
          }
        }
        return false;
      }

      // ── Draw fruit ──────────────────────────────────────────────────────────
      ctx.save();

      // Drop shadow
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(f.x + 6, f.y + 8, f.radius * 0.9, f.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = f.opacity;

      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);

      // Gradient fill + glow
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 18;
      const grad = ctx.createRadialGradient(-f.radius * 0.3, -f.radius * 0.3, 1, 0, 0, f.radius);
      grad.addColorStop(0, lighten(f.color, 0.5));
      grad.addColorStop(0.5, f.color);
      grad.addColorStop(1, f.shadow);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Shine
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.ellipse(-f.radius * 0.28, -f.radius * 0.28, f.radius * 0.32, f.radius * 0.18, -0.7, 0, Math.PI * 2);
      ctx.fill();

      // Emoji
      ctx.font = `${f.radius * 1.1}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "transparent";
      ctx.fillText(f.emoji, 0, 2);

      // Slow-mo shimmer ring on bomb
      if (f.isBomb && s.slowmoFrames > 0) {
        const pulse = Math.sin(Date.now() / 120) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(100,160,255,${pulse * 0.8})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, f.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      return true;
    });

    // ── Miss splat particles ──────────────────────────────────────────────────
    s.missedParticles = s.missedParticles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.25;
      p.life -= p.decay;
      if (p.life <= 0) return false;
      ctx.globalAlpha = p.life * 0.85;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      return true;
    });

    // ── Slice particles ───────────────────────────────────────────────────────
    s.particles = s.particles.filter(p => {
      p.x += p.vx * speedFactor;
      p.y += p.vy * speedFactor;
      p.vy += 0.3 * speedFactor;
      p.life -= p.decay;
      if (p.life <= 0) return false;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      return true;
    });

    // ── Swipe trail ───────────────────────────────────────────────────────────
    if (s.trail.length > 1) {
      const tc = s.slowmoFrames > 0 ? "100,180,255" : "255,255,255";
      for (let i = 1; i < s.trail.length; i++) {
        const t = i / s.trail.length;
        const prev = s.trail[i - 1], cur = s.trail[i];
        ctx.strokeStyle = `rgba(${tc},${t * 0.8})`;
        ctx.lineWidth = t * 5;
        ctx.lineCap = "round";
        ctx.shadowColor = `rgba(${tc},1)`;
        ctx.shadowBlur = t * 14;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(cur.x, cur.y);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // ── Floating Texts ───────────────────────────────────────────────────────
    s.floatingTexts = s.floatingTexts.filter(t => {
      t.x += t.vx;
      t.y += t.vy;
      t.life -= t.decay;
      if (t.life <= 0) return false;

      ctx.save();
      ctx.globalAlpha = t.life;
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 10;
      ctx.font = `bold ${20 + t.life * 10}px 'Orbitron', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
      return true;
    });

    // ── Life / miss indicators drawn on canvas (bottom edge) ─────────────────
    const xSize = 13, xSpacing = 34;
    const xStart = W / 2 - ((MAX_MISSES - 1) * xSpacing) / 2;
    for (let i = 0; i < MAX_MISSES; i++) {
      const cx = xStart + i * xSpacing, cy = H - 28;
      ctx.save();
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      if (i < s.misses) {
        ctx.strokeStyle = "#e74c3c";
        ctx.shadowColor = "#e74c3c";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(cx - xSize / 2, cy - xSize / 2); ctx.lineTo(cx + xSize / 2, cy + xSize / 2);
        ctx.moveTo(cx + xSize / 2, cy - xSize / 2); ctx.lineTo(cx - xSize / 2, cy + xSize / 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.beginPath();
        ctx.arc(cx, cy, xSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore(); // undo shake translate

    if (s.running) s.animId = requestAnimationFrame(tick);
  }, []); // intentionally no deps — all data from refs

  // ── Slice check ───────────────────────────────────────────────────────────
  const checkSlice = useCallback((x1, y1, x2, y2) => {
    const s = stateRef.current;
    if (!s.running) return;
    s.fruits.forEach(f => {
      if (f.sliced) return;
      if (!lineIntersectsCircle(x1, y1, x2, y2, f.x, f.y, f.radius)) return;
      f.sliced = true;
      emitParticles(f.x, f.y, f.color);

      if (f.isBomb) {
        playBombSound();
        s.bombs++;
        setDisplayBombs(s.bombs);
        s.shakeFrames = 18;
        s.flashFrames = 12;
        s.flashColor = "rgba(255,50,50,0.28)";
        setBombFlash(true);
        setTimeout(() => setBombFlash(false), 500);
        // Each bomb triggers slow-mo (stacks / resets timer)
        s.slowmoFrames = SLOWMO_DURATION;
        setSlowmo(true);
        // 3rd bomb → game over (short delay so flash is visible)
        if (s.bombs >= MAX_BOMBS) {
          setTimeout(() => endGameRef.current?.("bomb"), 450);
        }
        spawnFloatingText(f.x, f.y, "Bomb💥", "#ff3e3e");
      } else {
        playSliceSound();
        s.score += f.score;
        setDisplayScore(s.score);
        const phrase = FRUIT_PHRASES[Math.floor(Math.random() * FRUIT_PHRASES.length)];
        spawnFloatingText(f.x, f.y, phrase, "#64b4ff");
      }
    });
  }, []);

  // ── Pointer events ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let last = null;
    const onMove = (x, y) => {
      const s = stateRef.current;
      s.trail.push({ x, y });
      if (s.trail.length > TRAIL_LENGTH) s.trail.shift();
      if (last) checkSlice(last.x, last.y, x, y);
      last = { x, y };
    };
    const onUp = () => { last = null; stateRef.current.trail = []; };
    const onMouse = e => onMove(e.clientX, e.clientY);
    const onTouch = e => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); };
    canvas.addEventListener("mousemove", onMouse);
    canvas.addEventListener("touchmove", onTouch, { passive: false });
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("touchend", onUp);
    return () => {
      canvas.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("touchmove", onTouch);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("touchend", onUp);
    };
  }, [checkSlice]);

  // ── Start / Restart ───────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    resumeAudio();
    const s = stateRef.current;
    if (s.animId) cancelAnimationFrame(s.animId);
    if (s.spawnTimer) clearInterval(s.spawnTimer);
    Object.assign(s, {
      fruits: [], trail: [], particles: [], missedParticles: [],
      score: 0, misses: 0, bombs: 0,
      running: true,
      shakeFrames: 0, flashFrames: 0,
      flashColor: "rgba(255,0,0,0.18)",
      slowmoFrames: 0,
      floatingTexts: [],
    });
    setDisplayScore(0);
    setDisplayMisses(0);
    setDisplayBombs(0);
    setGameState("running");
    setSlowmo(false);
    setBombFlash(false);

    const canvas = canvasRef.current;
    s.spawnTimer = setInterval(() => {
      if (!s.running) return;
      if (s.fruits.filter(f => !f.sliced).length < MAX_FRUITS) {
        const count = Math.random() < 0.3 ? 2 : 1;
        for (let i = 0; i < count; i++)
          s.fruits.push(spawnFruit(canvas?.width || window.innerWidth));
      }
    }, SPAWN_INTERVAL);

    s.animId = requestAnimationFrame(tick);
  }, [tick]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    const s = stateRef.current;
    if (s.animId) cancelAnimationFrame(s.animId);
    if (s.spawnTimer) clearInterval(s.spawnTimer);
  }, []);

  // ── High-score sync ───────────────────────────────────────────────────────
  useEffect(() => {
    if (displayScore > highScore) {
      setHighScore(displayScore);
      localStorage.setItem("fn_highscore", String(displayScore));
    }
  }, [displayScore, highScore]);

  // ── MediaPipe Hands (optional) ────────────────────────────────────────────
  useEffect(() => {
    let hands, camera, lastTip = null, loaded = false;
    async function init() {
      try {
        const Hands = window.Hands;
        const Camera = window.Camera;

        const video = videoRef.current;
        if (!video) return;

        hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
        hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        hands.onResults(res => {
          if (!res.multiHandLandmarks?.length) { lastTip = null; return; }
          const lm = res.multiHandLandmarks[0][8];
          const c = canvasRef.current;
          const v = videoRef.current;
          if (!c || !v) return;

          const { x, y } = mapHandToScreen(lm, c.width, c.height, v.videoWidth, v.videoHeight, true);

          const s = stateRef.current;
          s.trail.push({ x, y });
          if (s.trail.length > TRAIL_LENGTH) s.trail.shift();
          if (lastTip && Math.hypot(x - lastTip.x, y - lastTip.y) > 3)
            checkSlice(lastTip.x, lastTip.y, x, y);
          lastTip = { x, y };
        });
        camera = new Camera(video, { onFrame: async () => hands.send({ image: video }), width: 640, height: 480 });
        await camera.start();
        loaded = true;
      } catch (err) { console.error("Hand tracking error", err); }
    }
    init();
    return () => { if (loaded) { hands?.close(); camera?.stop(); } };
  }, [checkSlice]);

  // ── Derived UI values ─────────────────────────────────────────────────────
  const lives = MAX_MISSES - displayMisses;
  const bombsLeft = MAX_BOMBS - displayBombs;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden select-none font-sans"
      style={{ cursor: "crosshair", background: "#0c0a17" }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)", opacity: 0.35 }}
      />

      {/* Back Button */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 z-50 neo-btn-white px-3.5 py-2 text-xs font-mono font-black uppercase flex items-center gap-2 pointer-events-auto"
      >
        <span>←</span> HOME
      </button>

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ── HUD ──────────────────────────────────────────────────────────── */}
      {gameState === "running" && (
        <div className="absolute top-0 left-0 right-0 flex justify-between items-start px-4 sm:px-6 pt-4 pointer-events-none z-10">

          {/* Score Box */}
          <div className="flex flex-col items-start translate-y-12 sm:translate-y-0 sm:ml-28">
            <div className="bg-neo-yellow border-3 border-black shadow-neo px-4 py-2 flex flex-col items-center">
              <span className="font-mono text-[10px] font-black tracking-wider text-black">SCORE</span>
              <span className="font-display font-black text-3xl sm:text-4xl text-black leading-none">
                {displayScore}
              </span>
            </div>
          </div>

          {/* Slow-mo badge (centre) */}
          {slowmo && (
            <div className="bg-neo-cyan border-3 border-black shadow-neo px-4 py-1.5 flex items-center gap-2 animate-bounce">
              <span className="text-xl">⏳</span>
              <span className="font-mono font-black text-xs uppercase text-black">SLOW MOTION</span>
            </div>
          )}

          {/* Right: best + bomb lives + heart lives */}
          <div className="flex flex-col items-end gap-2">
            <div className="bg-white border-2 sm:border-3 border-black shadow-neo-sm px-3 py-1 flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-zinc-600">BEST:</span>
              <span className="font-mono font-black text-sm sm:text-base text-black">
                {highScore}
              </span>
            </div>

            {/* Bomb lives */}
            <div className="flex items-center gap-1.5 p-1.5 bg-[#FFFDF5] border-2 border-black shadow-neo-sm">
              <span className="font-mono text-[9px] font-bold text-zinc-600 mr-1">BOMBS:</span>
              {Array.from({ length: MAX_BOMBS }).map((_, i) => (
                <span key={i} className="text-base sm:text-lg leading-none" style={{
                  filter: i < bombsLeft
                    ? "drop-shadow(0 0 2px #000)"
                    : "grayscale(1) opacity(0.25)",
                }}>💣</span>
              ))}
            </div>

            {/* Fruit lives (hearts) */}
            <div className="flex items-center gap-1 p-1.5 bg-[#FFFDF5] border-2 border-black shadow-neo-sm">
              <span className="font-mono text-[9px] font-bold text-zinc-600 mr-1">LIVES:</span>
              {Array.from({ length: MAX_MISSES }).map((_, i) => (
                <span key={i} className="text-xs sm:text-sm leading-none" style={{
                  filter: i < lives
                    ? "drop-shadow(0 0 2px #000)"
                    : "grayscale(1) opacity(0.2)",
                }}>❤️</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bomb flash overlay */}
      {bombFlash && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: "radial-gradient(circle, rgba(255,50,50,0.45) 0%, transparent 70%)",
            animation: "fnpulse 0.18s ease-in-out",
          }}
        />
      )}

      {/* ── Start / Game-Over overlay ──────────────────────────────────── */}
      {(gameState === "idle" || gameState === "over") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/75 p-4">
          
          <div className="neo-box-xl bg-[#FFFDF5] p-6 sm:p-10 max-w-md w-full text-center flex flex-col items-center">
            
            {/* Logo */}
            <div className="w-16 h-16 bg-neo-pink border-3 border-black shadow-neo flex items-center justify-center text-4xl mb-3">
              🍉
            </div>
            
            <h1 className="font-display font-black text-3xl sm:text-4xl text-black uppercase tracking-tight mb-1">
              Fruit Ninja
            </h1>
            <p className="font-mono text-xs font-bold text-zinc-700 uppercase tracking-wider mb-5">
              SWIPE TO SLICE · AVOID BOMBS
            </p>

            {/* Game-over stats */}
            {gameState === "over" && (
              <div className="w-full mb-4">
                {/* Reason badge */}
                <div className="inline-block mb-3 px-3 py-1 bg-neo-red text-white border-2 border-black shadow-neo-sm font-mono text-xs font-bold uppercase">
                  {overReason === "bomb" ? "💣 3 BOMBS SLICED — GAME OVER" : "❤️ 10 FRUITS MISSED — GAME OVER"}
                </div>

                <div className="p-4 bg-neo-yellow border-2 border-black shadow-neo-sm my-2">
                  <div className="font-mono text-[10px] font-black uppercase text-black">FINAL SCORE</div>
                  <div className="font-display font-black text-5xl text-black leading-none my-1">
                    {displayScore}
                  </div>
                  {displayScore > 0 && displayScore >= highScore && (
                    <div className="font-mono text-xs font-black text-neo-red mt-1">
                      ★ NEW HIGH SCORE RECORD! ★
                    </div>
                  )}
                  <div className="font-mono text-xs font-bold text-zinc-800 mt-1">
                    BEST: {highScore}
                  </div>
                </div>

                {/* Summary */}
                <div className="flex gap-4 justify-center mt-3">
                  <div className="p-2 bg-white border-2 border-black text-xs font-mono font-bold">
                    ❤️ {displayMisses} / {MAX_MISSES} missed
                  </div>
                  <div className="p-2 bg-white border-2 border-black text-xs font-mono font-bold">
                    💣 {displayBombs} / {MAX_BOMBS} bombs
                  </div>
                </div>
              </div>
            )}

            {/* CTA button */}
            <button
              onClick={startGame}
              className="neo-btn-primary w-full py-3.5 text-base uppercase tracking-wider mt-2"
            >
              {gameState === "idle" ? "▶ START SLICING" : "↺ PLAY AGAIN"}
            </button>

            {/* Rules */}
            {gameState === "idle" && (
              <div className="flex flex-col gap-1 mt-6 text-left w-full p-3 bg-white border-2 border-black font-mono text-[11px] font-bold text-zinc-800">
                <div>❤️ Miss 10 fruits = Game Over</div>
                <div>💣 Slicing a bomb triggers Slow-Mo</div>
                <div>💥 Slicing 3 bombs = Defeat</div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fnpulse { from { opacity: 1; } to { opacity: 0.45; } }
      `}</style>
    </div>
  );
}
