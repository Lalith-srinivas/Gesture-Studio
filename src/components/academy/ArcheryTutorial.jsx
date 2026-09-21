import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GESTURES } from '../../utils/gestureDetector';
import { useGestureAcademy } from '../../hooks/useGestureAcademy';
import { usePlayer } from '../../hooks/usePlayer';
import { useHandTracking } from '../../hooks/useHandTracking';

// ── Web Audio Synthesizer for Archery Tutorial ─────────────────────────────
class ArcheryAudio {
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
  playTension() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(160, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch {}
  }
  playRelease() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.14);
    } catch {}
  }
  playHit(isBullseye = false) {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isBullseye ? 'sine' : 'square';
      osc.frequency.setValueAtTime(isBullseye ? 950 : 260, this.ctx.currentTime);
      if (isBullseye) {
        osc.frequency.exponentialRampToValueAtTime(1600, this.ctx.currentTime + 0.2);
      }
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (isBullseye ? 0.3 : 0.15));
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + (isBullseye ? 0.3 : 0.15));
    } catch {}
  }
  playFanfare() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
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

const audio = new ArcheryAudio();

const CANVAS_W = 440;
const CANVAS_H = 560;
const BOW_X = 90;
const BOW_Y = 320;

// ── Archery Tutorial Stages ────────────────────────────────────────────────
const ARCHERY_STAGES = [
  {
    stepIndex: 1,
    title: 'Draw & Release (First Shot)',
    instruction: 'Pinch 🤏 to Draw Bow, then Release 🖐️ to Shoot!',
    explanation: 'Grip the bowstring by pinching, then open your hand to release the arrow.',
    hint: 'Pinch 🤏 -> pull back -> Open 🖐️ to hit the target.',
    targetY: 320,
    moving: false,
    color: 'bg-neo-yellow',
  },
  {
    stepIndex: 2,
    title: 'Long Distance (Full Power)',
    instruction: 'Pinch & pull further back 🤏 to build maximum tension!',
    explanation: 'Holding tension increases arrow speed and accuracy.',
    hint: 'Pull all the way back before opening your hand.',
    targetY: 260,
    moving: false,
    color: 'bg-neo-cyan',
  },
  {
    stepIndex: 3,
    title: 'Moving Target (Time the Release)',
    instruction: 'Target is on the move! Time your release 🖐️!',
    explanation: 'Wait until the bullseye aligns with your sightline.',
    hint: 'Release when the moving target reaches the center.',
    targetY: 300,
    moving: true,
    color: 'bg-orange-300',
  },
  {
    stepIndex: 4,
    title: 'Cancel Shot (Tactical Control)',
    instruction: 'Pinch 🤏 to draw, then make a Closed Fist ✊ to Cancel!',
    explanation: 'Avoid wasting arrows when your aim is off by closing your fist.',
    hint: 'Draw the bowstring, then show a closed fist to cancel.',
    targetY: 320,
    moving: false,
    isCancelStep: true,
    color: 'bg-neo-lime',
  },
];

