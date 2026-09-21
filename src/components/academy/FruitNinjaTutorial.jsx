import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GESTURES } from '../../utils/gestureDetector';
import { useGestureAcademy } from '../../hooks/useGestureAcademy';
import { usePlayer } from '../../hooks/usePlayer';
import { useHandTracking } from '../../hooks/useHandTracking';
import AnimeCam from '../AnimeCam';

// ── Web Audio Synthesizer for Fruit Ninja Tutorial ───────────────────────────
class FruitNinjaAudio {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playSlice() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  playSplat() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [320, 480, 720].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.03);
        gain.gain.setValueAtTime(0.18, now + i * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.03);
        osc.stop(now + i * 0.03 + 0.15);
      });
    } catch {}
  }

  playBomb() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  playFanfare() {
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      const now = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } catch {}
  }
}

const audio = new FruitNinjaAudio();

// ── Canvas Dimensions & Constants ──────────────────────────────────────────
const CANVAS_W = 440;
const CANVAS_H = 560;
const GRAVITY = 0.09; // Relaxed floaty gravity for friendly tutorial practice
const SLICE_DISTANCE = 32;

// ── Tutorial Stages ────────────────────────────────────────────────────────
const FRUIT_STAGES = [
  {
    stepIndex: 1,
    title: 'Single Fruit Slice',
    instruction: 'Extend Index Finger ☝️ and swipe across the watermelon!',
    explanation: 'Point your index finger and slash through the fruit in mid-air.',
    hint: 'Aim with index finger ☝️ · Slash diagonally across the fruit.',
    fruitCount: 1,
    hasBomb: false,
    color: 'bg-neo-yellow',
  },
  {
    stepIndex: 2,
    title: 'Combo Multi-Slice',
    instruction: 'Slice both fruits in a single fluid swipe 🍊🍍!',
    explanation: 'Connect multiple fruits in one continuous slash for huge combo points!',
    hint: 'Follow the diagonal guide line to slice both fruits together.',
    fruitCount: 2,
    hasBomb: false,
    color: 'bg-neo-cyan',
  },
  {
    stepIndex: 3,
    title: 'Bomb Avoidance & Safety',
    instruction: 'Slice the fruit 🍉, DO NOT touch the bomb 💣!',
    explanation: 'Precision is key! Slice only the fruit, or close your fist ✊ to disarm.',
    hint: 'Slash the watermelon safely · Avoid the bomb at all costs.',
    fruitCount: 1,
    hasBomb: true,
    color: 'bg-orange-300',
  },
  {
    stepIndex: 4,
    title: 'Ninja Frenzy Mastery',
    instruction: 'Swiftly slice 3 fruits before they drop! 🍉🍊🍓',
    explanation: 'Demonstrate total mastery with rapid slashes to become certified!',
    hint: 'Fast, confident slashes with index finger ☝️.',
    fruitCount: 3,
    hasBomb: false,
    isMastery: true,
    color: 'bg-neo-lime',
  },
];

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export default function FruitNinjaTutorial({
  liveGesture: propLiveGesture,
  videoRef: propVideoRef,
  overlayCanvasRef: propOverlayRef,
}) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const internalVideoRef = useRef(null);
  const internalOverlayRef = useRef(null);

  const videoRef = propVideoRef || internalVideoRef;
  const overlayCanvasRef = propOverlayRef || internalOverlayRef;

  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const currentStageIdxRef = useRef(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [isCamMinimized, setIsCamMinimized] = useState(false);
  const [internalLiveGesture, setInternalLiveGesture] = useState(null);

  const { completeGame } = useGestureAcademy('fruit-ninja');
  const { recordGameResult } = usePlayer();

  const liveGesture = propLiveGesture || internalLiveGesture;
  const stage = FRUIT_STAGES[currentStageIdx] || FRUIT_STAGES[0];

  // Gesture state flags
  const isBladeActive = liveGesture === GESTURES.DRAW || liveGesture === 'INDEX_POINT';
  const isFistDisarmed = liveGesture === GESTURES.PAN || liveGesture === 'CLOSED_FIST';

  // Simulation state
  const simRef = useRef({
    fruits: [],
    halves: [],
    particles: [],
    trail: [],
    floatingTexts: [],
    shakeFrames: 0,
    slicedCountInStage: 0,
    comboCount: 0,
    lastTip: null,
    mousePos: null,
    isMouseDown: false,
    handGuideProgress: 0,
    passedStage: false,
  });

  // Spawn fruits configured for the current stage
  const resetStage = useCallback((stageIndex) => {
    const s = FRUIT_STAGES[stageIndex] || FRUIT_STAGES[0];
    const sim = simRef.current;
    sim.fruits = [];
    sim.halves = [];
    sim.particles = [];
    sim.trail = [];
    sim.floatingTexts = [];
    sim.shakeFrames = 0;
    sim.slicedCountInStage = 0;
    sim.comboCount = 0;
    sim.handGuideProgress = 0;
    sim.passedStage = false;

    if (s.stepIndex === 1) {
      // Stage 1: Single gentle watermelon tossed towards center
      sim.fruits.push({
        id: 'fruit-1',
        emoji: '🍉',
        color: '#e74c3c',
        x: 220,
        y: 490,
        vx: 0,
        vy: -7.5,
        radius: 36,
        rotation: 0,
        rotSpeed: 0.015,
        sliced: false,
        isBomb: false,
      });
    } else if (s.stepIndex === 2) {
      // Stage 2: Combo: 2 fruits tossed in line
      sim.fruits.push({
        id: 'fruit-1',
        emoji: '🍊',
        color: '#f97316',
        x: 150,
        y: 490,
        vx: 1.2,
        vy: -8.0,
        radius: 32,
        rotation: 0,
        rotSpeed: 0.02,
        sliced: false,
        isBomb: false,
      });
      sim.fruits.push({
        id: 'fruit-2',
        emoji: '🍍',
        color: '#eab308',
        x: 290,
        y: 500,
        vx: -1.2,
        vy: -8.4,
        radius: 34,
        rotation: 0,
        rotSpeed: -0.02,
        sliced: false,
        isBomb: false,
      });
    } else if (s.stepIndex === 3) {
      // Stage 3: Fruit alongside a bomb
      sim.fruits.push({
        id: 'fruit-1',
        emoji: '🍉',
        color: '#e74c3c',
        x: 140,
        y: 490,
        vx: 0.8,
        vy: -7.8,
        radius: 36,
        rotation: 0,
        rotSpeed: 0.015,
        sliced: false,
        isBomb: false,
      });
      sim.fruits.push({
        id: 'bomb-1',
        emoji: '💣',
        color: '#334155',
        x: 300,
        y: 490,
        vx: -0.8,
        vy: -7.8,
        radius: 32,
        rotation: 0,
        rotSpeed: -0.01,
        sliced: false,
        isBomb: true,
      });
    } else if (s.stepIndex === 4) {
      // Stage 4: Frenzy: 3 fruits
      sim.fruits.push({
        id: 'fruit-1',
        emoji: '🍓',
        color: '#ef4444',
        x: 130,
        y: 500,
        vx: 1.4,
        vy: -8.5,
        radius: 28,
        rotation: 0,
        rotSpeed: 0.03,
        sliced: false,
        isBomb: false,
      });
      sim.fruits.push({
        id: 'fruit-2',
        emoji: '🍉',
        color: '#e74c3c',
        x: 220,
        y: 510,
        vx: 0,
        vy: -8.2,
        radius: 36,
        rotation: 0,
        rotSpeed: -0.02,
        sliced: false,
        isBomb: false,
      });
      sim.fruits.push({
        id: 'fruit-3',
        emoji: '🍋',
        color: '#facc15',
        x: 310,
        y: 500,
        vx: -1.4,
        vy: -8.5,
        radius: 30,
        rotation: 0,
        rotSpeed: 0.025,
        sliced: false,
        isBomb: false,
      });
    }
  }, []);

  // Advance stage logic (protected against multiple triggers)
  const advanceToNextStage = useCallback(() => {
    audio.playSplat();
    const nextIdx = currentStageIdxRef.current + 1;
    if (nextIdx < FRUIT_STAGES.length) {
      setFeedback({ type: 'success', text: 'SLICED! NEXT LESSON →' });
      setTimeout(() => {
        setFeedback(null);
        currentStageIdxRef.current = nextIdx;
        setCurrentStageIdx(nextIdx);
        resetStage(nextIdx);
      }, 700);
    } else {
      audio.playFanfare();
      setIsCompleted(true);
      completeGame('fruit-ninja');
      recordGameResult?.({
        gameId: 'fruit-ninja',
        score: 100,
        sessionId: `fruit_tut_${Date.now()}`,
      });
    }
  }, [resetStage, completeGame, recordGameResult]);

  // Slice execution & collision detection
  const executeSlice = useCallback(
    (x1, y1, x2, y2) => {
      const sim = simRef.current;
      if (sim.passedStage) return;

      const currentStage = FRUIT_STAGES[currentStageIdxRef.current] || FRUIT_STAGES[0];
      let newlySlicedCount = 0;

      for (const fruit of sim.fruits) {
        if (fruit.sliced) continue;

        const dist = distToSegment(fruit.x, fruit.y, x1, y1, x2, y2);
        if (dist <= fruit.radius + 18) {
          if (fruit.isBomb) {
            // Bomb touched!
            audio.playBomb();
            sim.shakeFrames = 18;
            fruit.sliced = true;
            setFeedback({ type: 'error', text: '💥 BOMB DETONATED! AVOID BOMBS 💣' });
            setTimeout(() => {
              setFeedback(null);
              resetStage(currentStageIdxRef.current);
            }, 1000);
            return;
          }

          // Successful fruit slice
          fruit.sliced = true;
          newlySlicedCount++;
          sim.slicedCountInStage++;
          audio.playSlice();

          // Create two splitting halves
          sim.halves.push({
            emoji: fruit.emoji,
            color: fruit.color,
            x: fruit.x - 8,
            y: fruit.y,
            vx: -3.5,
            vy: fruit.vy * 0.6 - 1.5,
            rotation: fruit.rotation,
            rotSpeed: -0.08,
            radius: fruit.radius,
            alpha: 1,
            side: 'left',
          });
          sim.halves.push({
            emoji: fruit.emoji,
            color: fruit.color,
            x: fruit.x + 8,
            y: fruit.y,
            vx: 3.5,
            vy: fruit.vy * 0.6 - 1.5,
            rotation: fruit.rotation,
            rotSpeed: 0.08,
            radius: fruit.radius,
            alpha: 1,
            side: 'right',
          });

          // Burst splash juice particles
          for (let p = 0; p < 18; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            sim.particles.push({
              x: fruit.x,
              y: fruit.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: fruit.color,
              radius: 3 + Math.random() * 4,
              alpha: 1,
            });
          }

          // Floating praise text
          const phrases = ['SLICED!', 'CLEAN CUT!', 'GREAT!', 'NINJA!'];
          const text = phrases[Math.floor(Math.random() * phrases.length)];
          sim.floatingTexts.push({
            text,
            x: fruit.x,
            y: fruit.y - 15,
            color: '#38bdf8',
            alpha: 1,
          });
        }
      }

      if (newlySlicedCount >= 2) {
        audio.playSplat();
        sim.floatingTexts.push({
          text: `COMBO x${newlySlicedCount}! 🔥`,
          x: (x1 + x2) / 2,
          y: (y1 + y2) / 2 - 30,
          color: '#FFE600',
          alpha: 1.2,
        });
      }

      // Check if all target non-bomb fruits in this stage have been sliced
      if (!sim.passedStage) {
        const remainingTargetFruits = sim.fruits.filter((f) => !f.isBomb && !f.sliced);
        if (remainingTargetFruits.length === 0 && sim.slicedCountInStage >= currentStage.fruitCount) {
          sim.passedStage = true;
          advanceToNextStage();
        }
      }
    },
    [advanceToNextStage, resetStage]
  );

  const executeSliceRef = useRef(executeSlice);
  useEffect(() => {
    executeSliceRef.current = executeSlice;
  }, [executeSlice]);

  // Synchronous MediaPipe hand tracking hook
  useHandTracking({
    videoRef,
    overlayCanvasRef,
    onGesture: (gesture, indexTip) => {
      setInternalLiveGesture((prev) => (prev !== gesture ? gesture : prev));
      if (!indexTip || !canvasRef.current) return;

      const c = canvasRef.current;
      const x = (1 - indexTip.x) * c.width;
      const y = indexTip.y * c.height;

      const sim = simRef.current;
      const prevTip = sim.lastTip;

      // Only slice when blade is active (index pointing or moving) and not clenched in a disarm fist
      const isDisarmed = gesture === GESTURES.PAN;

      if (!isDisarmed) {
        sim.trail.push({ x, y, time: Date.now() });
        if (sim.trail.length > 14) sim.trail.shift();

        if (prevTip && Math.hypot(x - prevTip.x, y - prevTip.y) > 4) {
          executeSliceRef.current?.(prevTip.x, prevTip.y, x, y);
        }
      } else {
        sim.trail = [];
      }

      sim.lastTip = { x, y };
    },
    enabled: true,
    modelComplexity: 0,
    cameraWidth: 640,
    cameraHeight: 480,
  });


  // Initialize first stage
  useEffect(() => {
    resetStage(0);
  }, [resetStage]);

  // Main 60 FPS animation loop
  useEffect(() => {
    let animId;

    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const sim = simRef.current;

      // Screen Shake
      ctx.save();
      if (sim.shakeFrames > 0) {
        const sx = (Math.random() - 0.5) * 12;
        const sy = (Math.random() - 0.5) * 12;
        ctx.translate(sx, sy);
        sim.shakeFrames--;
      }

      // Update Hand Guide Progress (sweeps from 0 to 1 repeatedly)
      sim.handGuideProgress = (sim.handGuideProgress + 0.012) % 1;

      // ── Background: Dojo Wood Planks ─────────────────────────────────────
      ctx.fillStyle = '#1c130e';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Wood plank divider lines
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = 3;
      for (let y = 70; y < CANVAS_H; y += 75) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_W, y);
        ctx.stroke();
      }
      // Subtle wood grain sheen
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1.5;
      for (let x = 40; x < CANVAS_W; x += 45) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_H);
        ctx.stroke();
      }

      // ── Update & Draw Intact Fruits ──────────────────────────────────────
      for (const f of sim.fruits) {
        if (!f.sliced) {
          f.vy += GRAVITY;
          f.x += f.vx;
          f.y += f.vy;
          f.rotation += f.rotSpeed;

          // Re-toss if fell below bottom without being sliced
          if (f.y > CANVAS_H + 40 && f.vy > 0) {
            f.y = CANVAS_H + 30;
            f.vy = f.isBomb ? -7.8 : -8.2;
            if (f.x < 160) f.vx = Math.abs(f.vx);
            if (f.x > 280) f.vx = -Math.abs(f.vx);
          }

          // Draw Fruit / Bomb
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rotation);

          // Soft drop shadow
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(4, 10, f.radius * 0.8, f.radius * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();

          // Outer Glow
          ctx.shadowColor = f.color;
          ctx.shadowBlur = f.isBomb ? 8 : 16;

          // Base Circle
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Emoji overlay
          ctx.font = `${f.radius * 1.15}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(f.emoji, 0, 2);

          // Bomb fuse spark
          if (f.isBomb) {
            const sparkPulse = Math.sin(Date.now() / 80) * 3 + 4;
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(f.radius * 0.4, -f.radius * 0.8, sparkPulse, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      // ── Update & Draw Sliced Fruit Halves ─────────────────────────────────
      for (let i = sim.halves.length - 1; i >= 0; i--) {
        const h = sim.halves[i];
        h.vy += GRAVITY * 1.3;
        h.x += h.vx;
        h.y += h.vy;
        h.rotation += h.rotSpeed;
        h.alpha -= 0.015;

        if (h.alpha <= 0 || h.y > CANVAS_H + 60) {
          sim.halves.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, h.alpha);
        ctx.translate(h.x, h.y);
        ctx.rotate(h.rotation);

        // Half silhouette clipping
        ctx.beginPath();
        if (h.side === 'left') {
          ctx.arc(0, 0, h.radius, Math.PI * 0.5, Math.PI * 1.5);
        } else {
          ctx.arc(0, 0, h.radius, -Math.PI * 0.5, Math.PI * 0.5);
        }
        ctx.closePath();
        ctx.fillStyle = h.color;
        ctx.fill();

        // Inner fruit flesh highlight
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -h.radius);
        ctx.lineTo(0, h.radius);
        ctx.stroke();

        ctx.restore();
      }

      // ── Update & Draw Splash Particles ───────────────────────────────────
      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const p = sim.particles[i];
        p.vy += 0.2;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.025;

        if (p.alpha <= 0) {
          sim.particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Draw Blade Swipe Trail (Neon Cyan / White) ───────────────────────
      if (sim.trail.length > 1) {
        for (let i = 1; i < sim.trail.length; i++) {
          const prev = sim.trail[i - 1];
          const cur = sim.trail[i];
          const progress = i / sim.trail.length;

          ctx.save();
          ctx.strokeStyle = `rgba(56, 189, 248, ${progress * 0.9})`;
          ctx.lineWidth = progress * 7;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = progress * 14;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(cur.x, cur.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      // ── Floating Texts ───────────────────────────────────────────────────
      for (let i = sim.floatingTexts.length - 1; i >= 0; i--) {
        const t = sim.floatingTexts[i];
        t.y -= 1.2;
        t.alpha -= 0.02;

        if (t.alpha <= 0) {
          sim.floatingTexts.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, t.alpha);
        ctx.font = '900 20px "Space Grotesk", sans-serif';
        ctx.fillStyle = t.color;
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      }

      ctx.restore(); // restore screen shake

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Mouse / Touch slice handlers for direct testing or fallback
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    const sim = simRef.current;
    sim.isMouseDown = true;
    sim.mousePos = { x, y };
    sim.trail.push({ x, y, time: Date.now() });
  };

  const handleMouseMove = (e) => {
    const sim = simRef.current;
    if (!sim.isMouseDown) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;

    sim.trail.push({ x, y, time: Date.now() });
    if (sim.trail.length > 14) sim.trail.shift();

    if (sim.mousePos) {
      executeSliceRef.current?.(sim.mousePos.x, sim.mousePos.y, x, y);
    }
    sim.mousePos = { x, y };
  };

  const handleMouseUp = () => {
    const sim = simRef.current;
    sim.isMouseDown = false;
    sim.mousePos = null;
    sim.trail = [];
  };

  const handleTouchStart = (e) => {
    if (!e.touches?.[0]) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.touches[0].clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.touches[0].clientY - rect.top) / rect.height) * CANVAS_H;
    const sim = simRef.current;
    sim.isMouseDown = true;
    sim.mousePos = { x, y };
    sim.trail.push({ x, y, time: Date.now() });
  };

  const handleTouchMove = (e) => {
    if (!e.touches?.[0]) return;
    const sim = simRef.current;
    if (!sim.isMouseDown) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.touches[0].clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.touches[0].clientY - rect.top) / rect.height) * CANVAS_H;

    sim.trail.push({ x, y, time: Date.now() });
    if (sim.trail.length > 14) sim.trail.shift();

    if (sim.mousePos) {
      executeSliceRef.current?.(sim.mousePos.x, sim.mousePos.y, x, y);
    }
    sim.mousePos = { x, y };
  };

  const handleTouchEnd = () => {
    const sim = simRef.current;
    sim.isMouseDown = false;
    sim.mousePos = null;
    sim.trail = [];
  };

  // Stage guide path coordinates
  const handStartX = stage.stepIndex === 1 ? 110 : stage.stepIndex === 2 ? 90 : 80;
  const handStartY = stage.stepIndex === 1 ? 370 : stage.stepIndex === 2 ? 390 : stage.stepIndex === 3 ? 360 : 340;
  const handEndX = stage.stepIndex === 1 ? 330 : stage.stepIndex === 2 ? 350 : stage.stepIndex === 3 ? 210 : 360;
  const handEndY = stage.stepIndex === 1 ? 190 : stage.stepIndex === 2 ? 170 : stage.stepIndex === 3 ? 210 : 220;

  return (
    <div className="w-full flex flex-col items-center select-none">
      <style>{`
        @keyframes slashBeamFlow {
          0% { stroke-dashoffset: 60; opacity: 0.7; }
          50% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0.7; }
        }
        @keyframes fruitSwipe1 {
          0% { transform: translate(110px, 370px) translate(-50%, -50%); opacity: 0.2; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translate(330px, 190px) translate(-50%, -50%); opacity: 0.2; }
        }
        @keyframes fruitSwipe2 {
          0% { transform: translate(90px, 390px) translate(-50%, -50%); opacity: 0.2; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translate(350px, 170px) translate(-50%, -50%); opacity: 0.2; }
        }
        @keyframes fruitSwipe3 {
          0% { transform: translate(80px, 360px) translate(-50%, -50%); opacity: 0.2; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translate(210px, 210px) translate(-50%, -50%); opacity: 0.2; }
        }
        @keyframes fruitSwipe4 {
          0% { transform: translate(80px, 340px) translate(-50%, -50%); opacity: 0.2; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translate(360px, 220px) translate(-50%, -50%); opacity: 0.2; }
        }
      `}</style>

      {/* ── Top Scenario Progression Bar ──────────────────────────────────── */}
      <div className="w-full bg-white border-3 border-black p-4 shadow-neo-md mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono font-black text-xs sm:text-sm uppercase mb-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-neo-lime border border-black animate-pulse" />
            <span>
              STEP {stage.stepIndex} OF 4: {stage.title}
            </span>
          </div>
          <span className="text-zinc-600">
            {isCompleted ? '100% COMPLETE' : `${Math.round(((stage.stepIndex - 1) / 4) * 100)}% Complete`}
          </span>
        </div>

        {/* Step Progress Pills */}
        <div className="grid grid-cols-4 gap-2">
          {FRUIT_STAGES.map((s, idx) => (
            <div
              key={s.stepIndex}
              className={`h-3 border-2 border-black transition-all ${
                idx < currentStageIdx || isCompleted
                  ? 'bg-neo-lime'
                  : idx === currentStageIdx
                  ? 'bg-neo-yellow animate-pulse'
                  : 'bg-zinc-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Main Centered Interactive Game Stage ─────────────────────────── */}
      {!isCompleted ? (
        <div className="w-full max-w-xl flex flex-col items-center">
          {/* Stage Prompt Banner */}
          <div
            className={`w-full max-w-[440px] p-3 border-3 border-black shadow-neo mb-3 ${stage.color} flex items-center justify-between gap-3`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-3xl sm:text-4xl filter drop-shadow-[1px_1px_0px_#000]">
                {stage.hasBomb ? '💣' : '🍉'}
              </span>
              <div>
                <h3 className="font-display font-black text-xs sm:text-sm uppercase tracking-tight text-black leading-tight">
                  {stage.instruction}
                </h3>
                <p className="font-mono text-[10px] sm:text-[11px] text-zinc-800 font-bold">
                  {stage.explanation}
                </p>
              </div>
            </div>
            <span className="neo-tag bg-white font-mono text-[9px] font-black uppercase shrink-0">
              STEP {stage.stepIndex}/4
            </span>
          </div>

          {/* Centered Game Canvas Container */}
          <div className="relative w-full max-w-[440px] aspect-[3/4] bg-black border-4 border-black shadow-neo-xl overflow-hidden rounded-none cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className="w-full h-full block select-none touch-none"
            />

            {/* ── Luminous Directional Swipe Trail Overlay (Subway Surfers Style) ── */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none select-none z-10"
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            >
              <defs>
                <filter id="slashGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#38BDF8" floodOpacity="0.9" />
                </filter>
                <linearGradient id="slashGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.3" />
                </linearGradient>
              </defs>

              <g filter="url(#slashGlow)">
                {/* Broad glowing trajectory path */}
                <line
                  x1={handStartX}
                  y1={handStartY}
                  x2={handEndX}
                  y2={handEndY}
                  stroke="url(#slashGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Flowing animated dashes */}
                <line
                  x1={handStartX}
                  y1={handStartY}
                  x2={handEndX}
                  y2={handEndY}
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                  strokeDasharray="14 10"
                  style={{ animation: 'slashBeamFlow 0.8s linear infinite' }}
                />
                {/* Arrowhead at end of slash */}
                <polygon
                  points={`${handEndX},${handEndY - 10} ${handEndX + 16},${handEndY + 8} ${handEndX - 8},${handEndY + 8}`}
                  fill="#38BDF8"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  transform={`rotate(${
                    (Math.atan2(handEndY - handStartY, handEndX - handStartX) * 180) / Math.PI + 90
                  }, ${handEndX}, ${handEndY})`}
                />
              </g>
            </svg>

            {/* ── Semi-Transparent Animated Hand Overlay (☝️ Index Pointing / Fist) ── */}
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
              <div
                className="absolute flex flex-col items-center select-none"
                style={{
                  top: 0,
                  left: 0,
                  animation:
                    stage.stepIndex === 1
                      ? 'fruitSwipe1 1.4s ease-in-out infinite'
                      : stage.stepIndex === 2
                      ? 'fruitSwipe2 1.4s ease-in-out infinite'
                      : stage.stepIndex === 3
                      ? 'fruitSwipe3 1.4s ease-in-out infinite'
                      : 'fruitSwipe4 1.4s ease-in-out infinite',
                }}
              >
                {/* Hand Vector: Semi-transparent white with glowing border */}
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    filter: `drop-shadow(0 0 14px ${
                      isBladeActive
                        ? 'rgba(56, 189, 248, 0.95)'
                        : isFistDisarmed
                        ? 'rgba(239, 68, 68, 0.95)'
                        : 'rgba(255, 255, 255, 0.9)'
                    })`,
                  }}
                >
                  {stage.stepIndex === 3 ? (
                    // Closed Fist (Demonstrates disarming blade near bomb)
                    <svg width="105" height="125" viewBox="0 0 100 120" className="overflow-visible">
                      <path
                        d="M 26 62 C 26 44, 40 40, 52 40 C 64 40, 78 44, 78 62 L 78 86 C 78 104, 66 114, 52 114 C 36 114, 26 104, 26 86 Z"
                        fill="rgba(255, 255, 255, 0.35)"
                        stroke="#FFFFFF"
                        strokeWidth="3.8"
                        strokeLinejoin="round"
                      />
                      <line x1="34" y1="42" x2="34" y2="66" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                      <line x1="48" y1="40" x2="48" y2="64" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                      <line x1="62" y1="42" x2="62" y2="66" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                      <path
                        d="M 24 74 C 24 64, 34 60, 48 62 C 62 64, 72 66, 76 74 C 78 80, 72 86, 62 86 L 38 86 C 28 86, 24 82, 24 74 Z"
                        fill="rgba(255, 255, 255, 0.35)"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    // Extended Index Finger (☝️ Katana Blade Slash)
                    <svg width="115" height="145" viewBox="0 0 100 130" className="overflow-visible">
                      {/* Palm and Base */}
                      <path
                        d="M 36 68 C 36 56, 46 54, 52 56 C 56 54, 66 54, 70 58 C 74 56, 84 58, 84 68 L 84 94 C 84 112, 70 124, 50 124 C 32 124, 24 112, 24 94 L 24 76 C 24 66, 30 64, 36 68 Z"
                        fill={isBladeActive ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 255, 255, 0.38)'}
                        stroke={isBladeActive ? '#38bdf8' : '#FFFFFF'}
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />
                      {/* Extended Index Finger */}
                      <path
                        d="M 34 70 L 34 18 C 34 8, 50 8, 50 18 L 50 62"
                        fill={isBladeActive ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 255, 255, 0.38)'}
                        stroke={isBladeActive ? '#38bdf8' : '#FFFFFF'}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Index Fingernail & Creases */}
                      <path d="M 37 18 C 37 12, 47 12, 47 18" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                      <line x1="36" y1="36" x2="48" y2="36" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
                      <line x1="36" y1="52" x2="48" y2="52" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />

                      {/* Folded Middle, Ring, Pinky Knuckles */}
                      <path d="M 50 62 C 50 54, 66 54, 66 62 L 66 78 C 66 84, 50 84, 50 78 Z" fill="rgba(255, 255, 255, 0.35)" stroke="#FFFFFF" strokeWidth="2.5" />
                      <path d="M 66 64 C 66 56, 78 56, 78 64 L 78 80 C 78 86, 66 86, 66 80 Z" fill="rgba(255, 255, 255, 0.35)" stroke="#FFFFFF" strokeWidth="2.5" />
                      <path d="M 78 68 C 78 60, 86 60, 86 68 L 86 84 C 86 90, 78 90, 78 84 Z" fill="rgba(255, 255, 255, 0.35)" stroke="#FFFFFF" strokeWidth="2.5" />

                      {/* Thumb folded across palm */}
                      <path
                        d="M 24 82 C 18 78, 20 68, 30 70 C 38 72, 48 76, 54 82 C 58 86, 52 90, 46 88 C 36 84, 28 86, 24 82 Z"
                        fill="rgba(255, 255, 255, 0.35)"
                        stroke="#FFFFFF"
                        strokeWidth="3"
                        strokeLinejoin="round"
                      />
                      {/* Blade energy spark at fingertip */}
                      <circle cx="42" cy="12" r="5" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1.5" />
                    </svg>
                  )}
                </div>

                {/* ── Bold Action Instruction Pill ── */}
                <div
                  className={`mt-2 px-3 py-1 font-display font-black text-xs uppercase tracking-wider border-3 border-black shadow-neo transition-all duration-200 text-center whitespace-nowrap ${
                    isBladeActive
                      ? 'bg-neo-lime text-black scale-105'
                      : isFistDisarmed
                      ? 'bg-red-400 text-black scale-105'
                      : 'bg-white text-black'
                  }`}
                >
                  {isBladeActive
                    ? '☝️ BLADE READY! SWIPE TO SLICE'
                    : isFistDisarmed
                    ? '✊ BLADE DISARMED (SAFE FROM BOMBS)'
                    : stage.hasBomb
                    ? '🍉 SLICE FRUIT · 💣 AVOID BOMB'
                    : 'POINT INDEX FINGER ☝️ · SWIPE TO SLICE'}
                </div>
              </div>

              {/* Feedback Overlay Toast */}
              {feedback && (
                <div className="absolute top-6 inset-x-4 flex justify-center z-30 animate-bounce">
                  <div
                    className={`px-4 py-2 border-3 border-black shadow-neo font-mono font-black text-xs uppercase tracking-wider ${
                      feedback.type === 'success' ? 'bg-neo-lime text-black' : 'bg-red-400 text-white'
                    }`}
                  >
                    {feedback.text}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls helper bar */}
          <div className="mt-3 flex items-center justify-between w-full max-w-[440px] text-xs font-mono font-bold text-zinc-600 px-1">
            <span>[☝️] INDEX EXTENDED TO SLICE | [✊] CLOSED FIST DISARMS</span>
            <button
              onClick={() => {
                simRef.current.passedStage = false;
                resetStage(currentStageIdxRef.current);
              }}
              className="text-black underline font-black hover:text-zinc-800"
            >
              Reset Fruits ↺
            </button>
          </div>
        </div>
      ) : (
        /* ── Completion & Mastery Screen ─────────────────────────────────── */
        <div className="w-full max-w-xl bg-white border-4 border-black p-8 shadow-neo-xl text-center">
          <div className="inline-block p-4 bg-neo-yellow border-3 border-black shadow-neo mb-4 text-5xl">
            🍉
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-black mb-2">
            NINJA CERTIFICATION UNLOCKED!
          </h2>
          <p className="text-zinc-700 font-mono text-sm max-w-md mx-auto mb-6">
            Spectacular swordplay! You have mastered the index finger katana slice, combo multi-slashes, bomb avoidance, and frenzy speed.
          </p>

          <div className="bg-neo-lime border-3 border-black p-4 mb-6 inline-block font-mono font-black text-base shadow-neo">
            🏆 +50 XP EARNED & FRUIT NINJA BLADE BADGE UNLOCKED!
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/fruit-ninja')}
              className="w-full sm:w-auto px-6 py-3 bg-neo-yellow hover:bg-yellow-300 border-3 border-black font-display font-black text-sm uppercase shadow-neo active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            >
              Play Full Fruit Ninja →
            </button>
            <button
              onClick={() => {
                setIsCompleted(false);
                currentStageIdxRef.current = 0;
                setCurrentStageIdx(0);
                resetStage(0);
              }}
              className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-zinc-100 border-3 border-black font-mono font-black text-sm uppercase shadow-neo active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            >
              Replay Tutorial ↺
            </button>
          </div>
        </div>
      )}

      {/* ── Corner Floating PiP AnimeCam Feed ───────────────────────────────── */}
      <div
        className={`fixed bottom-4 right-4 z-40 bg-black border-3 border-black shadow-neo-lg transition-all duration-300 overflow-hidden ${
          isCamMinimized ? 'w-16 h-16' : 'w-48 sm:w-56'
        }`}
      >
        <div className="bg-black text-white px-2 py-1 flex items-center justify-between text-[10px] font-mono font-bold z-10 relative">
          <span className="truncate">
            {isCamMinimized ? 'ANIME CAM' : `ANIME CAM · ${liveGesture || 'READY'}`}
          </span>
          <button
            onClick={() => setIsCamMinimized(!isCamMinimized)}
            className="text-zinc-300 hover:text-white px-1"
          >
            {isCamMinimized ? '▢' : '—'}
          </button>
        </div>

        {!isCamMinimized && (
          <div className="relative aspect-[4/3] bg-zinc-950 overflow-hidden">
            <AnimeCam videoRef={videoRef} overlayCanvasRef={overlayCanvasRef} />
            <video
              ref={videoRef}
              className="hidden"
              playsInline
              muted
              autoPlay
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

