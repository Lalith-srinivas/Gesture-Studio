import { useEffect, useRef, useCallback, useState } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';
import { GESTURES, getGestureLabel, getHandRotation } from '../utils/gestureDetector';

// ═══════════════════════════════════════════════════════════════════════════════
// GAME CONFIG & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const LANES = [0, 1, 2];
const LANE_COUNT = 3;
const BASE_SPEED = 7;
const BOOST_SPEED = 14;
const BOOST_DURATION = 3000; // 3 seconds of invincibility/ghosting
const HIGH_SCORE_KEY = 'traffic_rider_high_score';

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function createInputManager() {
  const sources = [];
  const state = { lane: 1, boost: false, pause: false };

  return {
    addSource(src) { sources.push(src); },
    update() {
      for (const src of sources) {
        const s = src.read();
        if (s.lane !== undefined) state.lane = s.lane;
        if (s.boost) state.boost = true;
        if (s.pause) state.pause = true;
      }
    },
    getState() {
      const res = { ...state };
      state.boost = false; // consume trigger single-frame
      state.pause = false;
      return res;
    },
  };
}

function createKeyboardSource() {
  let lane = 1;
  let boost = false;
  let pause = false;

  const onDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === '1') lane = 0;
    if (e.key === 'ArrowUp' || e.key === '2') lane = 1;
    if (e.key === 'ArrowRight' || e.key === '3') lane = 2;
    if (e.key === 'b' || e.key === 'B' || e.key === ' ') boost = true;
    if (e.key === 'p' || e.key === 'P') pause = true;
  };

  window.addEventListener('keydown', onDown);
  return {
    read() {
      const b = boost, p = pause;
      boost = false;
      pause = false;
      return { lane, boost: b, pause: p };
    },
    destroy() { window.removeEventListener('keydown', onDown); },
  };
}

