import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GESTURES } from '../../utils/gestureDetector';
import { useGestureAcademy } from '../../hooks/useGestureAcademy';
import { usePlayer } from '../../hooks/usePlayer';
import { useHandTracking } from '../../hooks/useHandTracking';

// ── Web Audio Sound Synthesizer for Mini-Tutorial ───────────────────────────
class MiniAudio {
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
  playSteer() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(540, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
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
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.16, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.2);
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
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.22);
    } catch {}
  }
  playNitro() {
    this.init();
    if (!this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * 0.4;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(1800, this.ctx.currentTime + 0.35);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
      noise.stop(this.ctx.currentTime + 0.4);
    } catch {}
  }
}

const audio = new MiniAudio();

// ── Tutorial Stage Definitions ─────────────────────────────────────────────
const STAGES = [
  {
    stepIndex: 1,
    title: 'Lane 1 (Left Lane)',
    gestureName: 'Index Point',
    gestureEmoji: '☝️',
    requiredGesture: GESTURES.DRAW,
    targetLane: 0,
    startLane: 1,
    obstacleLane: 1,
    instruction: 'Point your index finger ☝️ to steer into Lane 1!',
    explanation: 'Dodge the incoming taxi by switching to the left lane.',
    hint: 'Point your index finger straight up.',
    color: 'bg-neo-yellow',
  },
  {
    stepIndex: 2,
    title: 'Lane 2 (Middle Lane)',
    gestureName: 'Peace Sign',
    gestureEmoji: '✌️',
    requiredGesture: GESTURES.ERASE,
    altGesture: GESTURES.STOP, // open palm also supported
    targetLane: 1,
    startLane: 0,
    obstacleLane: 0,
    instruction: 'Show peace sign ✌️ to return to Lane 2!',
    explanation: 'Roadblock ahead in Lane 1! Move to the center lane.',
    hint: 'Extend both your index and middle fingers in a V-sign.',
    color: 'bg-neo-cyan',
  },
  {
    stepIndex: 3,
    title: 'Lane 3 (Right Lane)',
    gestureName: 'Rock Sign',
    gestureEmoji: '🤟',
    requiredGesture: GESTURES.ROCK,
    targetLane: 2,
    startLane: 1,
    obstacleLane: 1,
    instruction: 'Show rock sign 🤟 to steer into Lane 3!',
    explanation: 'Heavy traffic in Lane 2! Dodge into the right lane.',
    hint: 'Raise index and pinky fingers (rock / horns sign).',
    color: 'bg-orange-300',
  },
  {
    stepIndex: 4,
    title: 'Nitro Turbo Boost',
    gestureName: 'Closed Fist',
    gestureEmoji: '✊',
    requiredGesture: GESTURES.PAN,
    targetLane: 2,
    startLane: 2,
    obstacleLane: -1, // No obstacle, open road!
    instruction: 'Make a closed fist ✊ for Nitro Boost!',
    explanation: 'Straight open highway! Clench your fist to ignite turbo flames.',
    hint: 'Curl all fingers tightly into a solid fist.',
    color: 'bg-neo-lime',
  },
];
 