export default function ArcheryTutorial({
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
    onGesture: (g) => setDetectedGesture(g),
    enabled: propLiveGesture === undefined,
  });

  const liveGesture = propLiveGesture !== undefined ? propLiveGesture : detectedGesture;
  const { completeGame } = useGestureAcademy('archery');
  const { recordGameResult } = usePlayer();

  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isCamMinimized, setIsCamMinimized] = useState(false);

  const stage = ARCHERY_STAGES[currentStageIdx] || ARCHERY_STAGES[0];
  const isPinching = liveGesture === GESTURES.PINCH;
  const isFist = liveGesture === GESTURES.PAN;

  // Simulation state refs
  const simRef = useRef({
    bow: {
      tension: 0,
      isAiming: false,
      pullX: BOW_X,
      pullY: BOW_Y,
    },
    arrows: [],
    target: {
      x: 350,
      y: 320,
      baseY: 320,
      speed: 1.6,
      radius: 42,
      dir: 1,
    },
    lastPinch: false,
    particles: [],
    passedStage: false,
  });

  // Shoot arrow
  const fireArrow = useCallback(() => {
    const sim = simRef.current;
    if (!sim.bow.isAiming || sim.bow.tension < 0.15) return;

    audio.playRelease();
    const power = sim.bow.tension * 16 + 6;
    sim.arrows.push({
      x: BOW_X,
      y: BOW_Y,
      vx: power,
      vy: 0,
      stuck: false,
    });
    sim.bow.isAiming = false;
    sim.bow.tension = 0;
  }, []);

  // Reset stage
  const resetStage = useCallback((stageIndex) => {
    const s = ARCHERY_STAGES[stageIndex];
    if (!s) return;

    const sim = simRef.current;
    sim.bow = { tension: 0, isAiming: false, pullX: BOW_X, pullY: BOW_Y };
    sim.arrows = [];
    sim.target = {
      x: 350,
      y: s.targetY,
      baseY: s.targetY,
      speed: s.moving ? 1.6 : 0,
      radius: 42,
      dir: 1,
    };
    sim.particles = [];
    sim.passedStage = false;
    setIsResetting(true);
    setTimeout(() => setIsResetting(false), 300);
  }, []);

  // Complete tutorial
  const handleCompleteTutorial = useCallback(() => {
    setIsCompleted(true);
    completeGame('archery');
    recordGameResult?.({
      gameId: 'archery',
      score: 100,
      sessionId: `archery_tut_${Date.now()}`,
    });
    audio.playFanfare();
  }, [completeGame, recordGameResult]);

  // Stage advance
  const advanceToNextStage = useCallback(() => {
    const nextIdx = currentStageIdx + 1;
    if (nextIdx < ARCHERY_STAGES.length) {
      setCurrentStageIdx(nextIdx);
      resetStage(nextIdx);
      setFeedback({ type: 'success', text: '🎯 TARGET HIT! NEXT STAGE!' });
      setTimeout(() => setFeedback(null), 1800);
    } else {
      handleCompleteTutorial();
    }
  }, [currentStageIdx, resetStage, handleCompleteTutorial]);

  // Gesture handling
  useEffect(() => {
    const sim = simRef.current;
    const s = ARCHERY_STAGES[currentStageIdx];

    // 1. PINCH to aim / draw bow
    if (isPinching && !isResetting && !isCompleted) {
      if (!sim.bow.isAiming) {
        sim.bow.isAiming = true;
        audio.playTension();
      }
      sim.bow.tension = Math.min(1, sim.bow.tension + 0.04);
    }
    // 2. RELEASE PINCH -> Fire Arrow
    else if (sim.lastPinch && !isPinching && sim.bow.isAiming) {
      if (s.isCancelStep) {
        // Did not cancel with fist
        setFeedback({ type: 'bump', text: 'Close fist ✊ to cancel instead of releasing!' });
        setTimeout(() => setFeedback(null), 1800);
        sim.bow.isAiming = false;
        sim.bow.tension = 0;
      } else {
        fireArrow();
      }
    }
    // 3. FIST to Cancel
    else if (isFist && sim.bow.isAiming) {
      sim.bow.isAiming = false;
      sim.bow.tension = 0;
      audio.playTension();
      if (s.isCancelStep && !sim.passedStage) {
        sim.passedStage = true;
        audio.playHit(true);
        setFeedback({ type: 'success', text: '✓ SHOT CANCELLED WITH FIST! PERFECT!' });
        setTimeout(advanceToNextStage, 1200);
      }
    }

    sim.lastPinch = isPinching;
  }, [isPinching, isFist, isResetting, isCompleted, currentStageIdx, fireArrow, advanceToNextStage]);

  // Initial stage setup
  useEffect(() => {
    resetStage(0);
  }, [resetStage]);

  // Keyboard controls (Space to draw, release Space to shoot, 'C' to cancel)
  useEffect(() => {
    const sim = simRef.current;
    const onDown = (e) => {
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        sim.bow.isAiming = true;
        sim.bow.tension = Math.min(1, sim.bow.tension + 0.1);
        audio.playTension();
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'f' || e.key === 'F') {
        sim.bow.isAiming = false;
        sim.bow.tension = 0;
        const s = ARCHERY_STAGES[currentStageIdx];
        if (s.isCancelStep) advanceToNextStage();
      }
    };
    const onUp = (e) => {
      if (e.key === ' ' || e.key === 'ArrowRight') {
        const s = ARCHERY_STAGES[currentStageIdx];
        if (!s.isCancelStep) fireArrow();
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [currentStageIdx, fireArrow, advanceToNextStage]);

  // ── 60 FPS Game Loop ──────────────────────────────────────────────────────
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const loop = () => {
      const sim = simRef.current;
      const s = ARCHERY_STAGES[currentStageIdx];

      // Update Moving Target
      if (s.moving) {
        sim.target.y += sim.target.speed * sim.target.dir;
        if (sim.target.y < s.baseY - 70) sim.target.dir = 1;
        if (sim.target.y > s.baseY + 70) sim.target.dir = -1;
      }

      // Update Arrows
      for (let i = sim.arrows.length - 1; i >= 0; i--) {
        const arr = sim.arrows[i];
        if (!arr.stuck) {
          arr.x += arr.vx;

          // Check hit on target
          const dist = Math.hypot(arr.x - sim.target.x, arr.y - sim.target.y);
          if (dist < sim.target.radius) {
            arr.stuck = true;
            const isBullseye = dist < 14;
            audio.playHit(isBullseye);

            // Add hit spark particles
            for (let k = 0; k < 12; k++) {
              const ang = Math.random() * Math.PI * 2;
              sim.particles.push({
                x: arr.x,
                y: arr.y,
                vx: Math.cos(ang) * 4,
                vy: Math.sin(ang) * 4,
                alpha: 1,
                color: isBullseye ? '#FFE600' : '#EF4444',
              });
            }

            if (!sim.passedStage && !s.isCancelStep) {
              sim.passedStage = true;
              setTimeout(advanceToNextStage, 700);
            }
          }

          // Off screen miss
          if (arr.x > CANVAS_W + 50) {
            sim.arrows.splice(i, 1);
            setFeedback({ type: 'bump', text: '💥 MISSED TARGET! DRAW & AIM AGAIN!' });
            setTimeout(() => setFeedback(null), 1800);
          }
        }
      }

      // Update particles
      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const p = sim.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.04;
        if (p.alpha <= 0) sim.particles.splice(i, 1);
      }

      // ── RENDER SCENE ───────────────────────────────────────────────────────
      // Background gradient (Dojo Dojo / Range)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      bgGrad.addColorStop(0, '#1e293b');
      bgGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Floor / Grass
      ctx.fillStyle = '#15803d';
      ctx.fillRect(0, CANVAS_H - 70, CANVAS_W, 70);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, CANVAS_H - 70, CANVAS_W, 6);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H - 70);
      ctx.lineTo(CANVAS_W, CANVAS_H - 70);
      ctx.stroke();

      // Render Target (Traditional Archery Rings)
      const tg = sim.target;
      ctx.save();
      ctx.translate(tg.x, tg.y);

      // Target stand pole
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-4, 0, 8, CANVAS_H - 70 - tg.y);

      // Target rings
      const rings = [
        { r: tg.radius, color: '#FFFFFF' },
        { r: tg.radius * 0.75, color: '#1E293B' },
        { r: tg.radius * 0.5, color: '#38BDF8' },
        { r: tg.radius * 0.3, color: '#EF4444' },
        { r: tg.radius * 0.14, color: '#FFE600' },
      ];
      rings.forEach((rg) => {
        ctx.beginPath();
        ctx.arc(0, 0, rg.r, 0, Math.PI * 2);
        ctx.fillStyle = rg.color;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      });
      ctx.restore();

      // Render Bow & String
      const bowPullBack = sim.bow.tension * 28;
      ctx.save();
      ctx.translate(BOW_X, BOW_Y);

      // Bow Limb (Curved Wood)
      ctx.beginPath();
      ctx.arc(-bowPullBack * 0.2, 0, 60, -Math.PI * 0.38, Math.PI * 0.38);
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Bowstring
      const topTipX = -bowPullBack * 0.2 + Math.cos(-Math.PI * 0.38) * 60;
      const topTipY = Math.sin(-Math.PI * 0.38) * 60;
      const botTipX = -bowPullBack * 0.2 + Math.cos(Math.PI * 0.38) * 60;
      const botTipY = Math.sin(Math.PI * 0.38) * 60;

      ctx.beginPath();
      ctx.moveTo(topTipX, topTipY);
      ctx.lineTo(-bowPullBack, 0); // string nock point
      ctx.lineTo(botTipX, botTipY);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Arrow loaded on bow (if aiming)
      if (sim.bow.isAiming) {
        ctx.beginPath();
        ctx.moveTo(-bowPullBack, 0);
        ctx.lineTo(-bowPullBack + 65, 0);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(-bowPullBack + 65, 0);
        ctx.lineTo(-bowPullBack + 58, -5);
        ctx.lineTo(-bowPullBack + 58, 5);
        ctx.closePath();
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();

      // Render Flying / Stuck Arrows
      for (const arr of sim.arrows) {
        ctx.save();
        ctx.translate(arr.x, arr.y);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-45, 0);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-8, -4);
        ctx.lineTo(-8, 4);
        ctx.closePath();
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();

        // Fletching feathers
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-45, -3, 8, 6);
        ctx.restore();
      }

      // Render Particles
      for (const p of sim.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [currentStageIdx, advanceToNextStage]);

  return (
    <div className="w-full flex flex-col items-center select-none">
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
          {ARCHERY_STAGES.map((s, idx) => (
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
          <div className={`w-full max-w-[440px] p-3 border-3 border-black shadow-neo mb-3 ${stage.color} flex items-center justify-between gap-3`}>
            <div className="flex items-center gap-2.5">
              <span className="text-3xl sm:text-4xl filter drop-shadow-[1px_1px_0px_#000]">
                {stage.isCancelStep ? '✊' : '🏹'}
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
          <div className="relative w-full max-w-[440px] aspect-[3/4] bg-black border-4 border-black shadow-neo-xl overflow-hidden rounded-none">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full h-full block select-none"
            />

            {/* ── Subway Surfers Aim Arrow & Animated Hand Overlay ─────────── */}
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
              <style>{`
                @keyframes archeryDrawRelease {
                  0%, 25% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                  45%, 70% { opacity: 1; transform: translate(-70%, -50%) scale(1.05); }
                  82%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
                }
                @keyframes arrowAimFlow {
                  0% { stroke-dashoffset: 40; opacity: 0.5; }
                  50% { opacity: 1; }
                  100% { stroke-dashoffset: 0; opacity: 0.5; }
                }
              `}</style>

              {/* Subway Surfers Style Flight Arrow to Target */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none select-none" viewBox="0 0 440 560">
                <defs>
                  <filter id="archeryGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#EF4444" floodOpacity="0.8" />
                  </filter>
                  <linearGradient id="archeryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0.95" />
                  </linearGradient>
                </defs>

                {!stage.isCancelStep && (
                  <g filter="url(#archeryGlow)">
                    <path
                      d={`M 140 320 L 320 ${stage.targetY}`}
                      fill="none"
                      stroke="url(#archeryGrad)"
                      strokeWidth="14"
                      strokeLinecap="round"
                    />
                    <polygon
                      points={`340,${stage.targetY} 315,${stage.targetY - 18} 315,${stage.targetY + 18}`}
                      fill="#EF4444"
                      stroke="#000000"
                      strokeWidth="2.5"
                    />
                    <path
                      d={`M 140 320 L 320 ${stage.targetY}`}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="3.5"
                      strokeDasharray="8 6"
                      style={{ animation: 'arrowAimFlow 0.7s linear infinite' }}
                    />
                  </g>
                )}
              </svg>

              {/* Animated White Semi-Transparent Hand Overlay */}
              <div
                className="absolute transition-all duration-300 flex flex-col items-center select-none"
                style={{
                  left: '42%',
                  top: '56%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Hand Vector: Demonstrating Pinch Draw -> Open Release */}
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    filter: `drop-shadow(0 0 14px ${isPinching ? 'rgba(74, 222, 128, 0.9)' : isFist ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255, 255, 255, 0.9)'})`,
                  }}
                >
                  {stage.isCancelStep ? (
                    // Closed Fist to Cancel
                    <svg width="115" height="135" viewBox="0 0 100 120" className="overflow-visible">
                      <path
                        d="M 26 62 C 26 44, 40 40, 52 40 C 64 40, 78 44, 78 62 L 78 86 C 78 104, 66 114, 52 114 C 36 114, 26 104, 26 86 Z"
                        fill={isFist ? 'rgba(74, 222, 128, 0.45)' : 'rgba(255, 255, 255, 0.35)'}
                        stroke={isFist ? '#4ADE80' : '#FFFFFF'}
                        strokeWidth="3.8"
                        strokeLinejoin="round"
                      />
                      <line x1="34" y1="42" x2="34" y2="66" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                      <line x1="48" y1="40" x2="48" y2="64" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                      <line x1="62" y1="42" x2="62" y2="66" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                      <path
                        d="M 24 74 C 24 64, 34 60, 48 62 C 62 64, 72 66, 76 74 C 78 80, 72 86, 62 86 L 38 86 C 28 86, 24 82, 24 74 Z"
                        fill={isFist ? 'rgba(74, 222, 128, 0.45)' : 'rgba(255, 255, 255, 0.35)'}
                        stroke={isFist ? '#4ADE80' : '#FFFFFF'}
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    // Pinch Draw -> Release Hand
                    <svg width="125" height="145" viewBox="0 0 110 135" className="overflow-visible">
                      <path
                        d="M 30 76 C 30 64, 42 60, 50 64 C 54 60, 64 62, 68 66 C 72 64, 80 66, 80 76 L 80 94 C 80 112, 66 124, 48 124 C 30 124, 22 112, 22 94 L 22 80 Z"
                        fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'rgba(255, 255, 255, 0.35)'}
                        stroke={isPinching ? '#4ADE80' : '#FFFFFF'}
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />
                      <path d="M 50 64 C 50 56, 62 56, 62 64 L 62 78 C 62 84, 50 84, 50 78 Z" fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'rgba(255, 255, 255, 0.35)'} stroke={isPinching ? '#4ADE80' : '#FFFFFF'} strokeWidth="2.5" />
                      <path d="M 62 66 C 62 58, 72 58, 72 66 L 72 80 C 72 86, 62 86, 62 80 Z" fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'rgba(255, 255, 255, 0.35)'} stroke={isPinching ? '#4ADE80' : '#FFFFFF'} strokeWidth="2.5" />
                      <path
                        d="M 32 74 C 30 52, 34 30, 46 20 C 54 12, 66 16, 64 28 C 62 40, 56 50, 50 54"
                        fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'rgba(255, 255, 255, 0.35)'}
                        stroke={isPinching ? '#4ADE80' : '#FFFFFF'}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 22 86 C 18 80, 22 68, 34 68 C 42 68, 50 62, 54 52 C 56 46, 50 42, 46 48 C 40 56, 30 64, 26 78 Z"
                        fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'rgba(255, 255, 255, 0.35)'}
                        stroke={isPinching ? '#4ADE80' : '#FFFFFF'}
                        strokeWidth="3.2"
                      />
                      {/* String grab pulse */}
                      <circle cx="50" cy="50" r={isPinching ? 8 : 5} fill={isPinching ? '#4ADE80' : '#FFE600'} stroke="#000000" strokeWidth="1.5" />
                    </svg>
                  )}
                </div>

                {/* ── BOLD INSTRUCTION ACTION BADGE ────────────────────────────── */}
                <div
                  className={`mt-2 px-3.5 py-1.5 font-display font-black text-xs uppercase tracking-wider border-3 border-black shadow-neo transition-all duration-200 text-center whitespace-nowrap ${
                    isPinching
                      ? 'bg-neo-lime text-black scale-110 shadow-neo-lg'
                      : isFist
                      ? 'bg-neo-pink text-white scale-110 shadow-neo-lg'
                      : 'bg-white text-black'
                  }`}
                >
                  {isPinching ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm">✓</span>
                      <span>BOW DRAWN! RELEASE 🖐️ TO SHOOT!</span>
                    </span>
                  ) : isFist ? (
                    <span>✊ CANCELLED!</span>
                  ) : (
                    <div className="flex flex-col items-center leading-tight">
                      <span className="text-xs">
                        {stage.isCancelStep ? '✊ MAKE CLOSED FIST TO CANCEL' : '🤏 PINCH TO DRAW ➔ 🖐️ RELEASE'}
                      </span>
                      <span className="font-mono text-[9px] text-zinc-600 font-bold mt-0.5">
                        {stage.isCancelStep ? 'RESETS BOW AIM' : 'AIM AT THE BULLSEYE!'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top In-Canvas Status Pill */}
            <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-2 z-10 pointer-events-none">
              <div className="bg-black/80 backdrop-blur-xs border border-white/40 text-[10px] font-mono font-bold text-white px-2 py-0.5 uppercase tracking-wider">
                Action: {stage.isCancelStep ? '✊ Fist Cancel' : '🤏 Pinch & Release'}
              </div>
              <div
                className={`border text-[10px] font-mono font-black px-2 py-0.5 uppercase tracking-wider transition-colors ${
                  isPinching || isFist
                    ? 'bg-neo-lime border-black text-black shadow-xs'
                    : 'bg-black/80 border-white/40 text-zinc-300'
                }`}
              >
                {isPinching ? '✅ DRAWING BOW...' : isFist ? '✊ CANCEL' : `LIVE: ${liveGesture || 'READY'}`}
              </div>
            </div>

            {/* Dynamic Feedback Banner */}
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
                ↺ RESETTING TARGET RANGE...
              </div>
            )}
          </div>

          {/* Step Action Buttons & Controls Footer */}
          <div className="w-full max-w-[440px] mt-3 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                audio.playTension();
                resetStage(currentStageIdx);
              }}
              className="flex-1 py-2 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-bold text-xs uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            >
              ↺ Retry Step
            </button>
            <button
              onClick={() => {
                audio.playHit(true);
                advanceToNextStage();
              }}
              className="flex-1 py-2 bg-neo-yellow hover:bg-yellow-300 border-2 border-black font-display font-black text-xs uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            >
              Skip Step ➔
            </button>
          </div>

          {/* Quick Guidance Footer Note */}
          <div className="w-full max-w-[440px] mt-2.5 text-center text-[11px] font-mono text-zinc-600 font-bold">
            💡 Pinch in camera to pull bowstring, release to shoot (or hold Space to draw, release to fire)
          </div>

          {/* Floating Picture-in-Picture Webcam (Corner Widget) */}
          <div className="fixed bottom-4 right-4 z-40 bg-white border-3 border-black shadow-neo-lg p-2 flex flex-col items-center">
            <div className="w-full flex items-center justify-between border-b border-black pb-1 mb-1.5 gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse border border-black" />
                <span className="font-display font-black text-[10px] uppercase tracking-wider">
                  Camera Feed
                </span>
              </div>
              <button
                onClick={() => setIsCamMinimized((prev) => !prev)}
                className="text-[10px] font-mono font-bold px-1 hover:bg-zinc-200 border border-black"
                title={isCamMinimized ? 'Expand Camera' : 'Minimize Camera'}
              >
                {isCamMinimized ? '▲' : '▼'}
              </button>
            </div>

            {!isCamMinimized && (
              <>
                <div className="relative w-36 sm:w-44 aspect-video bg-black border border-black overflow-hidden flex items-center justify-center mb-1.5">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover transform -scale-x-100"
                    playsInline
                    muted
                    autoPlay
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100"
                  />
                </div>

                <div
                  className={`w-full py-0.5 px-1.5 border border-black text-center font-mono font-black text-[9px] uppercase ${
                    isPinching || isFist ? 'bg-neo-lime text-black' : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {isPinching ? '✅ BOWSTRING GRABBED!' : isFist ? '✊ CANCEL AIM' : 'SHOW: 🤏 PINCH'}
                </div>
              </>
            )}
          </div>

        </div>
      ) : (
        /* ── Completion & Mastery Screen ───────────────────────────────────── */
        <div className="w-full max-w-xl bg-white border-4 border-black p-6 sm:p-8 shadow-neo-2xl text-center animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 mx-auto mb-4 bg-neo-lime border-3 border-black shadow-neo flex items-center justify-center text-4xl rounded-2xl rotate-3 hover:rotate-0 transition-transform">
            🏹
          </div>

          <div className="inline-block px-3 py-1 bg-neo-yellow border-2 border-black font-mono font-black text-xs uppercase tracking-wider mb-3">
            🏆 ARCHERY CERTIFIED
          </div>

          <h2 className="font-display font-black text-2xl sm:text-4xl uppercase tracking-tight text-black mb-2">
            Master of the Bow!
          </h2>

          <p className="text-zinc-700 text-sm sm:text-base font-medium max-w-md mx-auto mb-6 leading-relaxed">
            You've mastered pinch draw, release timing, and fist-cancellation. You are now 100% prepared to hit bullseyes in the Archery Challenge!
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            <div className="bg-neo-cream border-2 border-black p-2.5 text-center">
              <span className="text-2xl block mb-1">🤏</span>
              <span className="font-mono font-black text-[10px] uppercase block">Pinch to Draw</span>
            </div>
            <div className="bg-neo-cream border-2 border-black p-2.5 text-center">
              <span className="text-2xl block mb-1">🖐️</span>
              <span className="font-mono font-black text-[10px] uppercase block">Release to Shoot</span>
            </div>
            <div className="bg-neo-cream border-2 border-black p-2.5 text-center">
              <span className="text-2xl block mb-1">✊</span>
              <span className="font-mono font-black text-[10px] uppercase block">Fist to Cancel</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/archery')}
              className="w-full sm:w-auto px-8 py-3.5 bg-neo-lime hover:bg-lime-400 border-3 border-black font-display font-black text-sm uppercase tracking-wider shadow-neo hover:shadow-neo-lg active:translate-x-1 active:translate-y-1 transition-all flex items-center justify-center gap-2"
            >
              <span>Play Archery Now</span>
              <span>➔</span>
            </button>
            <button
              onClick={() => {
                setIsCompleted(false);
                setCurrentStageIdx(0);
                resetStage(0);
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
