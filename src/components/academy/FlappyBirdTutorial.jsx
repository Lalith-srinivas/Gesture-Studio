import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GESTURES } from '../../utils/gestureDetector';
import { useGestureAcademy } from '../../hooks/useGestureAcademy';
import { usePlayer } from '../../hooks/usePlayer';
import { useHandTracking } from '../../hooks/useHandTracking';
import AnimeCam from '../AnimeCam';

// ── Web Audio Synthesizer for Flappy Tutorial ────────────────────────────────
class FlappyAudio {
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
  playFlap() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch {}
  }
  playScore() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [659.25, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.2, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.2);
      });
    } catch {}
  }
  playBump() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch {}
  }
  playFanfare() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
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

const audio = new FlappyAudio();

// ── Physics & Dimensions ───────────────────────────────────────────────────
const CANVAS_W = 420;
const CANVAS_H = 560;
const GRAVITY = 0.15; // Gentle floaty gravity!
const FLAP_FORCE = -5.0; // Smooth controllable lift!
const PIPE_SPEED = 1.8; // Relaxed speed
const BIRD_X = 100;
const BIRD_RADIUS = 15;
const GROUND_H = 65;

// ── Tutorial Stages ────────────────────────────────────────────────────────
const FLAPPY_STAGES = [
  {
    stepIndex: 1,
    title: 'Flap & Hover (Stay Airborne)',
    instruction: 'Open Hand 🖐️ then Pinch 🤏 to Flap!',
    explanation: 'Tap your thumb & index finger together rhythmically to fly.',
    hint: 'Pinch 3 times to maintain altitude without touching the ground.',
    targetFlaps: 3,
    hasPipes: false,
    color: 'bg-neo-yellow',
  },
  {
    stepIndex: 2,
    title: 'High Clearance (Flap Upward)',
    instruction: 'Pinch repeatedly 🤏 to climb high!',
    explanation: 'Quick pinches give smooth altitude lift to clear the pipe.',
    hint: 'Flap upward into the safe flight zone.',
    pipeGapY: 120, // High opening
    pipeGapH: 210, // Extra wide gap
    hasPipes: true,
    color: 'bg-neo-cyan',
  },
  {
    stepIndex: 3,
    title: 'Center Glide (Timing & Control)',
    instruction: 'Pinch 🤏 to glide through the center gap!',
    explanation: 'Let gravity gently lower you, then pinch at the right second.',
    hint: 'One gentle pinch right before entering the opening.',
    pipeGapY: 190, // Center opening
    pipeGapH: 200, // Extra wide gap
    hasPipes: true,
    color: 'bg-orange-300',
  },
  {
    stepIndex: 4,
    title: 'Mastery Flight (Clear 2 Pipes in Rhythm)',
    instruction: 'Fly through 2 pipes in rhythm to become certified!',
    explanation: 'Demonstrate total mastery of gesture flight!',
    hint: 'Pinch in smooth rhythm to navigate consecutive pipes.',
    isMastery: true,
    hasPipes: true,
    color: 'bg-neo-lime',
  },
];