export default function CrazyRoadTutorial({ liveGesture: propLiveGesture, videoRef: propVideoRef, overlayCanvasRef: propOverlayRef }) {
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
  const { completeGame } = useGestureAcademy('hill-climb');
  const { recordGameResult } = usePlayer();

  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'bump', text: string }
  const [isCompleted, setIsCompleted] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Simulation internal state refs (keeps loop running smoothly at 60fps)
  const simRef = useRef({
    lane: 1,
    targetLane: 1,
    playerX: 0,
    playerY: 0,
    roadOffset: 0,
    speed: 7,
    bumpTimer: 0,
    nitroActive: false,
    nitroDuration: 0,
    obstacle: {
      active: true,
      lane: 1,
      y: -140,
      speed: 3.5,
      type: 'taxi',
    },
    passed: false,
    lastGesture: GESTURES.NONE,
  });

  const stage = STAGES[currentStageIdx] || STAGES[0];

  // Reset simulation for the current stage
  const resetStage = useCallback((stageIndex, isSoftRetry = false) => {
    const s = STAGES[stageIndex];
    if (!s) return;

    const sim = simRef.current;
    sim.lane = s.startLane;
    sim.targetLane = s.startLane;
    sim.speed = 7;
    sim.bumpTimer = 0;
    sim.nitroActive = false;
    sim.nitroDuration = 0;
    sim.passed = false;

    if (s.obstacleLane >= 0) {
      sim.obstacle = {
        active: true,
        lane: s.obstacleLane,
        y: isSoftRetry ? -160 : -140,
        speed: 3.2,
        type: s.stepIndex % 2 === 1 ? 'taxi' : 'sports_orange',
      };
    } else {
      sim.obstacle.active = false;
    }

    if (isSoftRetry) {
      setIsResetting(true);
      setTimeout(() => setIsResetting(false), 500);
    }
  }, []);

  // Initialize or transition stages
  useEffect(() => {
    resetStage(currentStageIdx, false);
    setFeedback(null);
  }, [currentStageIdx, resetStage]);

  // Handle gesture reaction in simulation
  useEffect(() => {
    if (isCompleted || !liveGesture) return;

    const sim = simRef.current;
    if (sim.bumpTimer > 0) return; // Locked during bump recovery

    // Stage 1: Lane 1 (☝️)
    if (stage.stepIndex === 1 && liveGesture === stage.requiredGesture) {
      if (sim.targetLane !== 0) {
        sim.targetLane = 0;
        audio.playSteer();
      }
    }
    // Stage 2: Lane 2 (✌️ or ✋)
    else if (stage.stepIndex === 2 && (liveGesture === stage.requiredGesture || liveGesture === stage.altGesture)) {
      if (sim.targetLane !== 1) {
        sim.targetLane = 1;
        audio.playSteer();
      }
    }
    // Stage 3: Lane 3 (🤟)
    else if (stage.stepIndex === 3 && liveGesture === stage.requiredGesture) {
      if (sim.targetLane !== 2) {
        sim.targetLane = 2;
        audio.playSteer();
      }
    }
    // Stage 4: Nitro Boost (✊)
    else if (stage.stepIndex === 4 && liveGesture === stage.requiredGesture) {
      if (!sim.nitroActive) {
        sim.nitroActive = true;
        sim.speed = 18;
        audio.playNitro();
      }
    }
  }, [liveGesture, stage, isCompleted]);

  // Main 60 FPS Canvas Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      const sim = simRef.current;

      // ── Road Layout Metrics ────────────────────────────────────────────────
      const scale = W / 440;
      const roadMargin = 45 * scale;
      const playableWidth = W - roadMargin * 2;
      const laneWidth = playableWidth / 3;

      // Player X interpolation towards target lane
      const targetX = roadMargin + sim.targetLane * laneWidth + laneWidth / 2;
      sim.playerX += (targetX - sim.playerX) * 0.16;
      sim.playerY = H - 110 * scale;

      // Road movement
      sim.roadOffset += sim.speed * scale;

      // ── Background Grass ──────────────────────────────────────────────────
      ctx.fillStyle = '#16a34a'; // Lush arcade green
      ctx.fillRect(0, 0, W, H);

      // Procedural roadside bushes/trees
      ctx.fillStyle = '#15803d';
      const treeSpacing = 65 * scale;
      for (let y = -treeSpacing + (sim.roadOffset % treeSpacing); y < H + treeSpacing; y += treeSpacing) {
        ctx.beginPath();
        ctx.arc(18 * scale, y, 12 * scale, 0, Math.PI * 2);
        ctx.arc(W - 18 * scale, y + 25 * scale, 12 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Asphalt Road ──────────────────────────────────────────────────────
      ctx.fillStyle = '#1e293b'; // Slate dark asphalt
      ctx.fillRect(roadMargin, 0, playableWidth, H);

      // Yellow outer border curbs
      ctx.fillStyle = '#facc15';
      ctx.fillRect(roadMargin - 4 * scale, 0, 4 * scale, H);
      ctx.fillRect(roadMargin + playableWidth, 0, 4 * scale, H);

      // Dashed lane dividers
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5 * scale;
      ctx.setLineDash([20 * scale, 24 * scale]);
      ctx.lineDashOffset = -sim.roadOffset;

      ctx.beginPath();
      ctx.moveTo(roadMargin + laneWidth, 0);
      ctx.lineTo(roadMargin + laneWidth, H);
      ctx.moveTo(roadMargin + laneWidth * 2, 0);
      ctx.lineTo(roadMargin + laneWidth * 2, H);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // ── Lane Target Guides & Highlights ───────────────────────────────────
      const targetLaneX = roadMargin + stage.targetLane * laneWidth;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.fillRect(targetLaneX, 0, laneWidth, H);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(targetLaneX + 2, 0, laneWidth - 4, H);

      // Lane numbers on asphalt
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.font = `900 ${18 * scale}px "Space Grotesk", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('LANE 1', roadMargin + laneWidth * 0.5, H - 24 * scale);
      ctx.fillText('LANE 2', roadMargin + laneWidth * 1.5, H - 24 * scale);
      ctx.fillText('LANE 3', roadMargin + laneWidth * 2.5, H - 24 * scale);

      // ── Obstacle Vehicle Logic & Render ───────────────────────────────────
      const obs = sim.obstacle;
      if (obs && obs.active) {
        obs.y += (sim.speed - obs.speed) * scale;
        const obsX = roadMargin + obs.lane * laneWidth + laneWidth / 2;
        const obsW = 44 * scale;
        const obsH = 86 * scale;

        // Render Obstacle
        if (obs.type === 'taxi') {
          drawTaxi(ctx, obsX, obs.y, obsW, obsH);
        } else {
          drawSportsCar(ctx, obsX, obs.y, obsW, obsH, '#f97316', '#ea580c', false);
        }

        // Proximity Danger Warning Aura
        if (Math.abs(obs.y - sim.playerY) < 140 * scale && obs.lane === sim.targetLane) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
          ctx.lineWidth = 3 * scale;
          ctx.strokeRect(obsX - obsW * 0.65, obs.y - obsH * 0.6, obsW * 1.3, obsH * 1.2);
        }

        // Check Collision (BUMP)
        const hitX = Math.abs(sim.playerX - obsX) < obsW * 0.75;
        const hitY = Math.abs(sim.playerY - obs.y) < obsH * 0.75;

        if (hitX && hitY && sim.bumpTimer === 0) {
          sim.bumpTimer = 45; // ~0.75s bump stun
          audio.playBump();
          setFeedback({
            type: 'bump',
            text: `💥 BUMP! Show ${stage.gestureEmoji} (${stage.gestureName}) to move to ${stage.title}. Let's retry!`,
          });
        }

        // Successfully passed the obstacle!
        if (obs.y > sim.playerY + obsH && !sim.passed && sim.bumpTimer === 0) {
          if (sim.targetLane === stage.targetLane) {
            sim.passed = true;
            audio.playSuccess();
            setFeedback({
              type: 'success',
              text: `✓ GREAT JOB! ${stage.title.toUpperCase()} CLEARED!`,
            });

            // Advance to next stage after brief celebration
            setTimeout(() => {
              if (currentStageIdx + 1 < STAGES.length) {
                setCurrentStageIdx((prev) => prev + 1);
              } else {
                handleCompleteTutorial();
              }
            }, 1200);
          }
        }

        // If obstacle rolled off screen without passing condition, reset it
        if (obs.y > H + 100 && !sim.passed) {
          obs.y = -140;
        }
      }

      // ── Stage 4 Nitro Boost Progression ───────────────────────────────────
      if (stage.stepIndex === 4 && sim.nitroActive && !sim.passed) {
        sim.nitroDuration += 1;

        // Speed warp lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2 * scale;
        for (let i = 0; i < 5; i++) {
          const rx = roadMargin + Math.random() * playableWidth;
          const ry = Math.random() * H;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx, ry + 40 * scale);
          ctx.stroke();
        }

        if (sim.nitroDuration >= 80) { // ~1.3 seconds of boost
          sim.passed = true;
          audio.playSuccess();
          setFeedback({
            type: 'success',
            text: '🔥 NITRO BOOST MASTERED! FULL SPEED ACHIEVED!',
          });
          setTimeout(() => {
            handleCompleteTutorial();
          }, 1200);
        }
      }

      // Handle Bump Shake & Recovery
      if (sim.bumpTimer > 0) {
        sim.bumpTimer -= 1;
        // Screen shake on bump
        ctx.save();
        const shakeX = (Math.random() - 0.5) * 8 * scale;
        const shakeY = (Math.random() - 0.5) * 8 * scale;
        ctx.translate(shakeX, shakeY);

        // Cartoon Bump Starburst
        ctx.fillStyle = '#ef4444';
        ctx.font = `900 ${22 * scale}px "Space Grotesk", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('💥 BUMP!', sim.playerX, sim.playerY - 60 * scale);

        if (sim.bumpTimer === 1) {
          resetStage(currentStageIdx, true);
        }
      }

      // ── Player Sports Car Render ──────────────────────────────────────────
      const carW = 46 * scale;
      const carH = 90 * scale;
      drawSportsCar(ctx, sim.playerX, sim.playerY, carW, carH, '#3b82f6', '#60a5fa', true);

      // Nitro Exhaust Flame FX
      if (sim.nitroActive) {
        ctx.save();
        ctx.translate(sim.playerX, sim.playerY + carH / 2);
        // Left flame
        const flameGrad = ctx.createLinearGradient(0, 0, 0, 45 * scale);
        flameGrad.addColorStop(0, '#fef08a');
        flameGrad.addColorStop(0.4, '#f97316');
        flameGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = flameGrad;

        ctx.beginPath();
        ctx.moveTo(-carW * 0.28, 0);
        ctx.lineTo(-carW * 0.18, 35 * scale + Math.random() * 15 * scale);
        ctx.lineTo(-carW * 0.08, 0);
        ctx.fill();

        // Right flame
        ctx.beginPath();
        ctx.moveTo(carW * 0.08, 0);
        ctx.lineTo(carW * 0.18, 35 * scale + Math.random() * 15 * scale);
        ctx.lineTo(carW * 0.28, 0);
        ctx.fill();
        ctx.restore();
      }

      if (sim.bumpTimer > 0) ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [currentStageIdx, stage, resetStage]);

  // Completion Handler
  const handleCompleteTutorial = () => {
    setIsCompleted(true);
    completeGame('hill-climb');
    try {
      recordGameResult?.({
        gameId: 'hill-climb',
        score: 100,
        highScore: 100,
        xpAward: 40,
        isWin: true,
      });
    } catch {}
  };

  // Keyboard accessibility controls
  useEffect(() => {
    const onKey = (e) => {
      const sim = simRef.current;
      if (e.key === 'ArrowLeft' || e.key === '1') {
        sim.targetLane = 0;
        audio.playSteer();
      } else if (e.key === 'ArrowUp' || e.key === '2') {
        sim.targetLane = 1;
        audio.playSteer();
      } else if (e.key === 'ArrowRight' || e.key === '3') {
        sim.targetLane = 2;
        audio.playSteer();
      } else if (e.key === ' ' || e.key === 'b' || e.key === 'B') {
        sim.nitroActive = true;
        sim.speed = 18;
        audio.playNitro();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="w-full flex flex-col items-center">
      {/* ── Top Scenario Progression Bar ──────────────────────────────────── */}
      <div className="w-full bg-white border-3 border-black p-4 shadow-neo-md mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono font-black text-xs sm:text-sm uppercase mb-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-neo-lime border border-black animate-pulse" />
            <span>
              STEP {stage.stepIndex} OF 4: {stage.title} ({stage.gestureEmoji} {stage.gestureName})
            </span>
          </div>
          <span className="text-zinc-600">
            {isCompleted ? '100% COMPLETE' : `${Math.round(((stage.stepIndex - 1) / 4) * 100)}% Complete`}
          </span>
        </div>

        {/* Step Progress Pills */}
        <div className="grid grid-cols-4 gap-2">
          {STAGES.map((s, idx) => (
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

      {/* ── Main Interactive Simulation Stage ─────────────────────────────── */}
      {!isCompleted ? (
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Live Playable Road Simulator (7 Cols) */}
          <div className="lg:col-span-7 bg-white border-3 border-black p-4 sm:p-5 shadow-neo-lg relative flex flex-col items-center">
            
            {/* Stage Prompt Banner */}
            <div className={`w-full p-3 border-2 border-black shadow-neo-sm mb-3 ${stage.color} flex items-center justify-between gap-3`}>
              <div className="flex items-center gap-2.5">
                <span className="text-3xl sm:text-4xl filter drop-shadow-[1px_1px_0px_#000]">
                  {stage.gestureEmoji}
                </span>
                <div>
                  <h3 className="font-display font-black text-sm sm:text-base uppercase tracking-tight text-black leading-tight">
                    {stage.instruction}
                  </h3>
                  <p className="font-mono text-[11px] sm:text-xs text-zinc-800 font-bold">
                    {stage.explanation}
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-block neo-tag bg-white font-mono text-[10px] font-black uppercase">
                ACTIVE STEP
              </span>
            </div>

            {/* Game Canvas Container */}
            <div className="relative w-full max-w-[420px] aspect-[3/4] bg-black border-3 border-black shadow-neo overflow-hidden rounded-none">
              <canvas
                ref={canvasRef}
                width={420}
                height={560}
                className="w-full h-full block select-none"
              />

              {/* Dynamic In-Game Feedback Banner */}
              {feedback && (
                <div className={`absolute top-4 inset-x-4 p-2.5 border-2 border-black shadow-neo font-display font-black text-xs sm:text-sm text-center uppercase tracking-wide animate-in fade-in zoom-in-95 duration-150 z-20 ${
                  feedback.type === 'success'
                    ? 'bg-neo-lime text-black'
                    : 'bg-neo-red text-white'
                }`}>
                  {feedback.text}
                </div>
              )}

              {/* Resetting Transition Indicator */}
              {isResetting && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center font-mono font-black text-xs uppercase text-neo-yellow z-10">
                  ↺ RESETTING LANE POSITION...
                </div>
              )}
            </div>

            {/* Keyboard & Hand Hint Footer */}
            <div className="w-full max-w-[420px] mt-3 flex items-center justify-between text-[11px] font-mono text-zinc-600 font-bold">
              <span>☝️ Hand gestures or Arrow keys (1, 2, 3)</span>
              <span>⚡ Practice Sandbox</span>
            </div>
          </div>

          {/* Right Column: Live Webcam Feedback & Coaching (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Live Camera Feed Card */}
            <div className="bg-white border-3 border-black p-4 sm:p-5 shadow-neo-lg">
              <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse border border-black" />
                  <span className="font-display font-black text-xs sm:text-sm uppercase tracking-tight">
                    Live Gesture Camera
                  </span>
                </div>
                <span className="font-mono text-[11px] font-black bg-neo-yellow border border-black px-2 py-0.5">
                  Detected: {liveGesture || 'Searching...'}
                </span>
              </div>

              {/* Video with Hand Landmarks Overlay */}
              <div className="relative w-full aspect-video bg-black border-2 border-black shadow-neo-sm overflow-hidden flex items-center justify-center mb-3">
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

                {/* Status Watermark */}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/75 border border-white/30 text-[9px] font-mono text-white uppercase tracking-wider">
                  Target: {stage.gestureEmoji} {stage.gestureName}
                </div>
              </div>

              {/* Live Match Verification Indicator */}
              <div className={`p-2.5 border-2 border-black flex items-center justify-between gap-2 ${
                liveGesture === stage.requiredGesture || (stage.altGesture && liveGesture === stage.altGesture)
                  ? 'bg-neo-lime/30 border-neo-lime text-black'
                  : 'bg-zinc-100 text-zinc-700'
              }`}>
                <div className="flex items-center gap-2 font-mono font-black text-xs uppercase">
                  <span>{liveGesture === stage.requiredGesture ? '✅' : '⏳'}</span>
                  <span>
                    {liveGesture === stage.requiredGesture
                      ? `MATCH: ${stage.gestureName.toUpperCase()} DETECTED!`
                      : `Show ${stage.gestureEmoji} in front of camera`}
                  </span>
                </div>
                <span className="text-xl">{stage.gestureEmoji}</span>
              </div>
            </div>

            {/* Step Explanation & Quick Tips Card */}
            <div className="bg-[#FFFDF5] border-3 border-black p-4 sm:p-5 shadow-neo-lg">
              <h4 className="font-display font-black text-sm uppercase tracking-tight mb-2 flex items-center gap-1.5">
                <span>💡</span>
                <span>How This Works in the Real Game</span>
              </h4>
              <p className="text-zinc-800 text-xs sm:text-sm font-medium leading-relaxed mb-3">
                In Crazy Road, traffic spawns randomly in all 3 lanes. Holding your finger signs allows instant lane changes without touching any screen or keyboard.
              </p>
              <div className="bg-neo-cream border-2 border-black p-2.5 font-mono text-xs font-bold text-zinc-800 space-y-1">
                <div>• <strong className="text-black">Lane 1 (Left):</strong> ☝️ Index Point</div>
                <div>• <strong className="text-black">Lane 2 (Middle):</strong> ✌️ Peace Sign or ✋ Palm</div>
                <div>• <strong className="text-black">Lane 3 (Right):</strong> 🤟 Rock Sign</div>
                <div>• <strong className="text-black">Nitro Boost:</strong> ✊ Closed Fist</div>
              </div>
            </div>

            {/* Quick Skip or Manual Advance */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  audio.playSteer();
                  resetStage(currentStageIdx, true);
                }}
                className="flex-1 py-2 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-bold text-xs uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
              >
                ↺ Retry Step
              </button>
              <button
                onClick={() => {
                  audio.playSuccess();
                  if (currentStageIdx + 1 < STAGES.length) {
                    setCurrentStageIdx((prev) => prev + 1);
                  } else {
                    handleCompleteTutorial();
                  }
                }}
                className="flex-1 py-2 bg-neo-yellow hover:bg-yellow-300 border-2 border-black font-display font-black text-xs uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
              >
                Skip Step ➔
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Completion & Mastery Celebration Screen ───────────────────────── */
        <div className="w-full max-w-xl bg-white border-4 border-black p-6 sm:p-8 shadow-neo-2xl text-center animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 mx-auto mb-4 bg-neo-lime border-3 border-black shadow-neo flex items-center justify-center text-4xl rounded-2xl rotate-3 hover:rotate-0 transition-transform">
            🏎️
          </div>

          <div className="inline-block px-3 py-1 bg-neo-yellow border-2 border-black font-mono font-black text-xs uppercase tracking-wider mb-3">
            🏆 CRAZY ROAD CERTIFIED
          </div>

          <h2 className="font-display font-black text-2xl sm:text-4xl uppercase tracking-tight text-black mb-2">
            You Mastered All 3 Lanes!
          </h2>

          <p className="text-zinc-700 text-sm sm:text-base font-medium max-w-md mx-auto mb-6 leading-relaxed">
            You've practiced lane switching and nitro boost in real time. You are now 100% prepared to hit the highway and climb the global leaderboards!
          </p>

          {/* Mastered Badges Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <div className="bg-neo-cream border-2 border-black p-2.5 text-center">
              <span className="text-2xl block mb-1">☝️</span>
              <span className="font-mono font-black text-[10px] uppercase block">Lane 1</span>
            </div>
            <div className="bg-neo-cream border-2 border-black p-2.5 text-center">
              <span className="text-2xl block mb-1">✌️</span>
              <span className="font-mono font-black text-[10px] uppercase block">Lane 2</span>
            </div>
            <div className="bg-neo-cream border-2 border-black p-2.5 text-center">
              <span className="text-2xl block mb-1">🤟</span>
              <span className="font-mono font-black text-[10px] uppercase block">Lane 3</span>
            </div>
            <div className="bg-neo-cream border-2 border-black p-2.5 text-center">
              <span className="text-2xl block mb-1">✊</span>
              <span className="font-mono font-black text-[10px] uppercase block">Nitro Boost</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/hill-climb')}
              className="w-full sm:w-auto px-8 py-3.5 bg-neo-lime hover:bg-lime-400 border-3 border-black font-display font-black text-sm uppercase tracking-wider shadow-neo hover:shadow-neo-lg active:translate-x-1 active:translate-y-1 transition-all flex items-center justify-center gap-2"
            >
              <span>Play Crazy Road Now</span>
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

// ── Procedural Vehicle Renderers (from crazyroad.jsx) ───────────────────────
function drawSportsCar(ctx, x, y, width, height, mainColor, accentColor, showHeadlights) {
  ctx.save();
  ctx.translate(x, y);

  if (showHeadlights) {
    const beamGrad = ctx.createLinearGradient(0, height / 2, 0, height / 2 + 55);
    beamGrad.addColorStop(0, 'rgba(255, 200, 100, 0.35)');
    beamGrad.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(-width * 0.35, height / 2);
    ctx.lineTo(-width * 0.55, height / 2 + 55);
    ctx.lineTo(-width * 0.1, height / 2 + 55);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(width * 0.35, height / 2);
    ctx.lineTo(width * 0.1, height / 2 + 55);
    ctx.lineTo(width * 0.55, height / 2 + 55);
    ctx.closePath();
    ctx.fill();
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.roundRect(-width / 2 - 2, -height / 2 + 4, width + 4, height, 14);
  ctx.fill();

  // Side Mirrors
  ctx.fillStyle = mainColor;
  ctx.fillRect(-width / 2 - 4, -height * 0.1, 5, 8);
  ctx.fillRect(width / 2 - 1, -height * 0.1, 5, 8);

  // Main Chassis
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, 14);
  ctx.fill();

  // Dual Racing Stripes
  ctx.fillStyle = accentColor;
  ctx.fillRect(-5, -height / 2, 3, height);
  ctx.fillRect(2, -height / 2, 3, height);

  // Windshield & Cabin Top
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(-width * 0.36, -height * 0.26, width * 0.72, height * 0.5, 8);
  ctx.fill();

  // Front Headlights
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.ellipse(-width * 0.33, -height / 2 + 4, 4, 2.5, 0.2, 0, Math.PI * 2);
  ctx.ellipse(width * 0.33, -height / 2 + 4, 4, 2.5, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Tail Lights
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-width * 0.36, height / 2 - 3, 8, 3);
  ctx.fillRect(width * 0.36 - 8, height / 2 - 3, 8, 3);

  ctx.restore();
}

function drawTaxi(ctx, x, y, width, height) {
  ctx.save();
  ctx.translate(x, y);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.roundRect(-width / 2 - 2, -height / 2 + 4, width + 4, height, 12);
  ctx.fill();

  // Body
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, 10);
  ctx.fill();

  // Hood Text
  ctx.fillStyle = '#172554';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TAXI', 0, -height * 0.3);

  // Cabin
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(-width * 0.36, -height * 0.2, width * 0.72, height * 0.44, 6);
  ctx.fill();

  // Roof Sign
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.roundRect(-width * 0.28, -height * 0.06, width * 0.56, height * 0.18, 3);
  ctx.fill();

  ctx.restore();
}
