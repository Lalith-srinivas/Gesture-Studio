import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GESTURES } from '../../utils/gestureDetector';
import { useGestureAcademy } from '../../hooks/useGestureAcademy';
import { usePlayer } from '../../hooks/usePlayer';
import { useHandTracking } from '../../hooks/useHandTracking';

// ── Web Audio Synthesizer for Bird Hunter Tutorial ──────────────────────────
class BirdHunterAudio {
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
  playStretch() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(260, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch {}
  }
  playLaunch() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.16);
    } catch {}
  }
  playHit(isGolden = false) {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isGolden ? 'sine' : 'square';
      osc.frequency.setValueAtTime(isGolden ? 880 : 380, this.ctx.currentTime);
      if (isGolden) {
        osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.22);
      }
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (isGolden ? 0.3 : 0.18));
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + (isGolden ? 0.3 : 0.18));
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

const audio = new BirdHunterAudio();

const CANVAS_W = 440;
const CANVAS_H = 560;
const SLING_X = 90;
const SLING_Y = 390;

// ── Bird Hunter Tutorial Stages ───────────────────────────────────────────
const BIRD_STAGES = [
  {
    stepIndex: 1,
    title: 'Slingshot Aim & Launch (First Shot)',
    instruction: 'Pinch 🤏 to pull slingshot, then Release 🖐️ to fire!',
    explanation: 'Pinch to stretch the elastic band, then release to launch the stone at the perched wooden bird.',
    hint: 'Pinch 🤏 -> pull backward -> Open 🖐️ to fire!',
    birdType: 'PRACTICE',
    birdY: 260,
    speed: 0,
    color: 'bg-neo-yellow',
  },
  {
    stepIndex: 2,
    title: 'Moving Target (Leading the Shot)',
    instruction: 'The bird is flying! Lead your shot ahead of it 🖐️!',
    explanation: 'Birds fly across the sky. Aim slightly ahead and release when the time is right.',
    hint: 'Wait for the bird to cross your trajectory before releasing.',
    birdType: 'NORMAL',
    birdY: 220,
    speed: 1.6,
    color: 'bg-neo-cyan',
  },
  {
    stepIndex: 3,
    title: 'Golden Bird (Speed & Precision)',
    instruction: 'Golden Bird incoming! Swift pull 🤏 & release 🖐️!',
    explanation: 'Golden Birds are rare, faster, and award huge score multiplier bonuses!',
    hint: 'Pull quickly and release to strike the rapid golden bird.',
    birdType: 'GOLDEN',
    birdY: 180,
    speed: 2.5,
    color: 'bg-amber-300',
  },
  {
    stepIndex: 4,
    title: 'Cancel Shot (Tactical Disarm)',
    instruction: 'Pinch 🤏 to pull, then make a Closed Fist ✊ to Cancel!',
    explanation: 'If a bad shot is lined up, close your fist to safely relax the slingshot without firing.',
    hint: 'Pull slingshot, then show a closed fist to cancel.',
    birdType: 'PRACTICE',
    birdY: 260,
    speed: 0,
    isCancelStep: true,
    color: 'bg-neo-lime',
  },
];

