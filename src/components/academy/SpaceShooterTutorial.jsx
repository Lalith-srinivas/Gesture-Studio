import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GESTURES } from '../../utils/gestureDetector';
import { useGestureAcademy } from '../../hooks/useGestureAcademy';
import { usePlayer } from '../../hooks/usePlayer';
import { useHandTracking } from '../../hooks/useHandTracking';
import AnimeCam from '../AnimeCam';

// ── Web Audio Synthesizer for Space Shooter Tutorial ─────────────────────────
class SpaceAudio {
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

  playLaser() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  playHit() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.06);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {}
  }

  playDestroy() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  }

  playEmp() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {}
  }

  playFanfare() {
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [392, 523.25, 659.25, 783.99, 1046.5];
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

const audio = new SpaceAudio();

// ── Dimensions & Constants ──────────────────────────────────────────────────
const CANVAS_W = 440;
const CANVAS_H = 560;

// ── Tutorial Stages ────────────────────────────────────────────────────────
const SPACE_STAGES = [
  {
    stepIndex: 1,
    title: 'Flight Navigation & Laser Steering',
    instruction: 'Point Index Finger ☝️ and glide left & right to steer!',
    explanation: 'Your starship matches your finger coordinates and fires lasers automatically.',
    hint: 'Move index finger ☝️ across the green nav rings to align thrusters.',
    color: 'bg-neo-yellow',
    isWaypointStage: true,
  },
  {
    stepIndex: 2,
    title: 'Target Lock & Elimination',
    instruction: 'Steer underneath the alien invader 🛸 to blast it down!',
    explanation: 'Line up your twin plasma cannons with enemy flight paths.',
    hint: 'Center your ship under the red scout · lasers strike automatically.',
    color: 'bg-neo-cyan',
    isEnemyStage: true,
  },
  {
    stepIndex: 3,
    title: 'EMP Shockwave Blast',
    instruction: 'Surrounded! Pinch 🤏 your fingers to unleash the EMP Blast!',
    explanation: 'Pinching thumb & index finger detonates an electric shockwave clearing all enemies.',
    hint: 'Pinch 🤏 to trigger EMP · Destroys all incoming projectiles & ships.',
    color: 'bg-orange-300',
    isEmpStage: true,
  },
  {
    stepIndex: 4,
    title: 'Boss Dreadnought Evasion',
    instruction: 'Dodge enemy plasma & destroy the Alien Flagship 👾!',
    explanation: 'Demonstrate combat piloting: evade hostile fire and bring down the boss.',
    hint: 'Weave between red bolts & focus fire on the flagship core.',
    color: 'bg-neo-lime',
    isBossStage: true,
  },
];

export default function SpaceShooterTutorial({
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

  const { completeGame } = useGestureAcademy('space-shooter');
  const { recordGameResult } = usePlayer();

  const liveGesture = propLiveGesture || internalLiveGesture;
  const stage = SPACE_STAGES[currentStageIdx] || SPACE_STAGES[0];

  // Gesture state indicators
  const isPinching = liveGesture === GESTURES.PINCH;
  const isSteering = liveGesture === GESTURES.DRAW || liveGesture === 'INDEX_POINT';

  // Simulation state
  const simRef = useRef({
    player: { x: CANVAS_W / 2, y: CANVAS_H - 90, r: 18, targetX: CANVAS_W / 2, targetY: CANVAS_H - 90 },
    stars: [],
    projectiles: [],
    enemyProjectiles: [],
    enemies: [],
    boss: null,
    particles: [],
    waypoints: [],
    empRings: [],
    floatingTexts: [],
    shakeFrames: 0,
    passedStage: false,
    lastFireTime: 0,
    lastPinchTime: 0,
    isMouseDown: false,
  });

  // Reset stage state
  const resetStage = useCallback((stageIndex) => {
    const s = SPACE_STAGES[stageIndex] || SPACE_STAGES[0];
    const sim = simRef.current;
    sim.passedStage = false;
    sim.projectiles = [];
    sim.enemyProjectiles = [];
    sim.enemies = [];
    sim.boss = null;
    sim.particles = [];
    sim.waypoints = [];
    sim.empRings = [];
    sim.floatingTexts = [];
    sim.shakeFrames = 0;
    sim.player.x = CANVAS_W / 2;
    sim.player.y = CANVAS_H - 90;
    sim.player.targetX = CANVAS_W / 2;
    sim.player.targetY = CANVAS_H - 90;

    if (s.isWaypointStage) {
      // 3 Navigation Rings to steer through
      sim.waypoints = [
        { id: 1, x: 120, y: CANVAS_H - 120, r: 32, collected: false },
        { id: 2, x: 320, y: CANVAS_H - 120, r: 32, collected: false },
        { id: 3, x: 220, y: CANVAS_H - 120, r: 32, collected: false },
      ];
    } else if (s.isEnemyStage) {
      // Single alien scout
      sim.enemies = [
        {
          id: 101,
          x: 220,
          y: 90,
          r: 22,
          hp: 4,
          maxHp: 4,
          color: '#FF3B30',
          speedX: 1.5,
          minX: 120,
          maxX: 320,
        },
      ];
    } else if (s.isEmpStage) {
      // 3 alien drones clustered together
      sim.enemies = [
        { id: 201, x: 130, y: 130, r: 18, hp: 2, maxHp: 2, color: '#FF4D4D', speedX: 0 },
        { id: 202, x: 220, y: 110, r: 18, hp: 2, maxHp: 2, color: '#FF3B30', speedX: 0 },
        { id: 203, x: 310, y: 130, r: 18, hp: 2, maxHp: 2, color: '#FF4D4D', speedX: 0 },
      ];
      // Hostile red plasma bolts flying down
      sim.enemyProjectiles = [
        { id: 301, x: 130, y: 180, vy: 2.2, r: 5, color: '#FF3B30' },
        { id: 302, x: 220, y: 160, vy: 2.2, r: 5, color: '#FF3B30' },
        { id: 303, x: 310, y: 180, vy: 2.2, r: 5, color: '#FF3B30' },
      ];
    } else if (s.isBossStage) {
      // Alien Flagship Commander
      sim.boss = {
        x: CANVAS_W / 2,
        y: 110,
        r: 42,
        hp: 14,
        maxHp: 14,
        speedX: 2.0,
        minX: 110,
        maxX: 330,
        lastFire: 0,
      };
    }
  }, []);

  // Advance stage logic
  const advanceToNextStage = useCallback(() => {
    audio.playDestroy();
    const nextIdx = currentStageIdxRef.current + 1;
    if (nextIdx < SPACE_STAGES.length) {
      setFeedback({ type: 'success', text: 'OBJECTIVE CLEARED! NEXT LESSON →' });
      setTimeout(() => {
        setFeedback(null);
        currentStageIdxRef.current = nextIdx;
        setCurrentStageIdx(nextIdx);
        resetStage(nextIdx);
      }, 700);
    } else {
      audio.playFanfare();
      setIsCompleted(true);
      completeGame('space-shooter');
      recordGameResult?.({
        gameId: 'space-shooter',
        score: 100,
        sessionId: `space_tut_${Date.now()}`,
      });
    }
  }, [resetStage, completeGame, recordGameResult]);

  // Trigger EMP blast
  const triggerEmp = useCallback(() => {
    const sim = simRef.current;
    if (sim.passedStage) return;

    audio.playEmp();
    sim.shakeFrames = 22;

    // Expanding shockwave circle
    sim.empRings.push({
      x: sim.player.x,
      y: sim.player.y,
      r: 10,
      maxR: 340,
      alpha: 1,
    });

    // Vaporize enemy projectiles
    sim.enemyProjectiles = [];

    // Vaporize all enemies
    for (const e of sim.enemies) {
      for (let p = 0; p < 16; p++) {
        const ang = Math.random() * Math.PI * 2;
        sim.particles.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(ang) * 5,
          vy: Math.sin(ang) * 5,
          color: '#38BDF8',
          radius: 3.5,
          alpha: 1,
        });
      }
    }
    sim.enemies = [];

    sim.floatingTexts.push({
      text: 'EMP DETONATED! ⚡',
      x: sim.player.x,
      y: sim.player.y - 45,
      color: '#38BDF8',
      alpha: 1.2,
    });

    // Advance if this is Stage 3
    if (SPACE_STAGES[currentStageIdxRef.current]?.isEmpStage) {
      sim.passedStage = true;
      advanceToNextStage();
    }
  }, [advanceToNextStage]);

  const triggerEmpRef = useRef(triggerEmp);
  useEffect(() => {
    triggerEmpRef.current = triggerEmp;
  }, [triggerEmp]);

  // Initialize starfield
  useEffect(() => {
    const sim = simRef.current;
    sim.stars = [];
    for (let i = 0; i < 75; i++) {
      sim.stars.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        speed: 0.8 + Math.random() * 2.2,
        r: 0.8 + Math.random() * 1.8,
        alpha: 0.3 + Math.random() * 0.7,
      });
    }
    resetStage(0);
  }, [resetStage]);

  // Synchronous MediaPipe hand tracking hook
  useHandTracking({
    videoRef,
    overlayCanvasRef,
    onGesture: (gesture, indexTip) => {
      setInternalLiveGesture((prev) => (prev !== gesture ? gesture : prev));
      const sim = simRef.current;

      if (indexTip && canvasRef.current) {
        // Mirrored coordinate mapping
        const targetX = (1 - indexTip.x) * CANVAS_W;
        const targetY = Math.max(160, Math.min(CANVAS_H - 45, indexTip.y * CANVAS_H));
        sim.player.targetX = targetX;
        sim.player.targetY = targetY;
      }

      // Check Pinch for EMP blast
      const now = performance.now();
      if (gesture === GESTURES.PINCH) {
        if (now - sim.lastPinchTime > 900) {
          sim.lastPinchTime = now;
          triggerEmpRef.current?.();
        }
      }
    },
    enabled: true,
    modelComplexity: 0,
    cameraWidth: 640,
    cameraHeight: 480,
  });

  // 60 FPS Canvas Game Loop
  useEffect(() => {
    let animId;

    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const sim = simRef.current;
      const now = performance.now();
      const currentStage = SPACE_STAGES[currentStageIdxRef.current] || SPACE_STAGES[0];

      // Screen Shake
      ctx.save();
      if (sim.shakeFrames > 0) {
        const sx = (Math.random() - 0.5) * 14;
        const sy = (Math.random() - 0.5) * 14;
        ctx.translate(sx, sy);
        sim.shakeFrames--;
      }

      // ── Starfield Space Background ──────────────────────────────────────
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Distant nebulas
      if (!sim.nebGrad) {
        sim.nebGrad = ctx.createRadialGradient(CANVAS_W * 0.7, 180, 20, CANVAS_W * 0.7, 180, 200);
        sim.nebGrad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
        sim.nebGrad.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = sim.nebGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Stars
      for (const s of sim.stars) {
        s.y += s.speed;
        if (s.y > CANVAS_H) {
          s.y = 0;
          s.x = Math.random() * CANVAS_W;
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Update Player Starfighter ───────────────────────────────────────
      // Smooth lerp steering
      sim.player.x += (sim.player.targetX - sim.player.x) * 0.18;
      sim.player.y += (sim.player.targetY - sim.player.y) * 0.18;
      sim.player.x = Math.max(35, Math.min(CANVAS_W - 35, sim.player.x));
      sim.player.y = Math.max(160, Math.min(CANVAS_H - 45, sim.player.y));

      // Auto-fire twin plasma lasers (every 180ms)
      if (now - sim.lastFireTime > 180 && !sim.passedStage) {
        sim.lastFireTime = now;
        sim.projectiles.push(
          { x: sim.player.x - 10, y: sim.player.y - 18, vy: -12, color: '#38BDF8', r: 3.5 },
          { x: sim.player.x + 10, y: sim.player.y - 18, vy: -12, color: '#38BDF8', r: 3.5 }
        );
        audio.playLaser();
      }

      // ── Update Waypoints (Stage 1) ──────────────────────────────────────
      if (currentStage.isWaypointStage) {
        let allCollected = true;
        for (const wp of sim.waypoints) {
          if (!wp.collected) {
            allCollected = false;
            const dist = Math.hypot(sim.player.x - wp.x, sim.player.y - wp.y);
            if (dist < wp.r + sim.player.r) {
              wp.collected = true;
              audio.playHit();
              for (let p = 0; p < 12; p++) {
                const ang = Math.random() * Math.PI * 2;
                sim.particles.push({
                  x: wp.x,
                  y: wp.y,
                  vx: Math.cos(ang) * 3,
                  vy: Math.sin(ang) * 3,
                  color: '#4ADE80',
                  radius: 3,
                  alpha: 1,
                });
              }
            }
          }

          // Draw Waypoint Ring
          ctx.save();
          ctx.strokeStyle = wp.collected ? '#4ADE80' : '#FFE600';
          ctx.lineWidth = wp.collected ? 2 : 3.5;
          ctx.setLineDash(wp.collected ? [] : [8, 6]);
          ctx.lineDashOffset = -Date.now() / 30;
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, wp.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          if (!wp.collected) {
            ctx.fillStyle = '#FFE600';
            ctx.font = '900 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('NAV GATE', wp.x, wp.y - wp.r - 8);
          }
          ctx.restore();
        }

        if (allCollected && !sim.passedStage) {
          sim.passedStage = true;
          advanceToNextStage();
        }
      }

      // ── Update & Draw Enemies ───────────────────────────────────────────
      for (const e of sim.enemies) {
        if (e.speedX !== 0) {
          e.x += e.speedX;
          if (e.x < e.minX || e.x > e.maxX) e.speedX *= -1;
        }

        // Draw Alien Invader Ship
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 12;

        // Hull
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(0, e.r * 1.1);
        ctx.lineTo(e.r * 1.2, -e.r * 0.6);
        ctx.lineTo(e.r * 0.4, -e.r * 0.3);
        ctx.lineTo(0, -e.r * 0.7);
        ctx.lineTo(-e.r * 0.4, -e.r * 0.3);
        ctx.lineTo(-e.r * 1.2, -e.r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cockpit Eye
        ctx.fillStyle = '#FFEAEA';
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Health Bar
        if (e.maxHp > 1) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(-20, -e.r - 10, 40, 5);
          ctx.fillStyle = '#4ADE80';
          ctx.fillRect(-20, -e.r - 10, (e.hp / e.maxHp) * 40, 5);
        }

        ctx.restore();
      }

      // ── Update & Draw Boss Dreadnought (Stage 4) ────────────────────────
      if (sim.boss) {
        const b = sim.boss;
        b.x += b.speedX;
        if (b.x < b.minX || b.x > b.maxX) b.speedX *= -1;

        // Boss firing hostile bullets
        if (now - b.lastFire > 650 && !sim.passedStage) {
          b.lastFire = now;
          sim.enemyProjectiles.push(
            { id: Math.random(), x: b.x - 22, y: b.y + 20, vy: 3.5, r: 5, color: '#FF3B30' },
            { id: Math.random(), x: b.x + 22, y: b.y + 20, vy: 3.5, r: 5, color: '#FF3B30' }
          );
        }

        // Draw Dreadnought Flagship
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.shadowColor = '#FF3B30';
        ctx.shadowBlur = 18;

        // Main Hull
        ctx.fillStyle = '#7F1D1D';
        ctx.beginPath();
        ctx.moveTo(0, b.r * 1.15);
        ctx.lineTo(b.r * 1.25, 0);
        ctx.lineTo(b.r * 0.7, -b.r * 0.6);
        ctx.lineTo(0, -b.r * 0.4);
        ctx.lineTo(-b.r * 0.7, -b.r * 0.6);
        ctx.lineTo(-b.r * 1.25, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Glowing Power Core
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, 0, b.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Boss HP Bar
        ctx.fillStyle = '#000000';
        ctx.fillRect(-45, -b.r - 16, 90, 8);
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-45, -b.r - 16, (b.hp / b.maxHp) * 90, 8);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(-45, -b.r - 16, 90, 8);

        ctx.restore();
      }

      // ── Update & Draw Hostile Enemy Projectiles ──────────────────────────
      for (let i = sim.enemyProjectiles.length - 1; i >= 0; i--) {
        const ep = sim.enemyProjectiles[i];
        ep.y += ep.vy;

        ctx.fillStyle = ep.color;
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, ep.r, 0, Math.PI * 2);
        ctx.fill();

        if (ep.y > CANVAS_H + 20) sim.enemyProjectiles.splice(i, 1);
      }

      // ── Update & Draw Player Projectiles ─────────────────────────────────
      for (let i = sim.projectiles.length - 1; i >= 0; i--) {
        const pr = sim.projectiles[i];
        pr.y += pr.vy;

        ctx.fillStyle = pr.color;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
        ctx.fill();

        let consumed = false;

        // Collision vs Regular Enemies
        for (let j = sim.enemies.length - 1; j >= 0; j--) {
          const e = sim.enemies[j];
          if (Math.hypot(pr.x - e.x, pr.y - e.y) < pr.r + e.r) {
            e.hp--;
            consumed = true;
            audio.playHit();
            for (let p = 0; p < 8; p++) {
              sim.particles.push({
                x: pr.x,
                y: pr.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: '#FFE600',
                radius: 2.5,
                alpha: 1,
              });
            }

            if (e.hp <= 0) {
              sim.enemies.splice(j, 1);
              audio.playDestroy();
              for (let p = 0; p < 20; p++) {
                const ang = Math.random() * Math.PI * 2;
                sim.particles.push({
                  x: e.x,
                  y: e.y,
                  vx: Math.cos(ang) * 4.5,
                  vy: Math.sin(ang) * 4.5,
                  color: e.color,
                  radius: 3.5,
                  alpha: 1,
                });
              }

              if (sim.enemies.length === 0 && !sim.passedStage && currentStage.isEnemyStage) {
                sim.passedStage = true;
                advanceToNextStage();
              }
            }
            break;
          }
        }

        // Collision vs Boss
        if (!consumed && sim.boss && Math.hypot(pr.x - sim.boss.x, pr.y - sim.boss.y) < pr.r + sim.boss.r) {
          consumed = true;
          sim.boss.hp--;
          audio.playHit();

          if (sim.boss.hp <= 0 && !sim.passedStage) {
            sim.passedStage = true;
            sim.shakeFrames = 24;
            audio.playDestroy();
            for (let p = 0; p < 35; p++) {
              const ang = Math.random() * Math.PI * 2;
              sim.particles.push({
                x: sim.boss.x,
                y: sim.boss.y,
                vx: Math.cos(ang) * 6,
                vy: Math.sin(ang) * 6,
                color: '#F59E0B',
                radius: 4,
                alpha: 1,
              });
            }
            sim.boss = null;
            advanceToNextStage();
          }
        }

        if (consumed || pr.y < -20) sim.projectiles.splice(i, 1);
      }

      // ── EMP Shockwave Rings ──────────────────────────────────────────────
      for (let i = sim.empRings.length - 1; i >= 0; i--) {
        const ring = sim.empRings[i];
        ring.r += 14;
        ring.alpha -= 0.035;

        if (ring.alpha <= 0 || ring.r > ring.maxR) {
          sim.empRings.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = `rgba(56, 189, 248, ${ring.alpha})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Particles ────────────────────────────────────────────────────────
      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const p = sim.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;

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
      ctx.globalAlpha = 1.0;

      // ── Draw Player Starship ─────────────────────────────────────────────
      const p = sim.player;
      ctx.save();
      ctx.translate(p.x, p.y);

      // Glowing thruster flame
      const flameLen = 10 + Math.sin(Date.now() / 50) * 5;
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.moveTo(-6, 16);
      ctx.lineTo(0, 16 + flameLen);
      ctx.lineTo(6, 16);
      ctx.closePath();
      ctx.fill();

      // Delta Starfighter Hull
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(16, 16);
      ctx.lineTo(7, 10);
      ctx.lineTo(0, 16);
      ctx.lineTo(-7, 10);
      ctx.lineTo(-16, 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Cockpit Energy Core
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(0, -2, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

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

  // Mouse / Touch handlers for effortless local testing
  const handlePointerMove = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_H;
    const sim = simRef.current;
    sim.player.targetX = x;
    sim.player.targetY = Math.max(160, Math.min(CANVAS_H - 45, y));
  };

  const handleMouseDown = (e) => {
    simRef.current.isMouseDown = true;
    handlePointerMove(e.clientX, e.clientY);
  };

  const handleMouseMove = (e) => {
    if (!simRef.current.isMouseDown) return;
    handlePointerMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    simRef.current.isMouseDown = false;
  };

  const handleTouchStart = (e) => {
    if (!e.touches?.[0]) return;
    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!e.touches?.[0]) return;
    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  return (
    <div className="w-full flex flex-col items-center select-none">
      <style>{`
        @keyframes pulseGuideGlow {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes spaceSteerSway1 {
          0%, 100% { transform: translate(-50%, -50%) translateX(-80px); }
          50% { transform: translate(-50%, -50%) translateX(80px); }
        }
        @keyframes spaceSteerSway2 {
          0%, 100% { transform: translate(-50%, -50%) translateX(-55px); }
          50% { transform: translate(-50%, -50%) translateX(55px); }
        }
        @keyframes spacePinchPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(0.92); }
        }
        @keyframes spaceBossEvade {
          0%, 100% { transform: translate(-50%, -50%) translate(-85px, 0); }
          33% { transform: translate(-50%, -50%) translate(0, -18px); }
          66% { transform: translate(-50%, -50%) translate(85px, 0); }
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
          {SPACE_STAGES.map((s, idx) => (
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
                {stage.isEmpStage ? '⚡' : '🚀'}
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
              onTouchEnd={handleMouseUp}
              onTouchCancel={handleMouseUp}
              className="w-full h-full block select-none touch-none"
            />

            {/* ── Semi-Transparent Animated Hand Guidance Overlay ── */}
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
              <div
                className="absolute flex flex-col items-center select-none"
                style={{
                  left: '50%',
                  top: '80%',
                  animation: stage.isWaypointStage
                    ? 'spaceSteerSway1 2.4s ease-in-out infinite'
                    : stage.isEnemyStage
                    ? 'spaceSteerSway2 2s ease-in-out infinite'
                    : stage.isEmpStage
                    ? 'spacePinchPulse 1.2s ease-in-out infinite'
                    : 'spaceBossEvade 2.8s ease-in-out infinite',
                }}
              >
                {/* Hand Vector: Semi-transparent white with glowing border */}
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    filter: `drop-shadow(0 0 14px ${
                      isPinching
                        ? 'rgba(74, 222, 128, 0.95)'
                        : isSteering
                        ? 'rgba(56, 189, 248, 0.95)'
                        : 'rgba(255, 255, 255, 0.9)'
                    })`,
                  }}
                >
                  {stage.isEmpStage ? (
                    // Pinch Gesture Hand for EMP Blast
                    <svg width="115" height="135" viewBox="0 0 110 135" className="overflow-visible">
                      <path
                        d="M 30 76 C 30 64, 42 60, 50 64 C 54 60, 64 62, 68 66 C 72 64, 80 66, 80 76 L 80 94 C 80 112, 66 124, 48 124 C 30 124, 22 112, 22 94 L 22 80 Z"
                        fill={isPinching ? 'rgba(74, 222, 128, 0.45)' : 'rgba(255, 255, 255, 0.35)'}
                        stroke={isPinching ? '#4ADE80' : '#FFFFFF'}
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />
                      <path d="M 50 64 C 50 56, 62 56, 62 64 L 62 78 C 62 84, 50 84, 50 78 Z" fill="rgba(255, 255, 255, 0.35)" stroke="#FFFFFF" strokeWidth="2.5" />
                      <path d="M 62 66 C 62 58, 72 58, 72 66 L 72 80 C 72 86, 62 86, 62 80 Z" fill="rgba(255, 255, 255, 0.35)" stroke="#FFFFFF" strokeWidth="2.5" />
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
                      {/* Pinch electric burst pulse */}
                      <circle cx="50" cy="50" r={isPinching ? 9 : 5} fill={isPinching ? '#4ADE80' : '#38BDF8'} stroke="#FFFFFF" strokeWidth="1.5" />
                    </svg>
                  ) : (
                    // Extended Index Finger Steer Hand
                    <svg width="115" height="145" viewBox="0 0 100 130" className="overflow-visible">
                      <path
                        d="M 36 68 C 36 56, 46 54, 52 56 C 56 54, 66 54, 70 58 C 74 56, 84 58, 84 68 L 84 94 C 84 112, 70 124, 50 124 C 32 124, 24 112, 24 94 L 24 76 C 24 66, 30 64, 36 68 Z"
                        fill="rgba(255, 255, 255, 0.38)"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M 34 70 L 34 18 C 34 8, 50 8, 50 18 L 50 62"
                        fill="rgba(255, 255, 255, 0.38)"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M 37 18 C 37 12, 47 12, 47 18" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                      <line x1="36" y1="36" x2="48" y2="36" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
                      <line x1="36" y1="52" x2="48" y2="52" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
                      <path d="M 50 62 C 50 54, 66 54, 66 62 L 66 78 C 66 84, 50 84, 50 78 Z" fill="rgba(255, 255, 255, 0.35)" stroke="#FFFFFF" strokeWidth="2.5" />
                      <path d="M 66 64 C 66 56, 78 56, 78 64 L 78 80 C 78 86, 66 86, 66 80 Z" fill="rgba(255, 255, 255, 0.35)" stroke="#FFFFFF" strokeWidth="2.5" />
                      <path d="M 78 68 C 78 60, 86 60, 86 68 L 86 84 C 86 90, 78 90, 78 84 Z" fill="rgba(255, 255, 255, 0.35)" stroke="#FFFFFF" strokeWidth="2.5" />
                      <path
                        d="M 24 82 C 18 78, 20 68, 30 70 C 38 72, 48 76, 54 82 C 58 86, 52 90, 46 88 C 36 84, 28 86, 24 82 Z"
                        fill="rgba(255, 255, 255, 0.35)"
                        stroke="#FFFFFF"
                        strokeWidth="3"
                        strokeLinejoin="round"
                      />
                      {/* Nav beacon ring on tip */}
                      <circle cx="42" cy="12" r="5" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1.5" />
                    </svg>
                  )}
                </div>

                {/* ── Action Instruction Pill ── */}
                <div
                  className={`mt-2 px-3.5 py-1.5 font-display font-black text-xs uppercase tracking-wider border-3 border-black shadow-neo transition-all duration-200 text-center whitespace-nowrap ${
                    isPinching
                      ? 'bg-neo-lime text-black scale-105'
                      : 'bg-white text-black'
                  }`}
                >
                  {isPinching
                    ? '⚡ EMP BLAST TRIGGERED!'
                    : stage.isEmpStage
                    ? '🤏 PINCH THUMB & INDEX FOR EMP'
                    : '☝️ POINT & GLIDE TO STEER'}
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
            <span>[☝️] STEER STARSHIP | [🤏] PINCH FOR EMP BLAST</span>
            <button
              onClick={() => {
                simRef.current.passedStage = false;
                resetStage(currentStageIdxRef.current);
              }}
              className="text-black underline font-black hover:text-zinc-800"
            >
              Reset Sector ↺
            </button>
          </div>
        </div>
      ) : (
        /* ── Completion & Mastery Screen ─────────────────────────────────── */
        <div className="w-full max-w-xl bg-white border-4 border-black p-8 shadow-neo-xl text-center">
          <div className="inline-block p-4 bg-neo-yellow border-3 border-black shadow-neo mb-4 text-5xl">
            🚀
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-black mb-2">
            SPACE ACE CERTIFIED!
          </h2>
          <p className="text-zinc-700 font-mono text-sm max-w-md mx-auto mb-6">
            Outstanding piloting! You have mastered starship navigation, laser target alignment, EMP shockwaves, and dreadnought boss evasion.
          </p>

          <div className="bg-neo-lime border-3 border-black p-4 mb-6 inline-block font-mono font-black text-base shadow-neo">
            🏆 +50 XP EARNED & STARFIGHTER BADGE UNLOCKED!
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/space-shooter')}
              className="w-full sm:w-auto px-6 py-3 bg-neo-yellow hover:bg-yellow-300 border-3 border-black font-display font-black text-sm uppercase shadow-neo active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            >
              Play Space Shooter →
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