export default function FlappyBirdTutorial({
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

  const [detectedGesture, setDetectedGesture] = useState(GESTURES.NONE);

  useHandTracking({
    videoRef,
    overlayCanvasRef,
    onGesture: (g) => setDetectedGesture((prev) => (prev !== g ? g : prev)),
    enabled: propLiveGesture === undefined,
    modelComplexity: 0,
    cameraWidth: 640,
    cameraHeight: 480,
  });

  const liveGesture = propLiveGesture !== undefined ? propLiveGesture : detectedGesture;
  const { completeGame } = useGestureAcademy('flappy-bird');
  const { recordGameResult } = usePlayer();

  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isCamMinimized, setIsCamMinimized] = useState(false);
  const [flapCount, setFlapCount] = useState(0);

  const stage = FLAPPY_STAGES[currentStageIdx] || FLAPPY_STAGES[0];
  const isPinching = liveGesture === GESTURES.PINCH || liveGesture === GESTURES.PAN || liveGesture === GESTURES.DRAW;

  // Simulation internal state refs
  const simRef = useRef({
    birdY: CANVAS_H / 2 - 20,
    birdVy: 0,
    birdAngle: 0,
    pipes: [],
    flapsDone: 0,
    pipesCleared: 0,
    passedStage: false,
    lastPinchState: false,
    particles: [],
  });

  // Flap action triggered by gesture or keyboard
  const doFlap = useCallback(() => {
    audio.playFlap();
    const sim = simRef.current;
    sim.birdVy = FLAP_FORCE;
    sim.flapsDone += 1;
    setFlapCount(sim.flapsDone);

    // Add wing flap feathers particle effect
    for (let i = 0; i < 4; i++) {
      sim.particles.push({
        x: BIRD_X - 12,
        y: sim.birdY + (Math.random() - 0.5) * 10,
        vx: -(Math.random() * 2 + 1),
        vy: (Math.random() - 0.5) * 2,
        alpha: 1,
        color: '#FFA000',
      });
    }
  }, []);

  // Reset stage
  const resetStage = useCallback((stageIndex, isSoftRetry = false) => {
    const s = FLAPPY_STAGES[stageIndex];
    if (!s) return;

    const sim = simRef.current;
    sim.birdY = CANVAS_H / 2 - 30;
    sim.birdVy = -2;
    sim.birdAngle = 0;
    sim.flapsDone = 0;
    sim.pipesCleared = 0;
    sim.passedStage = false;
    sim.particles = [];
    setFlapCount(0);

    if (s.hasPipes) {
      if (s.isMastery) {
        sim.pipes = [
          { x: CANVAS_W + 50, gapY: 150, gapH: 180, passed: false },
          { x: CANVAS_W + 280, gapY: 220, gapH: 180, passed: false },
        ];
      } else {
        sim.pipes = [
          { x: CANVAS_W + (isSoftRetry ? 30 : 60), gapY: s.pipeGapY, gapH: s.pipeGapH, passed: false },
        ];
      }
    } else {
      sim.pipes = [];
    }

    setIsResetting(true);
    setTimeout(() => setIsResetting(false), 350);
  }, []);

  // Complete tutorial
  const handleCompleteTutorial = useCallback(() => {
    setIsCompleted(true);
    completeGame('flappy-bird');
    recordGameResult?.({
      gameId: 'flappy-bird',
      score: 10,
      sessionId: `flappy_tut_${Date.now()}`,
    });
    audio.playFanfare();
  }, [completeGame, recordGameResult]);

  // Stage advance
  const advanceToNextStage = useCallback(() => {
    const nextIdx = currentStageIdx + 1;
    if (nextIdx < FLAPPY_STAGES.length) {
      setCurrentStageIdx(nextIdx);
      resetStage(nextIdx, false);
      setFeedback({ type: 'success', text: '✓ GREAT FLAP! NEXT STAGE!' });
      setTimeout(() => setFeedback(null), 1800);
    } else {
      handleCompleteTutorial();
    }
  }, [currentStageIdx, resetStage, handleCompleteTutorial]);

  // Handle crash & retry
  const triggerBump = useCallback((reason) => {
    audio.playBump();
    const s = FLAPPY_STAGES[currentStageIdx];
    setFeedback({
      type: 'bump',
      text: reason === 'ground' ? '💥 HIT THE GROUND! PINCH TO FLAP UP!' : '💥 BUMPED PIPE! PINCH TO GLIDE THROUGH GAP!',
    });
    setTimeout(() => setFeedback(null), 2000);
    resetStage(currentStageIdx, true);
  }, [currentStageIdx, resetStage]);

  // Listen to gesture transitions (rising edge trigger on PINCH)
  useEffect(() => {
    const sim = simRef.current;
    if (isPinching && !sim.lastPinchState && !isResetting && !isCompleted) {
      doFlap();
    }
    sim.lastPinchState = isPinching;
  }, [isPinching, doFlap, isResetting, isCompleted]);

  // Initial stage setup
  useEffect(() => {
    resetStage(0);
  }, [resetStage]);

  // Keyboard controls (Space or Up Arrow)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        doFlap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doFlap]);

  // ── Main 60 FPS Game Loop ─────────────────────────────────────────────────
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const loop = () => {
      const sim = simRef.current;
      const s = FLAPPY_STAGES[currentStageIdx];

      // Update Bird Physics
      if (!isResetting && !isCompleted) {
        sim.birdVy += GRAVITY;
        sim.birdVy = Math.min(sim.birdVy, 4.2); // Gentle fall speed cap! No more fast diving!
        sim.birdY += sim.birdVy;
        sim.birdAngle = Math.max(-25, Math.min(65, (sim.birdVy / 5) * 35));

        // Ground collision
        const groundY = CANVAS_H - GROUND_H;
        if (sim.birdY + BIRD_RADIUS >= groundY) {
          triggerBump('ground');
        }

        // Ceiling bounce
        if (sim.birdY - BIRD_RADIUS <= 10) {
          sim.birdY = 10 + BIRD_RADIUS;
          sim.birdVy = 0;
        }

        // Move pipes & collision
        for (const p of sim.pipes) {
          p.x -= PIPE_SPEED;
          const pw = 60;

          // Check Pipe collision (forgiving hitbox for smooth learning)
          if (
            BIRD_X + BIRD_RADIUS * 0.55 > p.x &&
            BIRD_X - BIRD_RADIUS * 0.55 < p.x + pw
          ) {
            if (
              sim.birdY - BIRD_RADIUS * 0.6 < p.gapY ||
              sim.birdY + BIRD_RADIUS * 0.6 > p.gapY + p.gapH
            ) {
              triggerBump('pipe');
              break;
            }
          }

          // Check passed pipe
          if (!p.passed && p.x + pw < BIRD_X) {
            p.passed = true;
            sim.pipesCleared += 1;
            audio.playScore();

            if (s.isMastery) {
              if (sim.pipesCleared >= 2 && !sim.passedStage) {
                sim.passedStage = true;
                setTimeout(advanceToNextStage, 600);
              }
            } else if (s.hasPipes && !sim.passedStage) {
              sim.passedStage = true;
              setTimeout(advanceToNextStage, 600);
            }
          }
        }

        // Step 1: Hover target completed
        if (!s.hasPipes && sim.flapsDone >= s.targetFlaps && !sim.passedStage) {
          sim.passedStage = true;
          audio.playScore();
          setTimeout(advanceToNextStage, 700);
        }
      }

      // Update particles
      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const pt = sim.particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.alpha -= 0.03;
        if (pt.alpha <= 0) sim.particles.splice(i, 1);
      }

      // ── RENDER SCENE ───────────────────────────────────────────────────────
      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      skyGrad.addColorStop(0, '#0d1b2a');
      skyGrad.addColorStop(1, '#1a3a5c');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Starfield dots
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 77) % CANVAS_W);
        const sy = ((i * 43) % (CANVAS_H * 0.65));
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Render Pipes
      for (const p of sim.pipes) {
        const pw = 60;
        const capH = 18;
        const capW = pw + 8;

        const pipeGrad = ctx.createLinearGradient(p.x, 0, p.x + pw, 0);
        pipeGrad.addColorStop(0, '#2ecc71');
        pipeGrad.addColorStop(0.4, '#27ae60');
        pipeGrad.addColorStop(1, '#1e8449');
        ctx.fillStyle = pipeGrad;

        // Top Pipe
        ctx.fillRect(p.x, 0, pw, p.gapY - capH);
        ctx.fillRect(p.x - 4, p.gapY - capH, capW, capH);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(p.x, 0, pw, p.gapY - capH);
        ctx.strokeRect(p.x - 4, p.gapY - capH, capW, capH);

        // Bottom Pipe
        const botH = CANVAS_H - GROUND_H - (p.gapY + p.gapH);
        ctx.fillRect(p.x, p.gapY + p.gapH + capH, pw, botH);
        ctx.fillRect(p.x - 4, p.gapY + p.gapH, capW, capH);
        ctx.strokeRect(p.x, p.gapY + p.gapH + capH, pw, botH);
        ctx.strokeRect(p.x - 4, p.gapY + p.gapH, capW, capH);

        // Pipe highlight
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(p.x + 6, 0, 7, p.gapY - capH);
        ctx.fillRect(p.x + 6, p.gapY + p.gapH + capH, 7, botH);
      }

      // Render Ground
      const groundY = CANVAS_H - GROUND_H;
      const groundGrad = ctx.createLinearGradient(0, groundY, 0, CANVAS_H);
      groundGrad.addColorStop(0, '#5d4037');
      groundGrad.addColorStop(0.4, '#795548');
      groundGrad.addColorStop(1, '#4e342e');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, groundY, CANVAS_W, GROUND_H);

      // Green grass strip
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(0, groundY, CANVAS_W, 8);
      ctx.fillStyle = '#66bb6a';
      ctx.fillRect(0, groundY, CANVAS_W, 3);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(CANVAS_W, groundY);
      ctx.stroke();

      // Render Particles
      for (const pt of sim.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, 4, 3);
        ctx.restore();
      }

      // Render Bird
      ctx.save();
      ctx.translate(BIRD_X, sim.birdY);
      ctx.rotate((sim.birdAngle * Math.PI) / 180);

      // Bird body
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
      const birdGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, BIRD_RADIUS);
      birdGrad.addColorStop(0, '#ffe082');
      birdGrad.addColorStop(0.6, '#ffb300');
      birdGrad.addColorStop(1, '#e65100');
      ctx.fillStyle = birdGrad;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Wing (animates slightly during flap)
      ctx.beginPath();
      const wingFlapOffset = sim.birdVy < 0 ? -4 : 2;
      ctx.ellipse(-5, 3 + wingFlapOffset, 8, 4.5, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffa000';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Eye
      ctx.beginPath();
      ctx.arc(7, -3, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(8.5, -3, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();

      // Beak
      ctx.beginPath();
      ctx.moveTo(11, 2);
      ctx.lineTo(19, 4);
      ctx.lineTo(11, 7);
      ctx.closePath();
      ctx.fillStyle = '#ef6c00';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [currentStageIdx, isResetting, isCompleted, advanceToNextStage, triggerBump]);

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* ── Top Scenario Progression Bar ──────────────────────────────────── */}
      <div className="w-full bg-white border-3 border-black p-4 shadow-neo-md mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono font-black text-xs sm:text-sm uppercase mb-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-neo-lime border border-black animate-pulse" />
            <span>
              STEP {stage.stepIndex} OF 4: {stage.title} (🤏 Pinch to Flap)
            </span>
          </div>
          <span className="text-zinc-600">
            {isCompleted ? '100% COMPLETE' : `${Math.round(((stage.stepIndex - 1) / 4) * 100)}% Complete`}
          </span>
        </div>

        {/* Step Progress Pills */}
        <div className="grid grid-cols-4 gap-2">
          {FLAPPY_STAGES.map((s, idx) => (
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
          <div className={`w-full max-w-[430px] p-3 border-3 border-black shadow-neo mb-3 ${stage.color} flex items-center justify-between gap-3`}>
            <div className="flex items-center gap-2.5">
              <span className="text-3xl sm:text-4xl filter drop-shadow-[1px_1px_0px_#000]">
                🤏
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
          <div className="relative w-full max-w-[430px] aspect-[3/4] bg-black border-4 border-black shadow-neo-xl overflow-hidden rounded-none">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full h-full block select-none"
            />

            {/* ── In-Game Animated 🖐️ -> 🤏 Hand & Subway Surfers Upward Arrow ── */}
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
              <style>{`
                @keyframes handStateOpen {
                  0%, 38% { opacity: 1; transform: scale(1); }
                  48%, 90% { opacity: 0; transform: scale(0.9); }
                  98%, 100% { opacity: 1; transform: scale(1); }
                }
                @keyframes handStatePinch {
                  0%, 38% { opacity: 0; transform: scale(0.9); }
                  48%, 90% { opacity: 1; transform: scale(1.05); }
                  98%, 100% { opacity: 0; transform: scale(0.9); }
                }
                @keyframes handFlapBounce {
                  0%, 38% { transform: translateY(0px); }
                  50% { transform: translateY(-16px); }
                  75% { transform: translateY(-10px); }
                  100% { transform: translateY(0px); }
                }
                @keyframes upwardArrowFlow {
                  0% { stroke-dashoffset: 40; opacity: 0.5; }
                  50% { opacity: 1; }
                  100% { stroke-dashoffset: 0; opacity: 0.5; }
                }
                @keyframes pinchRipple {
                  0% { transform: scale(0.6); opacity: 0.9; }
                  100% { transform: scale(1.5); opacity: 0; }
                }
                @keyframes sparkFlare {
                  0%, 42% { opacity: 0; transform: scale(0.3); }
                  48% { opacity: 1; transform: scale(1.3); }
                  70% { opacity: 0.9; transform: scale(1); }
                  88%, 100% { opacity: 0; transform: scale(0.3); }
                }
              `}</style>

              {/* Subway Surfers Style Upward Arrow Overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none select-none" viewBox="0 0 420 560">
                <defs>
                  <filter id="flappyGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={isPinching ? '#4ADE80' : '#EF4444'} floodOpacity="0.8" />
                  </filter>
                  <linearGradient id="flappyArrowGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#DC2626" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0.95" />
                  </linearGradient>
                  <linearGradient id="flappyGreenGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#16A34A" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#4ADE80" stopOpacity="0.95" />
                  </linearGradient>
                  <linearGradient id="flappyHandGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
                    <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.4" />
                  </linearGradient>
                </defs>

                {/* Vertical Upward Boost Arrow pointing from Bird */}
                <g filter="url(#flappyGlow)">
                  <path
                    d="M 100 370 L 100 230"
                    fill="none"
                    stroke={isPinching ? 'url(#flappyGreenGrad)' : 'url(#flappyArrowGrad)'}
                    strokeWidth="16"
                    strokeLinecap="round"
                  />
                  <polygon
                    points="100,195 75,240 125,240"
                    fill={isPinching ? '#4ADE80' : '#EF4444'}
                    stroke="#000000"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M 100 370 L 100 230"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                    strokeDasharray="8 6"
                    style={{ animation: 'upwardArrowFlow 0.7s linear infinite' }}
                  />
                </g>
              </svg>

              {/* High-Definition Animated Hand: Cycles from 🖐️ (Open) to 🤏 (Pinch) */}
              <div
                className="absolute transition-all duration-300 flex flex-col items-center select-none"
                style={{
                  left: '64%',
                  top: '44%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Flap Wave Ripple upon Pinch */}
                <div
                  className={`absolute -bottom-2 w-32 h-12 rounded-full border-2 transition-colors pointer-events-none ${
                    isPinching ? 'border-neo-lime bg-neo-lime/20' : 'border-white/60 bg-white/10'
                  }`}
                  style={{ animation: 'pinchRipple 1.4s ease-out infinite' }}
                />

                {/* Animated Hand Container with Upward Hop Animation */}
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    animation: isPinching ? 'none' : 'handFlapBounce 1.4s ease-in-out infinite',
                    filter: `drop-shadow(0 0 14px ${isPinching ? 'rgba(74, 222, 128, 0.9)' : 'rgba(255, 255, 255, 0.9)'})`,
                  }}
                >
                  {/* ── PHASE 1: OPEN HAND 🖐️ (Fingers Spread, Ready to Flap) ── */}
                  <div
                    className="transition-all duration-200"
                    style={{
                      animation: isPinching ? 'none' : 'handStateOpen 1.4s ease-in-out infinite',
                      display: isPinching ? 'none' : 'block',
                    }}
                  >
                    <svg width="125" height="145" viewBox="0 0 110 135" className="overflow-visible">
                      {/* Open Palm Body */}
                      <path
                        d="M 30 76 
                           C 28 64, 38 60, 48 64
                           L 66 64
                           C 76 60, 84 64, 84 76
                           L 84 96
                           C 84 114, 70 126, 50 126
                           C 32 126, 22 114, 22 96
                           L 22 82 Z"
                        fill="url(#flappyHandGlass)"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />

                      {/* Extended Thumb (Left) */}
                      <path
                        d="M 22 84
                           C 14 80, 10 68, 20 62
                           C 26 56, 36 60, 36 68"
                        fill="url(#flappyHandGlass)"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />

                      {/* Extended Index Finger */}
                      <path
                        d="M 34 66
                           L 30 18
                           C 28 8, 44 6, 46 16
                           L 48 64"
                        fill="url(#flappyHandGlass)"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <line x1="32" y1="36" x2="44" y2="36" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

                      {/* Extended Middle Finger (Longest) */}
                      <path
                        d="M 48 64
                           L 52 10
                           C 54 2, 68 2, 70 10
                           L 66 64"
                        fill="url(#flappyHandGlass)"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <line x1="52" y1="30" x2="66" y2="30" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

                      {/* Extended Ring Finger */}
                      <path
                        d="M 66 64
                           L 74 18
                           C 76 10, 88 12, 86 22
                           L 78 66"
                        fill="url(#flappyHandGlass)"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <line x1="70" y1="36" x2="82" y2="38" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

                      {/* Extended Pinky Finger */}
                      <path
                        d="M 78 68
                           L 90 32
                           C 92 24, 102 28, 98 38
                           L 84 76"
                        fill="url(#flappyHandGlass)"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <line x1="84" y1="48" x2="94" y2="50" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
                    </svg>
                  </div>

                  {/* ── PHASE 2: PINCH HAND 🤏 (Index & Thumb Pinching Together) ── */}
                  <div
                    className={isPinching ? 'block' : 'absolute inset-0 transition-all duration-200'}
                    style={{
                      animation: isPinching ? 'none' : 'handStatePinch 1.4s ease-in-out infinite',
                    }}
                  >
                    <svg width="125" height="145" viewBox="0 0 110 135" className="overflow-visible">
                      {/* Palm & Base */}
                      <path
                        d="M 30 76 
                           C 30 64, 42 60, 50 64
                           C 54 60, 64 62, 68 66
                           C 72 64, 80 66, 80 76
                           L 80 94
                           C 80 112, 66 124, 48 124
                           C 30 124, 22 112, 22 94
                           L 22 80 Z"
                        fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'url(#flappyHandGlass)'}
                        stroke={isPinching ? '#4ADE80' : '#FFFFFF'}
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />

                      {/* Curled Middle, Ring, Pinky Knuckles */}
                      <path d="M 50 64 C 50 56, 62 56, 62 64 L 62 78 C 62 84, 50 84, 50 78 Z" fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'url(#flappyHandGlass)'} stroke={isPinching ? '#4ADE80' : '#FFFFFF'} strokeWidth="2.5" />
                      <path d="M 62 66 C 62 58, 72 58, 72 66 L 72 80 C 72 86, 62 86, 62 80 Z" fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'url(#flappyHandGlass)'} stroke={isPinching ? '#4ADE80' : '#FFFFFF'} strokeWidth="2.5" />
                      <path d="M 72 70 C 72 62, 80 62, 80 70 L 80 84 C 80 90, 72 90, 72 84 Z" fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'url(#flappyHandGlass)'} stroke={isPinching ? '#4ADE80' : '#FFFFFF'} strokeWidth="2.5" />

                      {/* Index Finger Arcing Down into Pinch with Thumb */}
                      <path
                        d="M 32 74
                           C 30 52, 34 30, 46 20
                           C 54 12, 66 16, 64 28
                           C 62 40, 56 50, 50 54"
                        fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'url(#flappyHandGlass)'}
                        stroke={isPinching ? '#4ADE80' : '#FFFFFF'}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <line x1="40" y1="36" x2="52" y2="34" stroke={isPinching ? '#4ADE80' : '#FFFFFF'} strokeWidth="2" strokeLinecap="round" opacity="0.8" />

                      {/* Thumb Reaching Up to meet Index Finger Tip */}
                      <path
                        d="M 22 86
                           C 18 80, 22 68, 34 68
                           C 42 68, 50 62, 54 52
                           C 56 46, 50 42, 46 48
                           C 40 56, 30 64, 26 78 Z"
                        fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'url(#flappyHandGlass)'}
                        stroke={isPinching ? '#4ADE80' : '#FFFFFF'}
                        strokeWidth="3.2"
                        strokeLinejoin="round"
                      />

                      {/* Pinch Contact Point Spark Ring */}
                      <circle
                        cx="50"
                        cy="50"
                        r={isPinching ? 8 : 6}
                        fill={isPinching ? '#4ADE80' : '#FFE600'}
                        stroke="#000000"
                        strokeWidth="1.5"
                        style={{ animation: 'sparkFlare 1.4s ease-out infinite' }}
                      />
                    </svg>
                  </div>
                </div>

                {/* ── BOLD INSTRUCTION ACTION BADGE ────────────────────────────── */}
                <div
                  className={`mt-2 px-3.5 py-1.5 font-display font-black text-xs uppercase tracking-wider border-3 border-black shadow-neo transition-all duration-200 text-center whitespace-nowrap ${
                    isPinching
                      ? 'bg-neo-lime text-black scale-110 shadow-neo-lg'
                      : 'bg-white text-black'
                  }`}
                >
                  {isPinching ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm">✓</span>
                      <span>FLAP DETECTED!</span>
                    </span>
                  ) : (
                    <div className="flex flex-col items-center leading-tight">
                      <span className="text-xs flex items-center gap-1">
                        <span>🖐️ OPEN</span>
                        <span className="text-neo-pink">➔</span>
                        <span className="text-black font-black">🤏 PINCH</span>
                      </span>
                      <span className="font-mono text-[9px] text-zinc-600 font-bold mt-0.5">
                        {stage.stepIndex === 1 && `FLAP ${flapCount}/3 TO HOVER`}
                        {stage.stepIndex === 2 && 'CLIMB HIGH OVER PIPE'}
                        {stage.stepIndex === 3 && 'GLIDE THROUGH CENTER'}
                        {stage.stepIndex === 4 && 'CLEAR 2 PIPES!'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top In-Canvas Gesture Match Status Pill */}
            <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-2 z-10 pointer-events-none">
              <div className="bg-black/80 backdrop-blur-xs border border-white/40 text-[10px] font-mono font-bold text-white px-2 py-0.5 uppercase tracking-wider">
                Action: 🤏 Pinch / Flap
              </div>
              <div
                className={`border text-[10px] font-mono font-black px-2 py-0.5 uppercase tracking-wider transition-colors ${
                  isPinching
                    ? 'bg-neo-lime border-black text-black shadow-xs'
                    : 'bg-black/80 border-white/40 text-zinc-300'
                }`}
              >
                {isPinching ? '✅ FLAP DETECTED!' : `LIVE: ${liveGesture || 'SEARCHING...'}`}
              </div>
            </div>

            {/* Dynamic In-Game Feedback Banner */}
            {feedback && (
              <div
                className={`absolute top-12 inset-x-4 p-2.5 border-3 border-black shadow-neo font-display font-black text-xs sm:text-sm text-center uppercase tracking-wide animate-in fade-in zoom-in-95 duration-150 z-30 ${
                  feedback.type === 'success' ? 'bg-neo-lime text-black' : 'bg-neo-red text-white'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* Resetting Indicator */}
            {isResetting && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center font-mono font-black text-xs uppercase text-neo-yellow z-30">
                ↺ RESETTING FLIGHT POSITION...
              </div>
            )}
          </div>

          {/* Step Action Buttons & Controls Footer */}
          <div className="w-full max-w-[430px] mt-3 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                audio.playFlap();
                resetStage(currentStageIdx, true);
              }}
              className="flex-1 py-2 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-bold text-xs uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            >
              ↺ Retry Step
            </button>
            <button
              onClick={() => {
                audio.playScore();
                advanceToNextStage();
              }}
              className="flex-1 py-2 bg-neo-yellow hover:bg-yellow-300 border-2 border-black font-display font-black text-xs uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            >
              Skip Step ➔
            </button>
          </div>

          {/* Quick Guidance Footer Note */}
          <div className="w-full max-w-[430px] mt-2.5 text-center text-[11px] font-mono text-zinc-600 font-bold">
            💡 Pinch your thumb and index finger together in front of the camera, or press Space / Up Arrow
          </div>

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
      ) : (
        /* ── Completion & Mastery Screen ───────────────────────────────────── */
        <div className="w-full max-w-xl bg-white border-4 border-black p-6 sm:p-8 shadow-neo-2xl text-center animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 mx-auto mb-4 bg-neo-yellow border-3 border-black shadow-neo flex items-center justify-center text-4xl rounded-2xl rotate-3 hover:rotate-0 transition-transform">
            🐦
          </div>

          <div className="inline-block px-3 py-1 bg-neo-lime border-2 border-black font-mono font-black text-xs uppercase tracking-wider mb-3">
            🏆 FLAPPY BIRD CERTIFIED
          </div>

          <h2 className="font-display font-black text-2xl sm:text-4xl uppercase tracking-tight text-black mb-2">
            You Mastered Gesture Flight!
          </h2>

          <p className="text-zinc-700 text-sm sm:text-base font-medium max-w-md mx-auto mb-6 leading-relaxed">
            You've practiced pinch flapping, altitude hover, and clearing pipe gaps in real time. You are now 100% prepared to set high scores in Flappy Bird!
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            <div className="bg-neo-cream border-2 border-black p-2.5 text-center">
              <span className="text-2xl block mb-1">🤏</span>
              <span className="font-mono font-black text-[10px] uppercase block">Pinch to Flap</span>
            </div>
            <div className="bg-neo-cream border-2 border-black p-2.5 text-center">
              <span className="text-2xl block mb-1">⬆️</span>
              <span className="font-mono font-black text-[10px] uppercase block">Altitude Hover</span>
            </div>
            <div className="bg-neo-cream border-2 border-black p-2.5 text-center">
              <span className="text-2xl block mb-1">🏁</span>
              <span className="font-mono font-black text-[10px] uppercase block">Pipe Navigation</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/flappy-bird')}
              className="w-full sm:w-auto px-8 py-3.5 bg-neo-lime hover:bg-lime-400 border-3 border-black font-display font-black text-sm uppercase tracking-wider shadow-neo hover:shadow-neo-lg active:translate-x-1 active:translate-y-1 transition-all flex items-center justify-center gap-2"
            >
              <span>Play Flappy Bird Now</span>
              <span>➔</span>
            </button>
            <button
              onClick={() => {
                setIsCompleted(false);
                setCurrentStageIdx(0);
                resetStage(0, false);
              }}
              className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-zinc-100 border-3 border-black font-display font-black text-xs uppercase tracking-wider shadow-neo active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              Replay Tutorial ↺
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

