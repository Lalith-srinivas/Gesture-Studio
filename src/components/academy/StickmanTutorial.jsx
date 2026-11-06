import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGestureAcademy } from '../../hooks/useGestureAcademy';
import { usePlayer } from '../../hooks/usePlayer';
import { DualHandDetector } from '../../games/stickman/DualHandDetector';
import AnimeCam from '../AnimeCam';

// ── Web Audio Synthesizer for Stickman Tutorial ─────────────────────────────
class StickmanAudio {
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
  playBowDraw() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(150, this.ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch {}
  }
  playShoot() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch {}
  }
  playHit() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch {}
  }
  playSuccess() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.2, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.25);
      });
    } catch {}
  }
}

const audio = new StickmanAudio();

const STAGES = [
  {
    id: 'stage-move',
    title: 'Left Hand: Open Palm & Movement',
    hand: 'Left Hand',
    badge: 'LEFT HAND · MOVEMENT',
    instruction: 'Move hand left/right to walk. Open Palm ✋ to stop.',
    gestures: [
      { name: 'Open Palm ✋', desc: 'Neutral / Stop' },
      { name: 'Move Left 👈', desc: 'Move character left' },
      { name: 'Move Right 👉', desc: 'Move character right' },
    ],
    task: 'Reach the glowing waypoint on the right platform!',
  },
  {
    id: 'stage-jump',
    title: 'Left Hand: Upward Jump',
    hand: 'Left Hand',
    badge: 'LEFT HAND · JUMP',
    instruction: 'Flick your left hand quickly upward ⏫ to leap onto the upper platform.',
    gestures: [
      { name: 'Quick Upward Movement ⏫', desc: 'Jump onto platforms' },
    ],
    task: 'Leap onto the elevated sky platform!',
  },
  {
    id: 'stage-archery',
    title: 'Right Hand: Bow Aim & Shoot',
    hand: 'Right Hand',
    badge: 'RIGHT HAND · ARCHERY',
    instruction: 'Raise/lower right hand to aim. Pinch 🤏 to draw bowstring, release pinch to shoot.',
    gestures: [
      { name: 'Hand Up / Down ↕️', desc: 'Adjust aiming angle' },
      { name: 'Pinch (Thumb + Index) 🤏', desc: 'Draw bowstring' },
      { name: 'Release Pinch ✋', desc: 'Shoot arrow' },
    ],
    task: 'Hit the target dummy with your arrow!',
  },
  {
    id: 'stage-tactics',
    title: 'Left Hand: Special Tactics',
    hand: 'Left Hand',
    badge: 'LEFT HAND · TACTICS',
    instruction: 'Use specialized left-hand battle gestures to activate powers and switch weapons.',
    gestures: [
      { name: 'Victory Sign ✌️', desc: 'Switch arrow type' },
      { name: 'Thumbs Up 👍', desc: 'Activate special ability' },
      { name: 'Closed Fist ✊', desc: 'Melee attack' },
    ],
    task: 'Perform Victory Sign ✌️ or Thumbs Up 👍 to empower your warrior!',
  },
  {
    id: 'stage-mastery',
    title: 'Mastery: 1v1 Practice Duel',
    hand: 'Dual Hands',
    badge: 'DUAL HAND COMBAT',
    instruction: 'Combine Left Hand (Move/Jump) and Right Hand (Aim/Shoot) to defeat the practice opponent.',
    gestures: [
      { name: 'Left Hand ✋', desc: 'Move, Jump & Powers' },
      { name: 'Right Hand 🏹', desc: 'Aim, Draw & Shoot' },
    ],
    task: 'Defeat the practice opponent to claim Academy Certification!',
  },
];

