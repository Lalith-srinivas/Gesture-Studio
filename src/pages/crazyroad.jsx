import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHandTracking } from '../hooks/useHandTracking';
import { GESTURES } from '../utils/gestureDetector';
import {
  startCarEngineSound,
  updateCarEnginePitch,
  stopCarEngineSound,
  playDashSound,
  playCrashSound,
  resumeAudio
} from '../utils/soundEffects';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & GAME CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const LANE_COUNT = 3;
const BASE_SPEED = 8;
const BOOST_SPEED = 16;
const BOOST_DURATION = 3500;
const HIGH_SCORE_KEY = 'traffic_rider_high_score';

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

function createInputManager() {
  const sources = [];
  const state = { lane: 1, boost: false };

  return {
    addSource(src) { sources.push(src); },
    update() {
      for (const src of sources) {
        const s = src.read();
        if (s.lane !== undefined) state.lane = s.lane;
        if (s.boost) state.boost = true;
      }
    },
    getState() {
      const res = { ...state };
      state.boost = false;
      return res;
    },
  };
}

function createKeyboardSource() {
  let lane = 1;
  let boost = false;

  const onDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === '1') lane = 0;
    if (e.key === 'ArrowUp' || e.key === '2') lane = 1;
    if (e.key === 'ArrowRight' || e.key === '3') lane = 2;
    if (e.key === 'b' || e.key === 'B' || e.key === ' ') boost = true;
  };

  window.addEventListener('keydown', onDown);
  return {
    read() {
      const b = boost;
      boost = false;
      return { lane, boost: b };
    },
    destroy() { window.removeEventListener('keydown', onDown); },
  };
}