function createHandTrackingSource(handStateRef) {
  return {
    read() {
      const h = handStateRef.current;
      if (!h || !h.detected) return {};

      let targetLane;
      // Gesture Mappings:
      // ☝️ Index Finger (DRAW) -> Lane 0
      // ✌️ Victory/Two Fingers -> Lane 1
      // Three Fingers (PINCH/OPEN) -> Lane 2
      if (h.gesture === GESTURES.DRAW) targetLane = 0;
      else if (h.gesture === GESTURES.STOP) targetLane = 1;
      else if (h.gesture === GESTURES.PINCH) targetLane = 2;

      return {
        lane: targetLane,
        boost: h.gesture === GESTURES.PAN, // ✊ Fist triggers Boost
      };
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME ENGINE FACTORIES
// ═══════════════════════════════════════════════════════════════════════════════

function createGameState() {
  const savedHigh = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
  return {
    player: {
      lane: 1,
      targetX: 0,
      x: 0,
      y: 0,
      width: 36,
      height: 70,
    },
    traffic: [],
    coins: [],
    speed: BASE_SPEED,
    score: 0,
    highScore: savedHigh,
    boostActive: false,
    boostTimer: 0,
    boostCharge: 100, // percentage meter
    roadOffset: 0,
    over: false,
    running: false,
    tick: 0,
  };
}

function spawnTrafficVehicle(canvasWidth) {
  const laneWidth = canvasWidth / LANE_COUNT;
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const types = ['car', 'truck', 'bus'];
  const type = types[Math.floor(Math.random() * types.length)];
  const height = type === 'bus' ? 110 : type === 'truck' ? 90 : 65;

  return {
    lane,
    x: lane * laneWidth + laneWidth / 2,
    y: -150,
    width: 38,
    height,
    speed: 2 + Math.random() * 3,
    color: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][Math.floor(Math.random() * 5)],
    type,
  };
}

function spawnCoin(canvasWidth) {
  const laneWidth = canvasWidth / LANE_COUNT;
  const lane = Math.floor(Math.random() * LANE_COUNT);
  return {
    lane,
    x: lane * laneWidth + laneWidth / 2,
    y: -50,
    radius: 12,
    collected: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TrafficRiderGame() {
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
  const boostBarRef = useRef(null);
  const overlayRef = useRef(null);
  const olTitleRef = useRef(null);
  const olSubRef = useRef(null);
  const olBtnRef = useRef(null);

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
    if (boostBarRef.current) {
      boostBarRef.current.style.width = `${gs.boostCharge}%`;
      boostBarRef.current.style.background = gs.boostActive ? '#3b82f6' : gs.boostCharge >= 100 ? '#10b981' : '#f59e0b';
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
    const gs = gsRef.current;
    gs.over = true;
    gs.running = false;
    const isNewHigh = saveHighScore(gs.score);

    if (olTitleRef.current) olTitleRef.current.textContent = '💥 Crash!';
    if (olSubRef.current) olSubRef.current.textContent = `${isNewHigh ? 'New High Score!' : 'Final Score:'} ${Math.floor(gs.score)}`;
    if (olBtnRef.current) olBtnRef.current.textContent = 'Play Again';
    if (overlayRef.current) overlayRef.current.style.display = 'flex';
  }, [saveHighScore]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // GAME LOOP & PHYSICS
  // ═══════════════════════════════════════════════════════════════════════════════

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const gs = gsRef.current;

    if (!gs.running) return;

    inputRef.current.update();
    const input = inputRef.current.getState();

    // 1. Lane Movement & Smooth Interpolation
    const laneWidth = canvas.width / LANE_COUNT;
    gs.player.lane = Math.max(0, Math.min(LANE_COUNT - 1, input.lane));
    gs.player.targetX = gs.player.lane * laneWidth + laneWidth / 2;
    gs.player.x += (gs.player.targetX - gs.player.x) * 0.2; // Smooth transition
    gs.player.y = canvas.height - 100;

    // 2. Boost Handling
    if (input.boost && gs.boostCharge >= 100 && !gs.boostActive) {
      gs.boostActive = true;
      gs.boostTimer = Date.now();
    }

    if (gs.boostActive) {
      gs.speed = BOOST_SPEED;
      gs.boostCharge = Math.max(0, 100 - ((Date.now() - gs.boostTimer) / BOOST_DURATION) * 100);
      if (Date.now() - gs.boostTimer >= BOOST_DURATION) {
        gs.boostActive = false;
      }
    } else {
      gs.speed = BASE_SPEED;
      if (gs.boostCharge < 100) gs.boostCharge = Math.min(100, gs.boostCharge + 0.15); // Recharging
    }

    // 3. Road & Score Progress
    gs.roadOffset = (gs.roadOffset + gs.speed) % 40;
    gs.score += gs.speed * 0.05;

    // 4. Spawning Traffic & Items
    if (gs.tick % 45 === 0) {
      gs.traffic.push(spawnTrafficVehicle(canvas.width));
    }
    if (gs.tick % 90 === 0) {
      gs.coins.push(spawnCoin(canvas.width));
    }

    // 5. Update Traffic Position & Collision
    for (let i = gs.traffic.length - 1; i >= 0; i--) {
      const v = gs.traffic[i];
      v.y += gs.speed - v.speed;

      // Collision Check (AABB)
      const p = gs.player;
      const hit = Math.abs(p.x - v.x) < (p.width + v.width) / 2 - 4 &&
                  Math.abs(p.y - v.y) < (p.height + v.height) / 2 - 6;

      if (hit) {
        if (!gs.boostActive) {
          endGame();
          return;
        }
      }

      if (v.y > canvas.height + 150) gs.traffic.splice(i, 1);
    }

    // 6. Update Coins
    for (let i = gs.coins.length - 1; i >= 0; i--) {
      const c = gs.coins[i];
      c.y += gs.speed;

      const p = gs.player;
      if (!c.collected && Math.hypot(p.x - c.x, p.y - c.y) < 30) {
        c.collected = true;
        gs.score += 50;
        gs.coins.splice(i, 1);
      } else if (c.y > canvas.height + 50) {
        gs.coins.splice(i, 1);
      }
    }

    // 7. Render
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Asphalt Road
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Lane Dividers
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]);
    ctx.lineDashOffset = -gs.roadOffset;

    for (let l = 1; l < LANE_COUNT; l++) {
      ctx.beginPath();
      ctx.moveTo(l * laneWidth, 0);
      ctx.lineTo(l * laneWidth, canvas.height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw Coins
    for (const c of gs.coins) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Traffic
    for (const v of gs.traffic) {
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.roundRect(v.x - v.width / 2, v.y - v.height / 2, v.width, v.height, 6);
      ctx.fill();
    }

    // Draw Player Motorcycle
    const p = gs.player;
    ctx.save();
    ctx.translate(p.x, p.y);

    if (gs.boostActive) {
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 15;
      ctx.globalAlpha = 0.8; // Ghost effect during boost
    }

    // Bike Body
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(-p.width / 2, -p.height / 2, p.width, p.height, 8);
    ctx.fill();

    // Windshield
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-p.width / 4, -p.height / 2 + 6, p.width / 2, 12);

    ctx.restore();

    gs.tick++;
    updateHUD();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [endGame, updateHUD]);

  const startGame = useCallback(() => {
    gsRef.current = createGameState();
    gsRef.current.running = true;
    if (overlayRef.current) overlayRef.current.style.display = 'none';
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = 420;
    }

    const manager = createInputManager();
    const kb = createKeyboardSource();
    const hand = createHandTrackingSource(handStateRef);
    manager.addSource(kb);
    manager.addSource(hand);
    inputRef.current = manager;

    const gestureSync = setInterval(() => {
      setActiveGesture(handStateRef.current.gesture);
    }, 100);

    return () => {
      kb.destroy();
      clearInterval(gestureSync);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', userSelect: 'none', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      {/* HUD Bar */}
      <div style={{ display: 'flex', gap: 12, padding: '10px 16px', background: '#f8fafc', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Score</div>
          <div ref={scoreRef} style={{ fontSize: 16, fontWeight: 'bold' }}>0</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#64748b' }}>High Score</div>
          <div ref={highScoreRef} style={{ fontSize: 16, fontWeight: 'bold' }}>{highScore}</div>
        </div>
        <div style={{ flex: 1, marginLeft: 16 }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Boost (Invincible)</div>
          <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
            <div ref={boostBarRef} style={{ height: '100%', width: '100%', background: '#10b981', transition: 'width 0.1s linear' }} />
          </div>
        </div>
      </div>

      {/* Game Stage */}
      <div style={{ position: 'relative' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: 0.15, pointerEvents: 'none' }} />
        <canvas ref={handOverlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }} />
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />

        {/* Overlay Menu */}
        <div ref={overlayRef} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px 32px', borderRadius: 12, textAlign: 'center' }}>
            <h2 ref={olTitleRef} style={{ margin: 0, fontSize: 24 }}>🏍️ Traffic Rider</h2>
            <p ref={olSubRef} style={{ color: '#64748b', margin: '8px 0 16px' }}>Avoid cars & collect coins!</p>
            <button ref={olBtnRef} onClick={startGame} style={{ padding: '10px 24px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, cursor: 'pointer' }}>
              Start Race
            </button>
          </div>
        </div>

        {/* Gesture Guide UI */}
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: 6, fontSize: 11, opacity: activeGesture === GESTURES.DRAW ? 1 : 0.4 }}>
            ☝️ Lane 1
          </div>
          <div style={{ background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: 6, fontSize: 11, opacity: activeGesture === GESTURES.STOP ? 1 : 0.4 }}>
            ✌️ Lane 2
          </div>
          <div style={{ background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: 6, fontSize: 11, opacity: activeGesture === GESTURES.PINCH ? 1 : 0.4 }}>
            👌 Lane 3
          </div>
          <div style={{ background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: 6, fontSize: 11, opacity: activeGesture === GESTURES.PAN ? 1 : 0.4 }}>
            ✊ Boost Phase
          </div>
        </div>
      </div>
    </div>
  );
}