export default function BirdHunterTutorial({
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
  const { completeGame } = useGestureAcademy('bird-hunter');
  const { recordGameResult } = usePlayer();

  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isCamMinimized, setIsCamMinimized] = useState(false);

  const stage = BIRD_STAGES[currentStageIdx] || BIRD_STAGES[0];
  const isPinching = liveGesture === GESTURES.PINCH;
  const isFist = liveGesture === GESTURES.PAN;

  // Simulation state refs
  const simRef = useRef({
    slingshot: {
      tension: 0,
      isPulling: false,
      pullX: SLING_X,
      pullY: SLING_Y,
    },
    projectiles: [],
    bird: {
      x: 320,
      y: 260,
      baseY: 260,
      speed: 0,
      radius: 26,
      dir: 1,
      wingCycle: 0,
      hit: false,
    },
    lastPinch: false,
    particles: [],
    passedStage: false,
  });

  // Launch stone projectile
  const fireProjectile = useCallback(() => {
    const sim = simRef.current;
    if (!sim.slingshot.isPulling || sim.slingshot.tension < 0.15) return;

    audio.playLaunch();
    const power = sim.slingshot.tension * 16 + 6;
    sim.projectiles.push({
      x: SLING_X,
      y: SLING_Y - 20,
      vx: power * 0.9,
      vy: -power * 0.45,
      gravity: 0.22,
      radius: 8,
      stuck: false,
    });
    sim.slingshot.isPulling = false;
    sim.slingshot.tension = 0;
  }, []);

  // Reset stage
  const resetStage = useCallback((stageIndex) => {
    const s = BIRD_STAGES[stageIndex];
    if (!s) return;

    const sim = simRef.current;
    sim.slingshot = { tension: 0, isPulling: false, pullX: SLING_X, pullY: SLING_Y };
    sim.projectiles = [];
    sim.bird = {
      x: s.speed > 0 ? 120 : 330,
      y: s.birdY,
      baseY: s.birdY,
      speed: s.speed,
      radius: s.birdType === 'GOLDEN' ? 22 : 26,
      dir: 1,
      wingCycle: 0,
      hit: false,
    };
    sim.particles = [];
    sim.passedStage = false;
    setIsResetting(true);
    setTimeout(() => setIsResetting(false), 300);
  }, []);

  // Complete tutorial
  const handleCompleteTutorial = useCallback(() => {
    setIsCompleted(true);
    completeGame('bird-hunter');
    recordGameResult?.({
      gameId: 'bird-hunter',
      score: 100,
      sessionId: `bird_tut_${Date.now()}`,
    });
    audio.playFanfare();
  }, [completeGame, recordGameResult]);

  // Stage advance
  const advanceToNextStage = useCallback(() => {
    const nextIdx = currentStageIdx + 1;
    if (nextIdx < BIRD_STAGES.length) {
      setCurrentStageIdx(nextIdx);
      resetStage(nextIdx);
      setFeedback({ type: 'success', text: '🎯 DIRECT HIT! NEXT STAGE!' });
      setTimeout(() => setFeedback(null), 1800);
    } else {
      handleCompleteTutorial();
    }
  }, [currentStageIdx, resetStage, handleCompleteTutorial]);

  // Gesture handling
  useEffect(() => {
    const sim = simRef.current;
    const s = BIRD_STAGES[currentStageIdx];

    // 1. PINCH to pull slingshot
    if (isPinching && !isResetting && !isCompleted) {
      if (!sim.slingshot.isPulling) {
        sim.slingshot.isPulling = true;
        audio.playStretch();
      }
      sim.slingshot.tension = Math.min(1, sim.slingshot.tension + 0.045);
    }
    // 2. RELEASE PINCH -> Fire Stone
    else if (sim.lastPinch && !isPinching && sim.slingshot.isPulling) {
      if (s.isCancelStep) {
        setFeedback({ type: 'bump', text: 'Close fist ✊ to cancel instead of releasing!' });
        setTimeout(() => setFeedback(null), 1800);
        sim.slingshot.isPulling = false;
        sim.slingshot.tension = 0;
      } else {
        fireProjectile();
      }
    }
    // 3. FIST to Cancel
    else if (isFist && sim.slingshot.isPulling) {
      sim.slingshot.isPulling = false;
      sim.slingshot.tension = 0;
      audio.playStretch();
      if (s.isCancelStep && !sim.passedStage) {
        sim.passedStage = true;
        audio.playHit(false);
        setFeedback({ type: 'success', text: '✓ SLINGSHOT SAFELY DISARMED WITH FIST!' });
        setTimeout(advanceToNextStage, 1200);
      }
    }

    sim.lastPinch = isPinching;
  }, [isPinching, isFist, isResetting, isCompleted, currentStageIdx, fireProjectile, advanceToNextStage]);

  // Initial stage setup
  useEffect(() => {
    resetStage(0);
  }, [resetStage]);

  // Keyboard controls fallback (Space to pull, release Space to shoot, 'C' to cancel)
  useEffect(() => {
    const sim = simRef.current;
    const onDown = (e) => {
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        sim.slingshot.isPulling = true;
        sim.slingshot.tension = Math.min(1, sim.slingshot.tension + 0.1);
        audio.playStretch();
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'f' || e.key === 'F') {
        sim.slingshot.isPulling = false;
        sim.slingshot.tension = 0;
        const s = BIRD_STAGES[currentStageIdx];
        if (s.isCancelStep) advanceToNextStage();
      }
    };
    const onUp = (e) => {
      if (e.key === ' ' || e.key === 'ArrowRight') {
        const s = BIRD_STAGES[currentStageIdx];
        if (!s.isCancelStep) fireProjectile();
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [currentStageIdx, fireProjectile, advanceToNextStage]);

  // ── 60 FPS Game Loop ──────────────────────────────────────────────────────
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const loop = () => {
      const sim = simRef.current;
      const s = BIRD_STAGES[currentStageIdx];

      // Update Bird movement
      if (sim.bird.speed > 0 && !sim.bird.hit) {
        sim.bird.x += sim.bird.speed * sim.bird.dir;
        sim.bird.y = sim.bird.baseY + Math.sin(Date.now() / 250) * 12;
        sim.bird.wingCycle += 0.2;

        if (sim.bird.x > CANVAS_W - 30) {
          sim.bird.dir = -1;
        } else if (sim.bird.x < 150) {
          sim.bird.dir = 1;
        }
      }

      // Update Projectiles (Stone physics)
      for (let i = sim.projectiles.length - 1; i >= 0; i--) {
        const p = sim.projectiles[i];
        if (!p.stuck) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;

          // Check hit on Bird
          const dist = Math.hypot(p.x - sim.bird.x, p.y - sim.bird.y);
          if (dist < sim.bird.radius + p.radius && !sim.bird.hit) {
            p.stuck = true;
            sim.bird.hit = true;
            const isGolden = s.birdType === 'GOLDEN';
            audio.playHit(isGolden);

            // Feather burst particles
            const featherColors = isGolden
              ? ['#FFE600', '#F59E0B', '#FFFBEB']
              : s.birdType === 'NORMAL'
              ? ['#38BDF8', '#0284C7', '#FFFFFF']
              : ['#92400E', '#B45309', '#FCD34D'];

            for (let k = 0; k < 14; k++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = Math.random() * 4 + 2;
              sim.particles.push({
                x: p.x,
                y: p.y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                alpha: 1,
                color: featherColors[k % featherColors.length],
                size: Math.random() * 5 + 3,
              });
            }

            if (!sim.passedStage && !s.isCancelStep) {
              sim.passedStage = true;
              setTimeout(advanceToNextStage, 750);
            }
          }

          // Off screen / ground miss
          if (p.x > CANVAS_W + 40 || p.y > CANVAS_H - 60) {
            sim.projectiles.splice(i, 1);
            if (!sim.bird.hit) {
              setFeedback({ type: 'bump', text: '💥 MISSED BIRD! PULL & AIM AGAIN!' });
              setTimeout(() => setFeedback(null), 1800);
            }
          }
        }
      }

      // Update particles
      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const pt = sim.particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.1;
        pt.alpha -= 0.035;
        if (pt.alpha <= 0) sim.particles.splice(i, 1);
      }

      // ── RENDER SCENE ───────────────────────────────────────────────────────
      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      skyGrad.addColorStop(0, '#0284c7');
      skyGrad.addColorStop(0.6, '#38bdf8');
      skyGrad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Distant rolling hills
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(100, CANVAS_H - 40, 160, Math.PI, 0, false);
      ctx.fill();
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(320, CANVAS_H - 50, 180, Math.PI, 0, false);
      ctx.fill();

      // Grass ground
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, CANVAS_H - 70, CANVAS_W, 70);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(0, CANVAS_H - 70, CANVAS_W, 6);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H - 70);
      ctx.lineTo(CANVAS_W, CANVAS_H - 70);
      ctx.stroke();

      // Fluffy background clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(80, 80, 26, 0, Math.PI * 2);
      ctx.arc(110, 75, 34, 0, Math.PI * 2);
      ctx.arc(140, 80, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(320, 110, 22, 0, Math.PI * 2);
      ctx.arc(345, 105, 30, 0, Math.PI * 2);
      ctx.arc(370, 110, 20, 0, Math.PI * 2);
      ctx.fill();

      // ── Render Target Bird ────────────────────────────────────────────────
      const bd = sim.bird;
      ctx.save();
      ctx.translate(bd.x, bd.y);
      if (bd.dir === -1) ctx.scale(-1, 1);

      // Perch stand if stationary
      if (s.speed === 0) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-5, bd.radius - 2, 10, CANVAS_H - 70 - bd.y);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-5, bd.radius - 2, 10, CANVAS_H - 70 - bd.y);
      }

      // Bird body
      const isGolden = s.birdType === 'GOLDEN';
      const isNormal = s.birdType === 'NORMAL';
      const bodyColor = isGolden ? '#FFE600' : isNormal ? '#38BDF8' : '#D97706';

      // Tail feathers
      ctx.fillStyle = isGolden ? '#F59E0B' : isNormal ? '#0284C7' : '#92400E';
      ctx.beginPath();
      ctx.moveTo(-bd.radius, 0);
      ctx.lineTo(-bd.radius - 12, -8);
      ctx.lineTo(-bd.radius - 12, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Body circle
      ctx.beginPath();
      ctx.arc(0, 0, bd.radius, 0, Math.PI * 2);
      ctx.fillStyle = bodyColor;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Wing (animated flap)
      const wingYOffset = Math.sin(bd.wingCycle) * 10;
      ctx.beginPath();
      ctx.ellipse(-4, wingYOffset, bd.radius * 0.55, bd.radius * 0.35, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = isGolden ? '#FCD34D' : isNormal ? '#7DD3FC' : '#B45309';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eye
      ctx.beginPath();
      ctx.arc(bd.radius * 0.45, -bd.radius * 0.3, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bd.radius * 0.55, -bd.radius * 0.3, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();

      // Beak
      ctx.beginPath();
      ctx.moveTo(bd.radius * 0.8, -bd.radius * 0.3);
      ctx.lineTo(bd.radius + 10, -bd.radius * 0.15);
      ctx.lineTo(bd.radius * 0.8, 0);
      ctx.closePath();
      ctx.fillStyle = '#F97316';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.restore();

      // ── Render Slingshot & Rubber Bands ───────────────────────────────────
      const pullBack = sim.slingshot.tension * 32;
      const pouchX = SLING_X - pullBack;
      const pouchY = SLING_Y - 20 + pullBack * 0.2;

      ctx.save();
      // Wooden Slingshot Fork
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(SLING_X, CANVAS_H - 70);
      ctx.lineTo(SLING_X, SLING_Y + 10);
      ctx.lineTo(SLING_X - 16, SLING_Y - 28); // left prong
      ctx.moveTo(SLING_X, SLING_Y + 10);
      ctx.lineTo(SLING_X + 16, SLING_Y - 28); // right prong
      ctx.stroke();

      // Prong wood accents
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Left Rubber Band
      ctx.beginPath();
      ctx.moveTo(SLING_X - 16, SLING_Y - 28);
      ctx.lineTo(pouchX, pouchY);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Right Rubber Band
      ctx.beginPath();
      ctx.moveTo(SLING_X + 16, SLING_Y - 28);
      ctx.lineTo(pouchX, pouchY);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Leather Pouch
      ctx.fillStyle = '#3f3f46';
      ctx.beginPath();
      ctx.arc(pouchX, pouchY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Loaded Stone (if pulling)
      if (sim.slingshot.isPulling) {
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath();
        ctx.arc(pouchX + 2, pouchY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Parabolic trajectory preview dots
        ctx.fillStyle = 'rgba(255, 230, 0, 0.7)';
        const pwr = sim.slingshot.tension * 16 + 6;
        let px = pouchX;
        let py = pouchY;
        let pvx = pwr * 0.9;
        let pvy = -pwr * 0.45;
        for (let step = 0; step < 16; step++) {
          px += pvx * 1.6;
          py += pvy * 1.6;
          pvy += 0.22 * 1.6;
          ctx.beginPath();
          ctx.arc(px, py, Math.max(1.8, 4 - step * 0.18), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // ── Render Projectiles ────────────────────────────────────────────────
      for (const p of sim.projectiles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // ── Render Particles ──────────────────────────────────────────────────
      for (const pt of sim.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
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
          {BIRD_STAGES.map((s, idx) => (
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
                {stage.isCancelStep ? '✊' : '🦅'}
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
          <div className="relative w-full max-w-[440px] aspect-[3/4] bg-sky-200 border-4 border-black shadow-neo-xl overflow-hidden rounded-none">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full h-full block select-none"
            />

            {/* ── Subway Surfers Trajectory Flight Arrow & Animated Hand Overlay ── */}
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
              <style>{`
                @keyframes birdAimFlow {
                  0% { stroke-dashoffset: 40; opacity: 0.5; }
                  50% { opacity: 1; }
                  100% { stroke-dashoffset: 0; opacity: 0.5; }
                }
              `}</style>

              {/* Subway Surfers Style Flight Arrow to Target */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none select-none" viewBox="0 0 440 560">
                <defs>
                  <filter id="birdGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#FFE600" floodOpacity="0.8" />
                  </filter>
                  <linearGradient id="birdGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.25" />
                    <stop offset="60%" stopColor="#FFE600" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#FFE600" stopOpacity="0.95" />
                  </linearGradient>
                </defs>

                {!stage.isCancelStep && (
                  <g filter="url(#birdGlow)">
                    {/* Parabolic arc guide line */}
                    <path
                      d={`M 90 370 Q 190 140, ${stage.speed > 0 ? 300 : 330} ${stage.birdY}`}
                      fill="none"
                      stroke="url(#birdGrad)"
                      strokeWidth="14"
                      strokeLinecap="round"
                    />
                    <polygon
                      points={`${stage.speed > 0 ? 320 : 345},${stage.birdY - 6} ${stage.speed > 0 ? 295 : 320},${stage.birdY - 22} ${stage.speed > 0 ? 300 : 325},${stage.birdY + 12}`}
                      fill="#FFE600"
                      stroke="#000000"
                      strokeWidth="2.5"
                    />
                    <path
                      d={`M 90 370 Q 190 140, ${stage.speed > 0 ? 300 : 330} ${stage.birdY}`}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="3.5"
                      strokeDasharray="8 6"
                      style={{ animation: 'birdAimFlow 0.7s linear infinite' }}
                    />
                  </g>
                )}
              </svg>

              {/* Animated White Semi-Transparent Hand Overlay */}
              <div
                className="absolute transition-all duration-300 flex flex-col items-center select-none"
                style={{
                  left: '46%',
                  top: '64%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Hand Vector: Demonstrating Slingshot Pinch Pull -> Open Release */}
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
                    // Slingshot Pinch Pull -> Release Hand
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
                      {/* Pouch tension indicator */}
                      <circle cx="50" cy="50" r={isPinching ? 8 : 5} fill={isPinching ? '#4ADE80' : '#FFE600'} stroke="#000000" strokeWidth="1.5" />
                    </svg>
                  )}
                </div>

                {/* ── BOLD INSTRUCTION ACTION BADGE ────────────────────────────── */}
                <div
                  className={`mt-2 px-3.5 py-1.5 font-display font-black text-xs uppercase tracking-wider border-3 border-black shadow-neo transition-all duration-200 text-center whitespace-nowrap ${
                    isPinching
                      ? 'bg-neo-lime text-black scale-105'
                      : isFist
                      ? 'bg-red-400 text-black scale-105'
                      : 'bg-white text-black'
                  }`}
                >
                  {isPinching
                    ? '🤏 PULLING TENSION! RELEASE 🖐️ TO LAUNCH'
                    : isFist
                    ? '✊ FIST DETECTED: CANCELLED'
                    : stage.isCancelStep
                    ? '✊ MAKE CLOSED FIST TO CANCEL'
                    : '🤏 PINCH POUCH & RELEASE 🖐️'}
                </div>
              </div>

              {/* Feedback Overlay Toast */}
              {feedback && (
                <div className="absolute top-6 inset-x-4 flex justify-center z-30 animate-bounce">
                  <div
                    className={`px-4 py-2 border-3 border-black shadow-neo font-mono font-black text-xs uppercase tracking-wider ${
                      feedback.type === 'success'
                        ? 'bg-neo-lime text-black'
                        : 'bg-red-400 text-white'
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
            <span>KEYBOARD: [SPACE] PULL/FIRE | [C] CANCEL</span>
            <button
              onClick={() => resetStage(currentStageIdx)}
              className="text-black underline font-black hover:text-zinc-800"
            >
              Reset Target ↺
            </button>
          </div>
        </div>
      ) : (
        /* ── Completion & Mastery Screen ─────────────────────────────────── */
        <div className="w-full max-w-xl bg-white border-4 border-black p-8 shadow-neo-xl text-center">
          <div className="inline-block p-4 bg-neo-yellow border-3 border-black shadow-neo mb-4 text-5xl">
            🦅
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-black mb-2">
            SLINGSHOT MASTER!
          </h2>
          <p className="text-zinc-700 font-mono text-sm max-w-md mx-auto mb-6">
            Outstanding hunting! You've mastered pulling the slingshot, leading moving targets, hunting golden birds, and cancelling shots with a closed fist.
          </p>

          <div className="bg-neo-lime border-3 border-black p-4 mb-6 inline-block font-mono font-black text-base shadow-neo">
            🏆 +50 XP EARNED & BIRD HUNTER BADGE UNLOCKED!
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/bird-hunter')}
              className="w-full sm:w-auto px-6 py-3 bg-neo-yellow hover:bg-yellow-300 border-3 border-black font-display font-black text-sm uppercase shadow-neo active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            >
              Play Bird Hunter Game →
            </button>
            <button
              onClick={() => {
                setIsCompleted(false);
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

      {/* ── Corner Floating PiP Webcam Feed ───────────────────────────────── */}
      <div
        className={`fixed bottom-4 right-4 z-40 bg-white border-3 border-black shadow-neo-lg transition-all duration-300 ${
          isCamMinimized ? 'w-16 h-16' : 'w-48 sm:w-56'
        }`}
      >
        <div className="bg-black text-white px-2 py-1 flex items-center justify-between text-[10px] font-mono font-bold">
          <span className="truncate">
            {isCamMinimized ? 'CAM' : `HAND: ${liveGesture || 'NONE'}`}
          </span>
          <button
            onClick={() => setIsCamMinimized(!isCamMinimized)}
            className="text-zinc-300 hover:text-white px-1"
          >
            {isCamMinimized ? '▢' : '—'}
          </button>
        </div>

        {!isCamMinimized && (
          <div className="relative aspect-[4/3] bg-zinc-900 overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover scale-x-[-1]"
              playsInline
              muted
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
            />
          </div>
        )}
      </div>
    </div>
  );
}