function createHandTrackingSource(handStateRef) {
  return {
    read() {
      const h = handStateRef.current;
      if (!h || !h.detected) return {};

      let lane;
      if (h.gesture === GESTURES.DRAW) lane = 0;      // ☝️ First lane
      else if (h.gesture === GESTURES.STOP) lane = 1;  // ✋ Second lane
      else if (h.gesture === GESTURES.ROCK) lane = 2;  // 🤟 Third lane

      return {
        lane,
        boost: h.gesture === GESTURES.PAN, // ✊ Fist: Boost
      };
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME STATE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

function createGameState() {
  const savedHigh = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
  return {
    player: {
      lane: 1,
      targetX: 0,
      x: 0,
      y: 0,
      width: 48,
      height: 92,
      lives: 3,
    },
    traffic: [],
    coins: [],
    speed: BASE_SPEED,
    score: 0,
    highScore: savedHigh,
    boostActive: false,
    boostTimer: 0,
    boostCharge: 100,
    roadOffset: 0,
    over: false,
    running: false,
    tick: 0,
  };
}

function spawnTrafficVehicle(canvasWidth) {
  const scale = canvasWidth / 460;
  const roadMargin = 50 * scale;
  const playableWidth = canvasWidth - roadMargin * 2;
  const laneWidth = playableWidth / LANE_COUNT;
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const types = ['sports_orange', 'taxi'];
  const type = types[Math.floor(Math.random() * types.length)];

  return {
    lane,
    x: roadMargin + lane * laneWidth + laneWidth / 2,
    y: -120 * scale,
    width: 48 * scale,
    height: 92 * scale,
    speed: (2 + Math.random() * 2.5) * scale,
    type,
  };
}

function spawnCoin(canvasWidth) {
  const scale = canvasWidth / 460;
  const roadMargin = 50 * scale;
  const playableWidth = canvasWidth - roadMargin * 2;
  const laneWidth = playableWidth / LANE_COUNT;
  const lane = Math.floor(Math.random() * LANE_COUNT);

  return {
    x: roadMargin + lane * laneWidth + laneWidth / 2,
    y: -40 * scale,
    radius: 12 * scale,
    collected: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCEDURAL CANVAS RENDERERS (CAR & ENVIRONMENT GRAPHICS)
// ═══════════════════════════════════════════════════════════════════════════════

function drawSportsCar(ctx, x, y, width, height, mainColor, accentColor, showHeadlights) {
  ctx.save();
  ctx.translate(x, y);

  // Rear Headlight Glow / Tail Beam
  if (showHeadlights) {
    const beamGrad = ctx.createLinearGradient(0, height / 2, 0, height / 2 + 70);
    beamGrad.addColorStop(0, 'rgba(255, 200, 100, 0.4)');
    beamGrad.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = beamGrad;

    ctx.beginPath();
    ctx.moveTo(-width * 0.35, height / 2);
    ctx.lineTo(-width * 0.6, height / 2 + 70);
    ctx.lineTo(-width * 0.1, height / 2 + 70);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(width * 0.35, height / 2);
    ctx.lineTo(width * 0.1, height / 2 + 70);
    ctx.lineTo(width * 0.6, height / 2 + 70);
    ctx.closePath();
    ctx.fill();
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.roundRect(-width / 2 - 2, -height / 2 + 4, width + 4, height, 18);
  ctx.fill();

  // Side Mirrors
  ctx.fillStyle = mainColor;
  ctx.fillRect(-width / 2 - 5, -height * 0.1, 6, 10);
  ctx.fillRect(width / 2 - 1, -height * 0.1, 6, 10);

  // Main Chassis
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, 16);
  ctx.fill();

  // Dual Racing Stripes
  ctx.fillStyle = accentColor;
  ctx.fillRect(-6, -height / 2, 4, height);
  ctx.fillRect(2, -height / 2, 4, height);

  // Windshield & Cabin Top
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(-width * 0.38, -height * 0.28, width * 0.76, height * 0.52, 10);
  ctx.fill();

  // Roof Surface
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.roundRect(-width * 0.3, -height * 0.1, width * 0.6, height * 0.26, 6);
  ctx.fill();
  ctx.fillStyle = accentColor;
  ctx.fillRect(-6, -height * 0.1, 4, height * 0.26);
  ctx.fillRect(2, -height * 0.1, 4, height * 0.26);

  // Front Headlights
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.ellipse(-width * 0.35, -height / 2 + 5, 5, 3, 0.2, 0, Math.PI * 2);
  ctx.ellipse(width * 0.35, -height / 2 + 5, 5, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Tail Lights
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-width * 0.38, height / 2 - 4, 10, 4);
  ctx.fillRect(width * 0.38 - 10, height / 2 - 4, 10, 4);

  ctx.restore();
}

function drawTaxi(ctx, x, y, width, height) {
  ctx.save();
  ctx.translate(x, y);

  // Tail Beams
  const beamGrad = ctx.createLinearGradient(0, height / 2, 0, height / 2 + 65);
  beamGrad.addColorStop(0, 'rgba(255, 230, 150, 0.35)');
  beamGrad.addColorStop(1, 'rgba(255, 230, 150, 0)');
  ctx.fillStyle = beamGrad;
  ctx.fillRect(-width * 0.4, height / 2, width * 0.8, 65);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.roundRect(-width / 2 - 2, -height / 2 + 4, width + 4, height, 14);
  ctx.fill();

  // Body
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, 12);
  ctx.fill();

  // Hood Text & Checker
  ctx.fillStyle = '#172554';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CRAZY', 0, -height * 0.32);

  // Checker Pattern Rear
  ctx.fillStyle = '#000';
  for (let i = -12; i <= 8; i += 8) {
    ctx.fillRect(i, height * 0.38, 4, 4);
    ctx.fillRect(i + 4, height * 0.42, 4, 4);
  }

  // Cabin & Roof
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(-width * 0.38, -height * 0.22, width * 0.76, height * 0.48, 8);
  ctx.fill();

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.roundRect(-width * 0.3, -height * 0.08, width * 0.6, height * 0.22, 4);
  ctx.fill();

  ctx.restore();
}

function drawRoadsideTrees(ctx, width, height, roadOffset) {
  const scale = width / 460;
  const treeSpacing = 70 * scale;
  const bushR1 = 14 * scale;
  const bushR2 = 10 * scale;
  const leftX = 22 * scale;
  const rightX = width - 22 * scale;

  for (let y = -treeSpacing + (roadOffset % treeSpacing); y < height + treeSpacing; y += treeSpacing) {
    // Left Grass Bushes
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(leftX, y, bushR1, 0, Math.PI * 2);
    ctx.arc(leftX - 8 * scale, y + 8 * scale, bushR2, 0, Math.PI * 2);
    ctx.fill();

    // Right Grass Bushes
    ctx.beginPath();
    ctx.arc(rightX, y + 35 * scale, bushR1, 0, Math.PI * 2);
    ctx.arc(rightX + 8 * scale, y + 43 * scale, bushR2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TrafficRiderGame() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const handOverlayRef = useRef(null);
  const gsRef = useRef(createGameState());
  const inputRef = useRef(null);
  const rafRef = useRef(null);
  const handStateRef = useRef({ detected: false, gesture: GESTURES.NONE });

  const [activeGesture, setActiveGesture] = useState(GESTURES.NONE);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10));

  // HUD DOM Refs
  const scoreRef = useRef(null);
  const highScoreRef = useRef(null);
  const boostPercentRef = useRef(null);
  const needleRef = useRef(null);
  const overlayRef = useRef(null);
  const olTitleRef = useRef(null);
  const olSubRef = useRef(null);

  useHandTracking({
    videoRef,
    overlayCanvasRef: handOverlayRef,
    onGesture: (gesture, tip, dims, landmarks) => {
      const s = handStateRef.current;
      s.detected = tip !== null;
      s.gesture = gesture;
    }
  });

  const updateHUD = useCallback(() => {
    const gs = gsRef.current;
    if (scoreRef.current) scoreRef.current.textContent = Math.floor(gs.score);
    if (highScoreRef.current) highScoreRef.current.textContent = gs.highScore;

    const charge = Math.floor(gs.boostCharge);
    if (boostPercentRef.current) boostPercentRef.current.textContent = `${charge}%`;

    // Rotate speedometer needle (-90deg to 90deg)
    if (needleRef.current) {
      const deg = -90 + (charge / 100) * 180;
      needleRef.current.style.transform = `rotate(${deg}deg)`;
    }
  }, []);

  const saveHighScore = useCallback((score) => {
    const currentHigh = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    if (score > currentHigh) {
      localStorage.setItem(HIGH_SCORE_KEY, Math.floor(score).toString());
      setHighScore(Math.floor(score));
      return true;
    }
    return false;
  }, []);

  const endGame = useCallback(() => {
    playCrashSound();
    stopCarEngineSound();
    const gs = gsRef.current;
    gs.over = true;
    gs.running = false;
    const isNewHigh = saveHighScore(gs.score);

    if (olTitleRef.current) olTitleRef.current.textContent = '💥 CRASH!';
    if (olSubRef.current) olSubRef.current.textContent = `${isNewHigh ? 'New High Score:' : 'Final Score:'} ${Math.floor(gs.score)}`;
    if (overlayRef.current) overlayRef.current.style.display = 'flex';
  }, [saveHighScore]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // GAME LOOP
  // ═══════════════════════════════════════════════════════════════════════════════

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const gs = gsRef.current;

    if (!gs.running) return;

    inputRef.current.update();
    const input = inputRef.current.getState();

    const scale = canvas.width / 460;
    const roadMargin = 50 * scale;
    const playableWidth = canvas.width - roadMargin * 2;
    const laneWidth = playableWidth / LANE_COUNT;

    // 1. Steering
    gs.player.lane = Math.max(0, Math.min(LANE_COUNT - 1, input.lane));
    gs.player.targetX = roadMargin + gs.player.lane * laneWidth + laneWidth / 2;
    gs.player.x += (gs.player.targetX - gs.player.x) * 0.22;
    gs.player.y = canvas.height - 110 * scale;
    gs.player.width = 48 * scale;
    gs.player.height = 92 * scale;

    // 2. Boost Mechanics
    if (input.boost && gs.boostCharge >= 100 && !gs.boostActive) {
      playDashSound();
      gs.boostActive = true;
      gs.boostTimer = Date.now();
    }

    if (gs.boostActive) {
      gs.speed = BOOST_SPEED * scale;
      gs.boostCharge = Math.max(0, 100 - ((Date.now() - gs.boostTimer) / BOOST_DURATION) * 100);
      if (Date.now() - gs.boostTimer >= BOOST_DURATION) {
        gs.boostActive = false;
      }
    } else {
      gs.speed = BASE_SPEED * scale;
      if (gs.boostCharge < 100) gs.boostCharge = Math.min(100, gs.boostCharge + 0.12);
    }

    // Engine Pitch update
    updateCarEnginePitch(gs.speed / (BASE_SPEED * scale));

    // 3. Score & Progress
    gs.roadOffset = (gs.roadOffset + gs.speed) % (60 * scale);
    gs.score += (gs.speed / scale) * 0.05;

    // 4. Spawners
    if (gs.tick % 45 === 0) {
      gs.traffic.push(spawnTrafficVehicle(canvas.width));
    }
    if (gs.tick % 80 === 0) {
      gs.coins.push(spawnCoin(canvas.width));
    }

    // 5. Traffic Updates
    for (let i = gs.traffic.length - 1; i >= 0; i--) {
      const v = gs.traffic[i];
      v.y += gs.speed - v.speed;

      // Collision Check
      const p = gs.player;
      const hit = Math.abs(p.x - v.x) < (p.width + v.width) / 2 - 6 * scale &&
                  Math.abs(p.y - v.y) < (p.height + v.height) / 2 - 8 * scale;

      if (hit && !gs.boostActive) {
        endGame();
        return;
      }

      if (v.y > canvas.height + 150 * scale) gs.traffic.splice(i, 1);
    }

    // 6. Coin Updates
    for (let i = gs.coins.length - 1; i >= 0; i--) {
      const c = gs.coins[i];
      c.y += gs.speed;

      if (!c.collected && Math.hypot(gs.player.x - c.x, gs.player.y - c.y) < 32 * scale) {
        c.collected = true;
        gs.score += 25;
        gs.coins.splice(i, 1);
      } else if (c.y > canvas.height + 50 * scale) {
        gs.coins.splice(i, 1);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // RENDER SCENE
    // ═══════════════════════════════════════════════════════════════════════════════

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Green Grass Sides
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Road Base Asphalt
    ctx.fillStyle = '#262626';
    ctx.fillRect(roadMargin, 0, playableWidth, canvas.height);

    // Double Solid Yellow Outer Lines
    ctx.fillStyle = '#eab308';
    ctx.fillRect(roadMargin - 12 * scale, 0, 4 * scale, canvas.height);
    ctx.fillRect(roadMargin - 4 * scale, 0, 4 * scale, canvas.height);
    ctx.fillRect(canvas.width - roadMargin, 0, 4 * scale, canvas.height);
    ctx.fillRect(canvas.width - roadMargin + 8 * scale, 0, 4 * scale, canvas.height);

    // White Dashed Lane Dividers
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, 6 * scale);
    ctx.lineCap = 'butt';
    ctx.setLineDash([35 * scale, 35 * scale]);
    ctx.lineDashOffset = -gs.roadOffset;

    for (let l = 1; l < LANE_COUNT; l++) {
      const lx = roadMargin + l * laneWidth;
      ctx.beginPath();
      ctx.moveTo(lx, -60 * scale);
      ctx.lineTo(lx, canvas.height + 60 * scale);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Trees/Bushes
    drawRoadsideTrees(ctx, canvas.width, canvas.height, gs.roadOffset);

    // Coins
    for (const c of gs.coins) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Traffic Cars
    for (const v of gs.traffic) {
      if (v.type === 'taxi') {
        drawTaxi(ctx, v.x, v.y, v.width, v.height);
      } else {
        drawSportsCar(ctx, v.x, v.y, v.width, v.height, '#f97316', '#ffffff', true);
      }
    }

    // Player Car (Red Sports Car)
    ctx.save();
    if (gs.boostActive) {
      ctx.globalAlpha = 0.85;
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 20;
    }
    drawSportsCar(ctx, gs.player.x, gs.player.y, gs.player.width, gs.player.height, '#dc2626', '#ffffff', true);
    ctx.restore();

    gs.tick++;
    updateHUD();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [endGame, updateHUD]);

  const startGame = useCallback(() => {
    resumeAudio();
    startCarEngineSound();
    gsRef.current = createGameState();
    gsRef.current.running = true;
    if (overlayRef.current) overlayRef.current.style.display = 'none';
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // Responsive canvas sizing
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const isMobile = window.innerWidth < 640;
    const ASPECT = 460 / 640; // width / height
    const padX = isMobile ? 16 : 48;
    const padY = isMobile ? 24 : 48;
    const maxW = Math.min(window.innerWidth - padX, 620);
    const maxH = Math.min(window.innerHeight - padY, 860);

    let w, h;
    if (maxW / maxH > ASPECT) {
      // Height-limited
      h = maxH;
      w = h * ASPECT;
    } else {
      // Width-limited
      w = maxW;
      h = w / ASPECT;
    }

    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    container.style.width = `${Math.round(w)}px`;
    container.style.height = `${Math.round(h)}px`;
  }, []);

  useEffect(() => {
    resizeCanvas();

    const manager = createInputManager();
    const kb = createKeyboardSource();
    const hand = createHandTrackingSource(handStateRef);
    manager.addSource(kb);
    manager.addSource(hand);
    inputRef.current = manager;

    const gestureSync = setInterval(() => {
      setActiveGesture(handStateRef.current.gesture);
    }, 100);

    window.addEventListener('resize', resizeCanvas);

    return () => {
      stopCarEngineSound();
      kb.destroy();
      clearInterval(gestureSync);
      window.removeEventListener('resize', resizeCanvas);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [resizeCanvas]);

  return (
    <div className="min-h-screen bg-neo-dots text-black flex flex-col items-center justify-center p-2 sm:p-4 select-none font-sans relative overflow-hidden">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 sm:top-6 sm:left-6 neo-btn-white px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-mono font-black uppercase z-50 flex items-center gap-1.5"
        title="Back to Home"
      >
        <span>←</span> HOME
      </button>

      <div ref={containerRef} className="relative border-4 border-black shadow-neo-2xl bg-black overflow-hidden flex items-center justify-center">
        
        {/* Top-Left Score Overlay */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 bg-neo-yellow border-3 border-black shadow-neo px-2.5 py-1 sm:px-3 sm:py-1.5 flex flex-col items-start">
          <div className="font-display font-black text-base sm:text-lg text-black leading-tight">
            SCORE: <span ref={scoreRef}>0</span>
          </div>
          <div className="font-mono text-[9px] sm:text-[10px] font-bold text-zinc-800 uppercase">
            HIGH: <span ref={highScoreRef}>{highScore}</span>
          </div>
        </div>

        {/* Bottom-Right Speedometer / Boost Dial */}
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 w-24 sm:w-28 bg-[#FFFDF5] border-3 border-black shadow-neo p-1.5 sm:p-2 flex flex-col items-center">
          <div className="relative w-16 sm:w-20 h-9 sm:h-11 border-t-4 border-l-4 border-r-4 border-black rounded-t-full bg-neo-lime/30 mt-1 flex justify-center">
            {/* Needle */}
            <div
              ref={needleRef}
              className="absolute bottom-0 w-1 h-7 sm:h-9 bg-neo-red border-l border-r border-black origin-bottom"
              style={{ transform: 'rotate(-90deg)', transition: 'transform 0.1s linear' }}
            />
          </div>
          <div ref={boostPercentRef} className="font-display font-black text-xs text-black mt-0.5 sm:mt-1">100%</div>
          <div className="font-mono text-[7px] sm:text-[8px] font-black uppercase text-zinc-600">BOOST CHARGE</div>
        </div>

        {/* Camera Tracking Feeds */}
        <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: 0.08, pointerEvents: 'none' }} />
        <canvas ref={handOverlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }} />
        
        {/* Main Canvas */}
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

        {/* Start / Game Over Overlay */}
        <div ref={overlayRef} className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-20 p-4">
          <div className="neo-box-lg bg-[#FFFDF5] p-6 sm:p-8 text-center max-w-xs sm:max-w-sm w-full flex flex-col items-center">
            <h1 ref={olTitleRef} className="font-display font-black text-2xl sm:text-3xl text-black uppercase tracking-tight mb-1">
              🏎️ CRAZY ROAD
            </h1>
            <p ref={olSubRef} className="font-mono text-xs font-bold text-zinc-700 my-3">
              DODGE TRAFFIC & BOOST TO WIN!
            </p>
            <button onClick={startGame} className="neo-btn-primary w-full py-3 text-sm sm:text-base uppercase tracking-wider mt-2">
              RACE NOW ➔
            </button>
          </div>
        </div>

        {/* Floating Gesture Indicators */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-1 sm:gap-1.5 z-10 pointer-events-none">
          <div className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-mono font-bold uppercase border-2 border-black transition-all ${activeGesture === GESTURES.DRAW ? 'bg-neo-yellow text-black shadow-neo-sm scale-105' : 'bg-white/80 text-zinc-700'}`}>
            ☝️ Lane 1
          </div>
          <div className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-mono font-bold uppercase border-2 border-black transition-all ${activeGesture === GESTURES.STOP ? 'bg-neo-yellow text-black shadow-neo-sm scale-105' : 'bg-white/80 text-zinc-700'}`}>
            ✋ Lane 2
          </div>
          <div className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-mono font-bold uppercase border-2 border-black transition-all ${activeGesture === GESTURES.ROCK ? 'bg-neo-yellow text-black shadow-neo-sm scale-105' : 'bg-white/80 text-zinc-700'}`}>
            🤟 Lane 3
          </div>
          <div className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-mono font-bold uppercase border-2 border-black transition-all ${activeGesture === GESTURES.PAN ? 'bg-neo-pink text-black shadow-neo-sm scale-105' : 'bg-white/80 text-zinc-700'}`}>
            ✊ Boost
          </div>
        </div>

      </div>
    </div>
  );
}