export default function StickmanTutorial() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [stageIdx, setStageIdx] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [leftGesture, setLeftGesture] = useState('Open Palm ✋');
  const [rightGesture, setRightGesture] = useState('Aiming');
  const [feedback, setFeedback] = useState('');

  const { completeGame } = useGestureAcademy('stickman');
  const { recordGameResult } = usePlayer();

  const currentStage = STAGES[stageIdx] || STAGES[0];

  // Game Engine Simulation State
  const simRef = useRef({
    player: { x: 120, y: 340, vx: 0, vy: 0, isGrounded: true, isDrawing: false, drawPower: 0, facingRight: true, aimAngle: -0.2 },
    target: { x: 680, y: 340, hp: 100, maxHp: 100, active: true },
    waypoint: { x: 480, y: 358, reached: false },
    upperPlatform: { x: 380, y: 240, width: 200, height: 20 },
    groundY: 358,
    arrows: [],
    particles: [],
    detector: null,
  });

  // Setup Dual Hand Detector if camera is available
  useEffect(() => {
    let detector = null;
    let cancelled = false;

    async function initDetector() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        detector = new DualHandDetector();
        await detector.initialize();
        simRef.current.detector = detector;
        setCameraActive(true);
      } catch (err) {
        console.warn('Stickman Academy: Camera unavailable, using keyboard/touch simulation fallback', err);
      }
    }

    initDetector();

    return () => {
      cancelled = true;
      if (detector) detector.destroy();
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Main Canvas Render & Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId = null;

    const loop = () => {
      const sim = simRef.current;
      const p = sim.player;
      const target = sim.target;

      // 1. Process Vision AI Dual-Hand Tracking
      if (sim.detector && videoRef.current && videoRef.current.readyState >= 2) {
        const state = sim.detector.processFrame(videoRef.current);
        if (state) {
          if (state.leftGesture) setLeftGesture(state.leftGesture);
          if (state.rightGesture) setRightGesture(state.rightGesture);

          // Apply left hand movements
          p.vx = state.moveX * 4;
          if (state.moveX !== 0) p.facingRight = state.moveX > 0;
          if (state.jump && p.isGrounded) {
            p.vy = -11;
            p.isGrounded = false;
          }

          // Apply right hand aiming & bow draw
          p.aimAngle = state.aimAngle;
          if (state.isDrawing) {
            p.isDrawing = true;
            p.drawPower = Math.min(1.0, p.drawPower + 0.03);
          } else if (state.attackRelease && p.isDrawing) {
            // Shoot arrow
            audio.playShoot();
            sim.arrows.push({
              x: p.x + (p.facingRight ? 24 : -12),
              y: p.y + 24,
              vx: Math.cos(p.aimAngle) * (14 + p.drawPower * 14),
              vy: Math.sin(p.aimAngle) * (14 + p.drawPower * 14),
              active: true,
            });
            p.isDrawing = false;
            p.drawPower = 0;
          }

          // Special gestures check
          if (state.specialAbility || state.victorySign) {
            if (stageIdx === 3) {
              advanceStage('Tactics Verified! Excellent execution.');
            }
          }
        }
      }

      // 2. Physics Update
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.55; // gravity

      // Check ground collision
      if (p.y >= sim.groundY - 50) {
        p.y = sim.groundY - 50;
        p.vy = 0;
        p.isGrounded = true;
      }

      // Check upper platform collision
      const plat = sim.upperPlatform;
      if (
        p.x + 20 >= plat.x &&
        p.x <= plat.x + plat.width &&
        p.y + 50 >= plat.y &&
        p.y + 50 <= plat.y + 16 &&
        p.vy >= 0
      ) {
        p.y = plat.y - 50;
        p.vy = 0;
        p.isGrounded = true;

        if (stageIdx === 1) {
          advanceStage('Platform Reached! Jump mastered.');
        }
      }

      // Check stage 0 waypoint
      if (stageIdx === 0 && Math.abs(p.x - sim.waypoint.x) < 40) {
        advanceStage('Waypoint Reached! Movement mastered.');
      }

      // Arrow Physics & Hit Detection
      for (let i = sim.arrows.length - 1; i >= 0; i--) {
        const a = sim.arrows[i];
        a.x += a.vx;
        a.y += a.vy;
        a.vy += 0.22; // arrow gravity

        // Check Target Dummy Hit
        if (target.active && Math.abs(a.x - target.x) < 30 && Math.abs(a.y - (target.y + 25)) < 40) {
          audio.playHit();
          target.hp -= 35;
          a.active = false;
          sim.arrows.splice(i, 1);

          if (stageIdx === 2) {
            advanceStage('Bullseye! Archery mastered.');
          } else if (stageIdx === 4 && target.hp <= 0) {
            target.active = false;
            audio.playSuccess();
            completeLesson();
          }
        } else if (a.y > 540 || a.x < 0 || a.x > 960) {
          sim.arrows.splice(i, 1);
        }
      }

      // 3. Render Canvas
      ctx.fillStyle = '#040914';
      ctx.fillRect(0, 0, 960, 540);

      // Night sky stars
      ctx.fillStyle = '#FFFFFF';
      for (let s = 0; s < 30; s++) {
        const sx = ((s * 97) % 960);
        const sy = ((s * 53) % 220);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Draw Platforms
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(40, sim.groundY, 880, 24);
      ctx.fillStyle = '#065f46';
      ctx.fillRect(40, sim.groundY, 880, 6);

      // Upper platform
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
      ctx.fillStyle = '#065f46';
      ctx.fillRect(plat.x, plat.y, plat.width, 4);

      // Waypoint Marker (Stage 0)
      if (stageIdx === 0) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.4)';
        ctx.beginPath();
        ctx.arc(sim.waypoint.x, sim.groundY - 30, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('GO HERE', sim.waypoint.x - 26, sim.groundY - 26);
      }

      // Draw Player Stickman (Orange)
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';

      // Head
      ctx.beginPath();
      ctx.arc(p.x + 14, p.y + 12, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#ea580c';
      ctx.fill();
      ctx.stroke();

      // Body
      ctx.beginPath();
      ctx.moveTo(p.x + 14, p.y + 22);
      ctx.lineTo(p.x + 14, p.y + 42);
      // Legs
      ctx.lineTo(p.x + (p.facingRight ? 24 : 4), p.y + 55);
      ctx.moveTo(p.x + 14, p.y + 42);
      ctx.lineTo(p.x + (p.facingRight ? 4 : 24), p.y + 55);
      // Arms
      ctx.moveTo(p.x + 14, p.y + 28);
      ctx.lineTo(p.x + (p.facingRight ? 28 : 0), p.y + 34);
      ctx.stroke();

      // Bow
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x + (p.facingRight ? 26 : 2), p.y + 30, 14, -Math.PI / 2, Math.PI / 2, !p.facingRight);
      ctx.stroke();

      // Draw Target Dummy
      if (target.active) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(target.x + 14, target.y + 12, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#0284c7';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(target.x + 14, target.y + 22);
        ctx.lineTo(target.x + 14, target.y + 42);
        ctx.lineTo(target.x + 24, target.y + 55);
        ctx.moveTo(target.x + 14, target.y + 42);
        ctx.lineTo(target.x + 4, target.y + 55);
        ctx.stroke();

        // Target Health Bar
        ctx.fillStyle = '#374151';
        ctx.fillRect(target.x - 10, target.y - 12, 48, 6);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(target.x - 10, target.y - 12, (target.hp / target.maxHp) * 48, 6);
      }

      // Draw Arrows
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      sim.arrows.forEach((a) => {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x - a.vx * 1.5, a.y - a.vy * 1.5);
        ctx.stroke();
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [stageIdx]);

  const advanceStage = (msg) => {
    setFeedback(msg);
    audio.playSuccess();
    setTimeout(() => {
      setFeedback('');
      setStageIdx((prev) => Math.min(STAGES.length - 1, prev + 1));
    }, 1200);
  };

  const completeLesson = () => {
    setCompleted(true);
    completeGame('stickman');
    recordGameResult('stickman', 1500, true);
  };

  // On-screen control helpers for touch/mouse testing
  const handleSimMove = (dir) => {
    simRef.current.player.vx = dir * 4;
    simRef.current.player.facingRight = dir > 0;
  };
  const handleSimStop = () => {
    simRef.current.player.vx = 0;
  };
  const handleSimJump = () => {
    if (simRef.current.player.isGrounded) {
      simRef.current.player.vy = -11;
      simRef.current.player.isGrounded = false;
    }
  };
  const handleSimShoot = () => {
    const p = simRef.current.player;
    audio.playShoot();
    simRef.current.arrows.push({
      x: p.x + (p.facingRight ? 24 : -12),
      y: p.y + 24,
      vx: Math.cos(p.aimAngle) * 22,
      vy: Math.sin(p.aimAngle) * 22,
      active: true,
    });
    if (stageIdx === 2) advanceStage('Bullseye! Archery mastered.');
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 select-none">
      {/* Hidden webcam video for detection */}
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />

      {/* Header Banner */}
      <div className="w-full bg-[#FFFDF5] border-3 border-black p-4 shadow-neo flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <div className="inline-block px-2.5 py-0.5 bg-neo-yellow border-2 border-black font-mono font-black text-[10px] uppercase shadow-neo-sm mb-1">
            {currentStage.badge}
          </div>
          <h2 className="font-display font-black text-xl sm:text-2xl uppercase tracking-wide text-black">
            {currentStage.title}
          </h2>
          <p className="font-mono text-xs text-zinc-700 mt-0.5">
            {currentStage.instruction}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-neo-lime border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm">
            STAGE {stageIdx + 1} / {STAGES.length}
          </div>
          <button
            onClick={() => navigate('/stickman-showdown')}
            className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 border-2 border-black font-mono font-bold text-xs uppercase shadow-neo-sm cursor-pointer"
          >
            SKIP TUTORIAL ✕
          </button>
        </div>
      </div>

      {/* Main Canvas Arena */}
      <div className="relative w-full max-w-4xl aspect-[16/9] border-3 border-black bg-black rounded shadow-neo overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} width={960} height={540} className="w-full h-full object-contain block" />

        {/* Live Detected Gestures Overlay */}
        <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 pointer-events-none">
          <div className="px-2 py-1 bg-black/85 border border-amber-400 text-amber-300 font-mono font-black text-[10px] uppercase shadow-neo-sm">
            LEFT HAND: {leftGesture}
          </div>
          <div className="px-2 py-1 bg-black/85 border border-cyan-400 text-cyan-300 font-mono font-black text-[10px] uppercase shadow-neo-sm">
            RIGHT HAND: {rightGesture}
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-xs">
            <div className="px-6 py-3 bg-neo-lime text-black border-3 border-black font-display font-black text-2xl uppercase shadow-neo animate-bounce">
              🌟 {feedback}
            </div>
          </div>
        )}

        {/* Completion Modal */}
        {completed && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-[#FFFDF5] max-w-md w-full p-6 text-center border-4 border-black shadow-[8px_8px_0px_#000]">
              <div className="text-4xl mb-2">⚔️🏆</div>
              <h3 className="font-display font-black text-2xl uppercase tracking-wider text-black">
                SHOWDOWN CERTIFIED!
              </h3>
              <p className="font-mono text-xs text-zinc-700 mt-2">
                You have mastered all dual-hand gestures for Stickman Showdown. You are ready to battle online rivals!
              </p>
              <div className="my-4 p-2 bg-neo-yellow border-2 border-black font-mono font-black text-sm">
                REWARD: +500 COINS & ACADEMY BADGE 🎖️
              </div>
              <button
                onClick={() => navigate('/stickman-showdown')}
                className="w-full py-3 bg-neo-lime hover:bg-lime-400 text-black border-3 border-black font-display font-black text-sm uppercase shadow-neo active:translate-y-0.5 cursor-pointer"
              >
                ENTER 1v1 SHOWDOWN ARENA ⚔️
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Gesture Academy Training Guide Box */}
      <div className="w-full max-w-4xl bg-white border-3 border-black p-4 shadow-neo">
        <h4 className="font-mono font-black text-xs uppercase tracking-wider text-zinc-600 mb-2">
          📋 REQUIRED GESTURES FOR THIS LESSON
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {currentStage.gestures.map((g, idx) => (
            <div key={idx} className="p-2.5 bg-zinc-50 border-2 border-black shadow-neo-sm">
              <div className="font-mono font-black text-xs text-black uppercase">{g.name}</div>
              <div className="font-mono text-[11px] text-zinc-600 mt-0.5">{g.desc}</div>
            </div>
          ))}
        </div>

        {/* Touch & Click Testing Bar */}
        <div className="mt-4 pt-3 border-t-2 border-black/10 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-zinc-500 font-bold uppercase">
            TRY WITH TOUCH / CLICK CONTROLS:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onMouseDown={() => handleSimMove(-1)}
              onMouseUp={handleSimStop}
              onTouchStart={() => handleSimMove(-1)}
              onTouchEnd={handleSimStop}
              className="px-3 py-1 bg-black text-white font-mono font-black text-xs border border-black shadow-neo-sm cursor-pointer"
            >
              ◀ LEFT
            </button>
            <button
              onMouseDown={() => handleSimMove(1)}
              onMouseUp={handleSimStop}
              onTouchStart={() => handleSimMove(1)}
              onTouchEnd={handleSimStop}
              className="px-3 py-1 bg-black text-white font-mono font-black text-xs border border-black shadow-neo-sm cursor-pointer"
            >
              RIGHT ▶
            </button>
            <button
              onClick={handleSimJump}
              className="px-3 py-1 bg-amber-400 text-black font-mono font-black text-xs border border-black shadow-neo-sm cursor-pointer"
            >
              ▲ JUMP
            </button>
            <button
              onClick={handleSimShoot}
              className="px-3 py-1 bg-red-600 text-white font-mono font-black text-xs border border-black shadow-neo-sm cursor-pointer"
            >
              🏹 SHOOT
            </button>
            {stageIdx === 3 && (
              <button
                onClick={() => advanceStage('Special Ability Activated!')}
                className="px-3 py-1 bg-purple-600 text-white font-mono font-black text-xs border border-black shadow-neo-sm cursor-pointer"
              >
                👍 SPECIAL
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

