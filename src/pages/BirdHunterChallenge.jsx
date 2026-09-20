import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHandTracking } from '../hooks/useHandTracking';
import { GESTURES } from '../utils/gestureDetector';
import { mapHandToScreen } from '../utils/resolution';
import { usePlayer } from '../hooks/usePlayer';
import PostGameProgression from '../components/PostGameProgression';
import AdSlot from '../components/ads/AdSlot';

// --- UTILS & CONSTANTS ---
const BIRD_TYPES = ['NORMAL', 'GOLDEN', 'FAST', 'TINY', 'GIANT', 'GHOST'];
const PROJECTILES = [
  { id: 'stone', name: 'Stone', color: '#9ca3af', bounce: 0.3, mass: 1 },
  { id: 'cookie', name: 'Cookie', color: '#d97706', bounce: 0.1, mass: 0.8 },
  { id: 'tennis', name: 'Tennis Ball', color: '#bef264', bounce: 0.8, mass: 0.5 },
  { id: 'energy', name: 'Energy Ball', color: '#06b6d4', bounce: 1.0, mass: 0.3 },
];

const POWERUP_TYPES = ['SLOW_MO', 'TRIPLE_SHOT', 'EXPLOSIVE', 'TRAJECTORY', 'DOUBLE_SCORE'];

// --- AUDIO SYNTHESIZER ---
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  playTone(freq, type = 'sine', duration = 0.1, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }
  stretch() { this.playTone(200, 'triangle', 0.1, 0.05); }
  launch() { this.playTone(150, 'sawtooth', 0.2, 0.1); }
  hit() { this.playTone(800, 'square', 0.1, 0.1); }
  headshot() { this.playTone(1100, 'square', 0.15, 0.22); this.playTone(1450, 'sine', 0.2, 0.2); }
  powerup() { this.playTone(550, 'sine', 0.2, 0.2); this.playTone(880, 'sine', 0.3, 0.2); }
  miss() { this.playTone(120, 'sawtooth', 0.25, 0.1); }
}
const audio = new AudioEngine();

// --- GAME ENGINE ---
export default function BirdHunterChallenge() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const handOverlayRef = useRef(null);

  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, PAUSED, GAMEOVER
  const [orientation, setOrientation] = useState('landscape');
  const [activeGesture, setActiveGesture] = useState(GESTURES.NONE);
  const [handTracked, setHandTracked] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const { recordGameResult, allGameStats } = usePlayer();
  const [highScore, setHighScore] = useState(() => {
    const remote = allGameStats?.['bird-hunter']?.bestScore || 0;
    const local = parseInt(localStorage.getItem('birdHunterHighScore') || '0', 10);
    return Math.max(remote, local);
  });
  const [consecutiveMisses, setConsecutiveMisses] = useState(0);
  const [activePowerup, setActivePowerup] = useState(null);
  const [powerupTimeLeft, setPowerupTimeLeft] = useState(0);
  const [selectedProjectile, setSelectedProjectile] = useState(PROJECTILES[0]);
  const [isMuted, setIsMuted] = useState(false);
  const [lastProgressionResult, setLastProgressionResult] = useState(null);
  const sessionRecordedRef = useRef(false);

  // Gesture tracking refs
  const lastGestureRef = useRef(GESTURES.NONE);
  const pauseCooldownRef = useRef(0);
  const handPosRef = useRef({ x: 400, y: 500 });
  const gameStateRef = useRef('MENU');

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Physics & Game Loop State
  const game = useRef({
    width: 800,
    height: 600,
    birds: [],
    projectiles: [],
    particles: [],
    floatingTexts: [],
    powerups: [],
    slingshot: { x: 140, y: 400, pullX: 140, pullY: 400, aimAngle: -0.22, power: 45, isPulling: false, radius: 22 },
    nextSpawnTimer: 0,
    camera: { shakeX: 0, shakeY: 0, shakeTime: 0 },
    activePowerups: { slowMoTime: 0, doubleScoreTime: 0, tripleShotTime: 0, explosiveTime: 0 },
    lastTime: performance.now(),
    difficulty: 1,
    frames: 0,
    consecutiveMisses: 0,
    showTrajectory: true
  });

  // Load High Score
  useEffect(() => {
    const hs = localStorage.getItem('birdHunterHighScore');
    if (hs) {
      const parsed = parseInt(hs, 10);
      setHighScore(parsed);
    }
  }, []);

  useEffect(() => {
    const firestoreBest = allGameStats?.['bird-hunter']?.bestScore || 0;
    if (firestoreBest > 0) {
      setHighScore((prev) => {
        const higher = Math.max(prev, firestoreBest);
        try {
          localStorage.setItem('birdHunterHighScore', higher.toString());
        } catch {}
        return higher;
      });
    }
  }, [allGameStats]);

  const updateHighScore = (newScore) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('birdHunterHighScore', newScore.toString());
    }
  };

  // Orientation Check
  useEffect(() => {
    const checkOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // --- CONTROLS IMPLEMENTATION ---
  const controls = useRef({
    grabProjectile: (x, y) => {
      if (gameStateRef.current !== 'PLAYING') return;
      game.current.slingshot.isPulling = true;
      controls.current.aim(x, y);
      audio.stretch();
    },
    aim: (x, y) => {
      if (!game.current.slingshot.isPulling) return;
      const { slingshot } = game.current;

      const dx = x - slingshot.x;
      const dy = y - (slingshot.y - 15);
      const dist = Math.hypot(dx, dy);

      let aimAngle;
      let power;

      if (dx >= 0) {
        // User points into the sky/field towards targets (Rightward)
        aimAngle = Math.atan2(dy, dx);
        // Clamp aim angle so it always aims rightward into the playing sky (-75 deg to +45 deg)
        aimAngle = Math.max(-1.3, Math.min(0.75, aimAngle));
        power = Math.min(Math.max(dist * 0.65, 30), 140);
        // Slingshot pouch pulls backward in opposite direction for tension
        slingshot.pullX = slingshot.x - Math.cos(aimAngle) * power;
        slingshot.pullY = slingshot.y - Math.sin(aimAngle) * power;
      } else {
        // User pulls backward behind slingshot (Classic Angry Birds pull-back)
        aimAngle = Math.atan2(-dy, -dx);
        aimAngle = Math.max(-1.3, Math.min(0.75, aimAngle));
        power = Math.min(Math.max(dist, 30), 140);
        slingshot.pullX = slingshot.x - Math.cos(aimAngle) * power;
        slingshot.pullY = slingshot.y - Math.sin(aimAngle) * power;
      }

      slingshot.aimAngle = aimAngle;
      slingshot.power = power;
    },
    releaseShot: () => {
      if (!game.current.slingshot.isPulling) return;
      const { slingshot } = game.current;
      slingshot.isPulling = false;

      const aimAngle = slingshot.aimAngle !== undefined ? slingshot.aimAngle : -0.3;
      const power = slingshot.power || 60;

      audio.launch();
      // Speed in px/second — needs to be high enough to cross the full canvas width
      // At 60fps, adjustedDt≈0.0167. To cross 900px width in ~1.5s we need vx ≈ 600px/s
      const speed = Math.max(power * 9, 700);

      const baseProj = {
        x: slingshot.x + 30,
        y: slingshot.y - 20,
        vx: Math.cos(aimAngle) * speed,
        vy: Math.sin(aimAngle) * speed,
        radius: 16,
        color: selectedProjectile.color,
        bounce: selectedProjectile.bounce,
        id: selectedProjectile.id,
        isExplosive: game.current.activePowerups.explosiveTime > 0,
        rotation: 0,
        hitBird: false
      };

      game.current.projectiles.push({ ...baseProj });

      if (game.current.activePowerups.tripleShotTime > 0) {
        game.current.projectiles.push({
          ...baseProj,
          vx: Math.cos(aimAngle - 0.15) * speed,
          vy: Math.sin(aimAngle - 0.15) * speed
        });
        game.current.projectiles.push({
          ...baseProj,
          vx: Math.cos(aimAngle + 0.15) * speed,
          vy: Math.sin(aimAngle + 0.15) * speed
        });
      }

      // Reset pouch
      slingshot.pullX = slingshot.x;
      slingshot.pullY = slingshot.y;
    }
  });

  // --- HAND TRACKING INTEGRATION ---
  useHandTracking({
    videoRef,
    overlayCanvasRef: handOverlayRef,
    onGesture: (gesture, indexTip, dims, landmarks) => {
      const c = canvasRef.current;
      const v = videoRef.current;
      const currentGameState = gameStateRef.current;

      if (!landmarks && !indexTip) {
        setHandTracked(false);
        setActiveGesture(GESTURES.NONE);
        if (game.current.slingshot.isPulling && lastGestureRef.current === GESTURES.PINCH) {
          controls.current.releaseShot();
        }
        lastGestureRef.current = GESTURES.NONE;
        return;
      }

      setHandTracked(true);
      setActiveGesture(gesture);

      if (c && v) {
        const thumbLm = landmarks ? landmarks[4] : indexTip;
        const indexLm = landmarks ? landmarks[8] : indexTip;
        const pinchLm = landmarks
          ? { x: (landmarks[4].x + landmarks[8].x) / 2, y: (landmarks[4].y + landmarks[8].y) / 2 }
          : indexTip;

        const pos = mapHandToScreen(
          gesture === GESTURES.PINCH ? pinchLm : indexLm,
          c.width, c.height, v.videoWidth, v.videoHeight, true
        );
        handPosRef.current = pos;

        // 🤏 PINCH: Grab Slingshot & Aim
        if (gesture === GESTURES.PINCH) {
          if (currentGameState === 'PLAYING') {
            if (!game.current.slingshot.isPulling) {
              controls.current.grabProjectile(pos.x, pos.y);
            } else {
              controls.current.aim(pos.x, pos.y);
            }
          }
        }
        // RELEASE PINCH: Release Shot!
        else if (lastGestureRef.current === GESTURES.PINCH && gesture !== GESTURES.PAN) {
          if (game.current.slingshot.isPulling && currentGameState === 'PLAYING') {
            controls.current.releaseShot();
          }
        }
        // ✊ FIST: Cancel Shot / Reset Aim
        else if (gesture === GESTURES.PAN) {
          game.current.slingshot.isPulling = false;
          game.current.slingshot.pullX = game.current.slingshot.x;
          game.current.slingshot.pullY = game.current.slingshot.y;
        }
        // 🤟 ROCK: Pause / Resume Game
        else if (gesture === GESTURES.ROCK) {
          if (Date.now() - pauseCooldownRef.current > 1200) {
            pauseCooldownRef.current = Date.now();
            if (currentGameState === 'PLAYING') {
              setGameState('PAUSED');
            } else if (currentGameState === 'PAUSED') {
              setGameState('PLAYING');
            }
          }
        }
      }

      lastGestureRef.current = gesture;
    }
  });

  // --- SPAWN HELPERS ---
  const spawnBird = useCallback((w, h) => {
    const typeProb = Math.random();
    let type = 'NORMAL';
    if (typeProb > 0.85) type = 'GOLDEN';
    else if (typeProb > 0.7) type = 'FAST';
    else if (typeProb > 0.55) type = 'TINY';
    else if (typeProb > 0.4) type = 'GIANT';
    else if (typeProb > 0.3) type = 'GHOST';

    let radius = 22;
    let baseSpeed = 140 + Math.random() * 70;

    if (type === 'FAST') baseSpeed *= 1.6;
    if (type === 'TINY') radius = 13;
    if (type === 'GIANT') radius = 38;
    if (type === 'GHOST') baseSpeed *= 0.85;

    const currentScore = game.current.score || 0;
    // Speed: 1.0x at score < 200, 1.2x when score >= 200
    const speedMult = currentScore >= 200 ? 1.2 : 1.0;
    const finalSpeed = baseSpeed * speedMult;

    let startX, startY, dir, moveAxis, baseY, baseX;

    if (currentScore >= 200) {
      // 4 directions: Top-to-Bottom, Bottom-to-Top, Left-to-Right, Right-to-Left
      const dirChoice = Math.floor(Math.random() * 4);
      if (dirChoice === 0) {
        // Left to Right
        moveAxis = 'horizontal';
        dir = 1;
        startX = -60;
        startY = 80 + Math.random() * (h * 0.45);
      } else if (dirChoice === 1) {
        // Right to Left
        moveAxis = 'horizontal';
        dir = -1;
        startX = w + 60;
        startY = 80 + Math.random() * (h * 0.45);
      } else if (dirChoice === 2) {
        // Top to Bottom
        moveAxis = 'vertical';
        dir = 1;
        startX = Math.random() * (w * 0.65) + w * 0.25;
        startY = -60;
      } else {
        // Bottom to Top
        moveAxis = 'vertical';
        dir = -1;
        startX = Math.random() * (w * 0.65) + w * 0.25;
        startY = h + 60;
      }
    } else {
      // Score < 200: standard horizontal flight
      moveAxis = 'horizontal';
      dir = Math.random() > 0.5 ? 1 : -1;
      startX = dir === 1 ? -60 : w + 60;
      startY = 80 + Math.random() * (h * 0.45);
    }

    baseX = startX;
    baseY = startY;
    const patternType = Math.floor(Math.random() * 3);

    game.current.birds.push({
      id: Math.random(),
      type,
      x: startX,
      y: startY,
      baseY,
      baseX,
      dir,
      moveAxis,
      baseSpeed,
      speed: finalSpeed,
      radius,
      patternType,
      phase: Math.random() * Math.PI * 2,
      hp: type === 'GIANT' ? 3 : 1,
      maxHp: type === 'GIANT' ? 3 : 1
    });
  }, []);

  const spawnPowerup = useCallback((x, y) => {
    if (Math.random() > 0.25) return;
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    game.current.powerups.push({ x, y, type, vy: -1.8, radius: 18, t: 0, opacity: 1 });
  }, []);

  const spawnParticles = useCallback((x, y, color, count = 16) => {
    for (let i = 0; i < count; i++) {
      game.current.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 1,
        color,
        size: Math.random() * 5 + 3
      });
    }
  }, []);

  const addFloatingText = useCallback((x, y, text, color = '#FACC15', size = 22) => {
    game.current.floatingTexts.push({ x, y, text, color, size, life: 1, vy: -2 });
  }, []);

  // --- GAME START & RESET ---
  const startGame = () => {
    audio.init();
    sessionRecordedRef.current = false;
    setLastProgressionResult(null);
    const canvas = canvasRef.current;
    const w = canvas ? canvas.width : 800;
    const h = canvas ? canvas.height : 600;
    const slingX = Math.max(130, Math.floor(w * 0.16));
    const slingY = Math.floor(h * 0.62);

    game.current = {
      width: w,
      height: h,
      birds: [],
      projectiles: [],
      particles: [],
      floatingTexts: [],
      powerups: [],
      slingshot: { x: slingX, y: slingY, pullX: slingX, pullY: slingY, aimAngle: -0.22, power: 45, isPulling: false, radius: 22 },
      nextSpawnTimer: 0,
      camera: { shakeX: 0, shakeY: 0, shakeTime: 0 },
      activePowerups: { slowMoTime: 0, doubleScoreTime: 0, tripleShotTime: 0, explosiveTime: 0 },
      lastTime: performance.now(),
      difficulty: 1,
      frames: 0,
      consecutiveMisses: 0,
      showTrajectory: true,
      score: 0
    };

    setScore(0);
    setCombo(0);
    setConsecutiveMisses(0);
    setActivePowerup(null);

    // Initial: Only 1 bird at the beginning (per user rules)
    spawnBird(w, h);

    setGameState('PLAYING');
  };

  // --- MAIN CANVAS LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;

    const handleResize = () => {
      if (containerRef.current) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
        game.current.width = canvas.width;
        game.current.height = canvas.height;
        game.current.slingshot.x = Math.max(130, Math.floor(canvas.width * 0.16));
        game.current.slingshot.y = Math.floor(canvas.height * 0.62);
        if (!game.current.slingshot.isPulling) {
          game.current.slingshot.pullX = game.current.slingshot.x;
          game.current.slingshot.pullY = game.current.slingshot.y;
          game.current.slingshot.aimAngle = -0.22;
        }
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const drawBird = (b) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.moveAxis === 'vertical') {
        // Facing down when dir=1, facing up when dir=-1
        ctx.rotate(b.dir === 1 ? Math.PI / 2 : -Math.PI / 2);
      } else {
        if (b.dir === -1) ctx.scale(-1, 1);
      }

      let mainColor = '#10B981'; // Normal
      if (b.type === 'GOLDEN') mainColor = '#FBBF24';
      if (b.type === 'FAST') mainColor = '#3B82F6';
      if (b.type === 'GIANT') mainColor = '#EF4444';
      if (b.type === 'GHOST') { mainColor = '#A8A29E'; ctx.globalAlpha = 0.55; }
      if (b.type === 'TINY') mainColor = '#EC4899';

      const flap = Math.sin(b.phase * 3) * 8;

      // Shadow
      ctx.beginPath();
      ctx.ellipse(3, 4, b.radius, b.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();

      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, b.radius, b.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = mainColor;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#000';
      ctx.stroke();

      // Wing
      ctx.beginPath();
      ctx.ellipse(-b.radius * 0.25, flap, b.radius * 0.55, b.radius * 0.28, flap * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.stroke();

      // Eye
      ctx.beginPath();
      ctx.arc(b.radius * 0.45, -b.radius * 0.2, b.radius * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.radius * 0.52, -b.radius * 0.2, b.radius * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();

      // Beak
      ctx.beginPath();
      ctx.moveTo(b.radius * 0.8, -b.radius * 0.12);
      ctx.lineTo(b.radius * 1.35, 0);
      ctx.lineTo(b.radius * 0.8, b.radius * 0.22);
      ctx.closePath();
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
      ctx.stroke();

      // Health bar for giant
      if (b.type === 'GIANT' && b.hp < b.maxHp) {
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-20, -b.radius - 12, 40 * (b.hp / b.maxHp), 6);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-20, -b.radius - 12, 40, 6);
      }

      ctx.restore();
    };

    const drawProjectile = (p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);

      // Shadow
      ctx.beginPath();
      ctx.arc(3, 3, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();

      // Ball Body
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#000';
      ctx.stroke();

      // Detailing
      if (p.id === 'tennis') {
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-p.radius * 0.5, 0, p.radius * 0.7, -Math.PI / 4, Math.PI / 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.radius * 0.5, 0, p.radius * 0.7, Math.PI - Math.PI / 4, Math.PI + Math.PI / 4);
        ctx.stroke();
      } else if (p.id === 'cookie') {
        ctx.fillStyle = '#451A03';
        ctx.beginPath(); ctx.arc(-5, -5, 2.5, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(4, -3, 2, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(-2, 4, 2.5, 0, 7); ctx.fill();
      } else if (p.id === 'energy') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath(); ctx.arc(-3, -3, 4, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    };

    const render = (time) => {
      const g = game.current;
      const dt = Math.min((time - g.lastTime) / 1000, 0.08);
      g.lastTime = time;

      const timeScale = g.activePowerups.slowMoTime > 0 ? 0.35 : 1;
      const adjustedDt = dt * timeScale;
      g.frames++;

      // Powerups degradation
      if (g.activePowerups.slowMoTime > 0) {
        g.activePowerups.slowMoTime -= dt;
        setPowerupTimeLeft(Math.ceil(g.activePowerups.slowMoTime));
        if (g.activePowerups.slowMoTime <= 0) setActivePowerup(null);
      }
      if (g.activePowerups.doubleScoreTime > 0) {
        g.activePowerups.doubleScoreTime -= dt;
        setPowerupTimeLeft(Math.ceil(g.activePowerups.doubleScoreTime));
        if (g.activePowerups.doubleScoreTime <= 0) setActivePowerup(null);
      }
      if (g.activePowerups.tripleShotTime > 0) {
        g.activePowerups.tripleShotTime -= dt;
        setPowerupTimeLeft(Math.ceil(g.activePowerups.tripleShotTime));
        if (g.activePowerups.tripleShotTime <= 0) setActivePowerup(null);
      }
      if (g.activePowerups.explosiveTime > 0) {
        g.activePowerups.explosiveTime -= dt;
        setPowerupTimeLeft(Math.ceil(g.activePowerups.explosiveTime));
        if (g.activePowerups.explosiveTime <= 0) setActivePowerup(null);
      }

      // Camera Shake
      if (g.camera.shakeTime > 0) {
        g.camera.shakeX = (Math.random() - 0.5) * 12;
        g.camera.shakeY = (Math.random() - 0.5) * 12;
        g.camera.shakeTime -= dt;
      } else {
        g.camera.shakeX = 0;
        g.camera.shakeY = 0;
      }

      if (gameStateRef.current === 'PLAYING') {
        const curScore = g.score || 0;

        // Dynamic Difficulty Scaling
        g.difficulty = 1 + (curScore / 800);

        // Speed multiplier: 1.0x initially, exactly 1.2x when score >= 200
        const speedMult = curScore >= 200 ? 1.2 : 1.0;

        // 1 bird at a time: clean pacing, no multiply birds
        const targetBirdCount = 1;

        if (g.birds.length < targetBirdCount) {
          if (g.nextSpawnTimer > 0) {
            g.nextSpawnTimer -= adjustedDt;
          }
          if (g.nextSpawnTimer <= 0) {
            spawnBird(canvas.width, canvas.height);
            g.nextSpawnTimer = 0.6;
          }
        }

        // Update Birds
        g.birds.forEach((bird) => {
          bird.phase += adjustedDt * 4;
          bird.speed = (bird.baseSpeed || bird.speed) * speedMult;

          if (bird.moveAxis === 'vertical') {
            // Top to Bottom (dir = 1) or Bottom to Top (dir = -1)
            bird.y += bird.dir * bird.speed * adjustedDt;
            if (bird.patternType === 0) {
              bird.x = bird.baseX + Math.sin(bird.phase) * 50;
            } else if (bird.patternType === 1) {
              bird.x = bird.baseX + Math.cos(bird.phase * 1.3) * 35;
            } else {
              bird.x = bird.baseX + Math.sin(bird.phase * 0.8) * 65;
            }
          } else {
            // Left to Right (dir = 1) or Right to Left (dir = -1)
            bird.x += bird.dir * bird.speed * adjustedDt;
            if (bird.patternType === 0) {
              bird.y = bird.baseY + Math.sin(bird.phase) * 60;
            } else if (bird.patternType === 1) {
              bird.y = bird.baseY + Math.cos(bird.phase * 1.5) * 45;
            } else if (bird.patternType === 2) {
              bird.y = bird.baseY + Math.sin(bird.phase * 0.7) * 90;
            }
          }
        });

        // Filter escaped birds (Misses)
        g.birds = g.birds.filter((b) => {
          let escaped = false;
          if (b.moveAxis === 'vertical') {
            escaped = b.dir === 1 ? b.y > canvas.height + 80 : b.y < -80;
          } else {
            escaped = (b.dir === 1 && b.x > canvas.width + 80) || (b.dir === -1 && b.x < -80);
          }
          if (escaped) {
            // Count miss
            g.consecutiveMisses += 1;
            setConsecutiveMisses(g.consecutiveMisses);
            setCombo(0);
            audio.miss();
            const missX = Math.max(80, Math.min(canvas.width - 80, b.x));
            const missY = Math.max(80, Math.min(canvas.height - 80, b.y));
            addFloatingText(missX, missY, `MISS! (${g.consecutiveMisses}/3)`, '#EF4444');
            if (g.consecutiveMisses >= 3) {
              setGameState('GAMEOVER');
              if (!sessionRecordedRef.current) {
                sessionRecordedRef.current = true;
                recordGameResult({
                  gameId: 'bird-hunter',
                  score: g.score || 0,
                  sessionId: `bh_${Date.now()}_${Math.random()}`,
                }).then((res) => {
                  if (res) setLastProgressionResult(res);
                });
              }
            }
            return false;
          }
          return true;
        });

        // Update Projectiles
        g.projectiles.forEach((p) => {
          p.vy += 220 * adjustedDt; // Natural parabolic gravity
          p.x += p.vx * adjustedDt;
          p.y += p.vy * adjustedDt;
          p.rotation += p.vx * 0.012;
        });

        // Update Powerup Drops
        g.powerups.forEach((pw) => {
          pw.vy += 90 * adjustedDt;
          pw.y += pw.vy * adjustedDt;
          pw.t += dt;
        });
        g.powerups = g.powerups.filter((pw) => pw.y < canvas.height + 40);

        // Collisions: Projectile vs Birds
        g.projectiles.forEach((proj) => {
          g.birds.forEach((bird) => {
            if (bird.hp <= 0) return;
            const dist = Math.hypot(proj.x - bird.x, proj.y - bird.y);

            if (dist < proj.radius + bird.radius + 12) {
              // Hit!
              proj.hitBird = true;
              const isHeadshot = dist < bird.radius * 0.45;
              bird.hp--;

              if (bird.hp <= 0) {
                // Reset consecutive misses on hit!
                g.consecutiveMisses = 0;
                setConsecutiveMisses(0);

                let pts = 50;
                if (bird.type === 'GOLDEN') pts = 250;
                if (bird.type === 'FAST') pts = 100;
                if (bird.type === 'TINY') pts = 150;
                if (bird.type === 'GIANT') pts = 200;
                if (bird.type === 'GHOST') pts = 120;
                if (isHeadshot) { pts += 50; audio.headshot(); g.camera.shakeTime = 0.2; }
                else { audio.hit(); }

                if (g.activePowerups.doubleScoreTime > 0) pts *= 2;

                setCombo((prev) => {
                  const newCombo = prev + 1;
                  const finalPts = pts * newCombo;
                  const nextScore = (g.score || 0) + finalPts;
                  g.score = nextScore;
                  setScore(nextScore);
                  updateHighScore(nextScore);
                  addFloatingText(bird.x, bird.y - 20, `${isHeadshot ? 'HEADSHOT! ' : ''}+${finalPts}`, isHeadshot ? '#FACC15' : '#10B981');
                  return newCombo;
                });

                spawnParticles(bird.x, bird.y, bird.type === 'GOLDEN' ? '#FBBF24' : '#EF4444', isHeadshot ? 28 : 16);
                spawnPowerup(bird.x, bird.y);

                // Explosive effect
                if (proj.isExplosive) {
                  spawnParticles(proj.x, proj.y, '#F97316', 40);
                  g.camera.shakeTime = 0.35;
                  g.birds.forEach((ob) => {
                    if (Math.hypot(ob.x - proj.x, ob.y - proj.y) < 140) ob.hp = 0;
                  });
                }
              }
            }
          });

          // Projectile vs Powerups
          g.powerups.forEach((pw) => {
            if (Math.hypot(proj.x - pw.x, proj.y - pw.y) < proj.radius + pw.radius) {
              pw.y = canvas.height + 100; // remove
              audio.powerup();
              setActivePowerup(pw.type);
              addFloatingText(pw.x, pw.y, `POWERUP: ${pw.type}!`, '#A855F7', 24);
              if (pw.type === 'SLOW_MO') g.activePowerups.slowMoTime = 6;
              if (pw.type === 'DOUBLE_SCORE') g.activePowerups.doubleScoreTime = 6;
              if (pw.type === 'TRIPLE_SHOT') g.activePowerups.tripleShotTime = 6;
              if (pw.type === 'EXPLOSIVE') g.activePowerups.explosiveTime = 6;
            }
          });
        });

        // Clean dead birds & projectiles
        g.birds = g.birds.filter((b) => b.hp > 0);
        g.projectiles = g.projectiles.filter(
          (p) => p.y < canvas.height + 80 && p.x < canvas.width + 80
        );

        // Update Particles
        g.particles.forEach((p) => {
          p.x += p.vx * adjustedDt * 60;
          p.y += p.vy * adjustedDt * 60;
          p.life -= adjustedDt * 2.2;
        });
        g.particles = g.particles.filter((p) => p.life > 0);

        // Update Floating Texts
        g.floatingTexts.forEach((ft) => {
          ft.y += ft.vy * adjustedDt * 60;
          ft.life -= adjustedDt * 1.5;
        });
        g.floatingTexts = g.floatingTexts.filter((ft) => ft.life > 0);
      }

      // ─── DRAWING ──────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(g.camera.shakeX, g.camera.shakeY);

      // Sky Background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, '#BAE6FD');
      skyGrad.addColorStop(0.7, '#E0F2FE');
      skyGrad.addColorStop(1, '#FEF08A');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);


      // Active Powerup Tint
      if (g.activePowerups.slowMoTime > 0) {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw Powerups Drops
      g.powerups.forEach((pw) => {
        ctx.save();
        ctx.translate(pw.x, pw.y);
        ctx.fillStyle = '#A855F7';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, pw.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, 0);
        ctx.restore();
      });

      // ─── DRAW BIRD DOTTED FLIGHT PATHS ────────────────────────────────────
      ctx.save();
      g.birds.forEach((b) => {
        ctx.beginPath();
        let pathColor = 'rgba(0, 0, 0, 0.35)';
        if (b.type === 'GOLDEN') pathColor = 'rgba(217, 119, 6, 0.7)';
        if (b.type === 'FAST') pathColor = 'rgba(37, 99, 235, 0.6)';
        if (b.type === 'GIANT') pathColor = 'rgba(220, 38, 38, 0.6)';
        if (b.type === 'GHOST') pathColor = 'rgba(100, 116, 139, 0.4)';
        if (b.type === 'TINY') pathColor = 'rgba(219, 39, 119, 0.6)';

        ctx.strokeStyle = pathColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);

        const dtStep = 0.06;

        if (b.moveAxis === 'vertical') {
          // Top to Bottom (dir = 1) or Bottom to Top (dir = -1)
          const remainingDist = b.dir === 1
            ? (canvas.height + 80 - b.y)
            : (b.y + 80);
          const numSteps = Math.ceil(remainingDist / (b.speed * dtStep));
          let py = b.y;
          let phase = b.phase;
          ctx.moveTo(b.x, py);
          for (let i = 1; i <= numSteps; i++) {
            py += b.dir * b.speed * dtStep;
            phase += dtStep * 4;
            let px = b.baseX;
            if (b.patternType === 0) px += Math.sin(phase) * 50;
            else if (b.patternType === 1) px += Math.cos(phase * 1.3) * 35;
            else px += Math.sin(phase * 0.8) * 65;
            ctx.lineTo(px, py);
            if (b.dir === 1 && py > canvas.height + 60) break;
            if (b.dir === -1 && py < -60) break;
          }
        } else {
          // Horizontal bird: path goes left or right
          const remainingDist = b.dir === 1
            ? (canvas.width + 60 - b.x)
            : (b.x + 60);
          const numSteps = Math.ceil(remainingDist / (b.speed * dtStep));
          let px = b.x;
          let phase = b.phase;
          ctx.moveTo(px, b.y);
          for (let i = 1; i <= numSteps; i++) {
            px += b.dir * b.speed * dtStep;
            phase += dtStep * 4;
            let py = b.baseY;
            if (b.patternType === 0) py += Math.sin(phase) * 60;
            else if (b.patternType === 1) py += Math.cos(phase * 1.5) * 45;
            else if (b.patternType === 2) py += Math.sin(phase * 0.7) * 90;
            ctx.lineTo(px, py);
            if (px < -60 || px > canvas.width + 60) break;
          }
        }

        ctx.stroke();
      });
      ctx.restore();

      // Draw Birds
      g.birds.forEach((bird) => drawBird(bird));

      // Draw Projectiles
      g.projectiles.forEach((p) => drawProjectile(p));

      // ─── DRAW SLINGSHOT ───────────────────────────────────────────────────
      const { slingshot } = g;
      const forkLeftX = slingshot.x - 22;
      const forkLeftY = slingshot.y - 48;
      const forkRightX = slingshot.x + 22;
      const forkRightY = slingshot.y - 42;

      // Back Rubber Band
      ctx.beginPath();
      ctx.moveTo(forkLeftX, forkLeftY);
      ctx.lineTo(slingshot.pullX, slingshot.pullY);
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#78350F';
      ctx.stroke();

      // Slingshot Wooden Fork (Neo-Brutalist Thick 4px Borders)
      ctx.save();
      ctx.fillStyle = '#D97706';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';

      // Stem Base down to ground
      ctx.beginPath();
      ctx.roundRect(slingshot.x - 12, slingshot.y - 10, 24, Math.max(100, canvas.height - slingshot.y), 6);
      ctx.fill();
      ctx.stroke();

      // Left Prong (Tilted slightly back)
      ctx.beginPath();
      ctx.moveTo(slingshot.x - 12, slingshot.y - 10);
      ctx.lineTo(forkLeftX - 6, forkLeftY);
      ctx.lineTo(forkLeftX + 10, forkLeftY);
      ctx.lineTo(slingshot.x - 2, slingshot.y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right Prong (Tilted forward)
      ctx.beginPath();
      ctx.moveTo(slingshot.x + 12, slingshot.y - 10);
      ctx.lineTo(forkRightX + 8, forkRightY);
      ctx.lineTo(forkRightX - 8, forkRightY);
      ctx.lineTo(slingshot.x + 2, slingshot.y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Projectile in Pouch
      if (slingshot.isPulling || (gameStateRef.current === 'PLAYING' && g.projectiles.length === 0)) {
        drawProjectile({
          x: slingshot.pullX,
          y: slingshot.pullY,
          radius: 16,
          color: selectedProjectile.color,
          id: selectedProjectile.id
        });
      }

      // Front Rubber Band
      ctx.beginPath();
      ctx.moveTo(forkRightX, forkRightY);
      ctx.lineTo(slingshot.pullX, slingshot.pullY);
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#92400E';
      ctx.stroke();

      // Leather Pouch Dot
      ctx.beginPath();
      ctx.arc(slingshot.pullX, slingshot.pullY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#1C1917';
      ctx.fill();
      ctx.stroke();

      // ─── STRAIGHT AIM GUIDE LINE ─────────────────────────────────────────
      ctx.save();
      // Use stored aimAngle (rightward, into the playing field)
      const drawAimAngle = slingshot.aimAngle !== undefined ? slingshot.aimAngle : -0.22;
      const guideLength = canvas.width;
      const endX = slingshot.x + Math.cos(drawAimAngle) * guideLength;
      const endY = slingshot.y - 15 + Math.sin(drawAimAngle) * guideLength;

      ctx.strokeStyle = slingshot.isPulling
        ? (g.activePowerups.explosiveTime > 0 ? '#EF4444' : '#DC2626')
        : 'rgba(220, 38, 38, 0.35)';
      ctx.lineWidth = slingshot.isPulling ? 3.5 : 1.8;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(slingshot.x, slingshot.y - 15);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Aim Reticle Crosshair when Pulling
      if (slingshot.isPulling) {
        const reticleDist = Math.min((slingshot.power || 45) * 5.5, canvas.width * 0.72);
        const rx = slingshot.x + Math.cos(drawAimAngle) * reticleDist;
        const ry = slingshot.y - 15 + Math.sin(drawAimAngle) * reticleDist;

        ctx.setLineDash([]);
        ctx.strokeStyle = '#DC2626';
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(rx, ry, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rx - 18, ry);
        ctx.lineTo(rx + 18, ry);
        ctx.moveTo(rx, ry - 18);
        ctx.lineTo(rx, ry + 18);
        ctx.stroke();
      }
      ctx.restore();

      // Ground Grass Border
      ctx.fillStyle = '#22C55E';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.rect(0, canvas.height - 25, canvas.width, 25);
      ctx.fill();
      ctx.stroke();

      // Draw Particles
      g.particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      });

      // Draw Floating Texts
      g.floatingTexts.forEach((ft) => {
        ctx.save();
        ctx.font = `900 ${ft.size}px sans-serif`;
        ctx.fillStyle = ft.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.globalAlpha = ft.life;
        ctx.textAlign = 'center';
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedProjectile, spawnBird, spawnParticles, spawnPowerup, addFloatingText]);

  // Pointer Handlers
  const handlePointerDown = (e) => {
    if (gameState !== 'PLAYING') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX !== undefined ? e.clientX : e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY !== undefined ? e.clientY : e.touches?.[0]?.clientY) - rect.top;
    controls.current.grabProjectile(x, y);
  };

  const handlePointerMove = (e) => {
    if (!game.current.slingshot.isPulling) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX !== undefined ? e.clientX : e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY !== undefined ? e.clientY : e.touches?.[0]?.clientY) - rect.top;
    controls.current.aim(x, y);
  };

  const handlePointerUp = () => {
    controls.current.releaseShot();
  };

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-sky-200 overflow-hidden font-sans select-none touch-none">
      
      {/* Portrait / Rotate Device Prompt */}
      {orientation === 'portrait' && (
        <div className="absolute inset-0 z-50 bg-amber-400/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="bg-white border-8 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rounded-3xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-4 animate-bounce-subtle">
            <div className="w-16 h-16 bg-yellow-300 border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center text-4xl animate-spin-slow">
              🔄
            </div>
            <h2 className="text-3xl font-black uppercase text-black tracking-tight -rotate-1">
              Rotate Device
            </h2>
            <p className="font-mono text-sm font-black text-zinc-800 uppercase leading-relaxed">
              Please turn your phone to <span className="text-orange-600 bg-orange-100 px-1 border border-black">Landscape Mode</span> for full screen slingshot hunting & best vision tracking!
            </p>
            <div className="mt-2 text-4xl">
              📱 ➔ 📲
            </div>
          </div>
        </div>
      )}

      {/* Tracking Camera & Landmark Overlays */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          opacity: 0.05,
          pointerEvents: 'none',
        }}
      />
      <canvas
        ref={handOverlayRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          transform: 'scaleX(-1)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Game Canvas */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair touch-none"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />

      {/* Top Neo-Brutalist HUD - Compact & Screen-Clearing on Mobile */}
      <header className="absolute top-1.5 sm:top-3 left-2 sm:left-4 right-2 sm:right-4 z-10 flex justify-between items-center gap-1.5 sm:gap-2.5 pointer-events-none">
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {/* Back to Home Button */}
          <button
            onClick={() => navigate('/')}
            className="bg-white hover:bg-yellow-300 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-black uppercase transition-all flex items-center gap-1 cursor-pointer"
            title="Back to Home"
          >
            <span>←</span> <span className="hidden sm:inline">HOME</span>
          </button>

          {/* Score Card - Compact single-line row */}
          <div className="bg-yellow-400 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg flex items-center gap-1 sm:gap-1.5">
            <span className="text-[9px] sm:text-[11px] font-mono font-black uppercase tracking-wider text-black">Score</span>
            <span className="text-xs sm:text-base font-mono font-black text-black leading-none">{score}</span>
          </div>

          {/* Combo Multiplier */}
          <div className="bg-pink-500 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-white flex items-center gap-1">
            <span className="text-[9px] sm:text-[11px] font-mono font-black uppercase tracking-wider">Combo</span>
            <span className="text-xs sm:text-base font-mono font-black leading-none">x{combo}</span>
          </div>

          {/* Strikes / 3 Misses Indicator */}
          <div className={`border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-white transition-all flex items-center gap-1 sm:gap-1.5 ${consecutiveMisses >= 2 ? 'bg-red-600 animate-pulse' : consecutiveMisses === 1 ? 'bg-amber-500' : 'bg-zinc-800'}`}>
            <span className="text-[8px] sm:text-[10px] font-mono font-black uppercase tracking-wider">Strikes</span>
            <span className="text-[9px] sm:text-xs font-black tracking-widest font-mono leading-none">
              {consecutiveMisses === 0 ? '⚪⚪⚪' :
               consecutiveMisses === 1 ? '❌⚪⚪' :
               consecutiveMisses === 2 ? '❌❌⚪' : '❌❌❌'}
            </span>
          </div>
        </div>

        {/* Live Gesture Detection Chip - Compact on large screens, hidden on compact mobile to free up center sky */}
        <div className="hidden lg:flex items-center gap-1.5 bg-white/95 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-2.5 py-1 rounded-lg pointer-events-auto">
          <span className={`w-2 h-2 rounded-full border border-black ${handTracked ? 'bg-neo-lime animate-pulse' : 'bg-zinc-400'}`} />
          <span className="text-[10px] font-mono font-bold text-zinc-600">GESTURE:</span>
          <span className="text-[10px] font-mono font-black uppercase text-black">
            {activeGesture === GESTURES.PINCH ? '🤏 Aim Slingshot' :
             activeGesture === GESTURES.PAN ? '✊ Cancel Shot' :
             activeGesture === GESTURES.ROCK ? '🤟 Pause' :
             handTracked ? '✋ Hand Ready' : '🔍 Detect Hand'}
          </span>
        </div>

        {/* High Score Card - Compact single-line row */}
        <div className="bg-cyan-400 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg pointer-events-auto flex items-center gap-1 sm:gap-1.5">
          <span className="text-[9px] sm:text-[11px] font-mono font-black uppercase tracking-wider text-black">Best</span>
          <span className="text-xs sm:text-base font-mono font-black text-black leading-none">{highScore}</span>
        </div>
      </header>

      {/* Bottom Controls - Streamlined for clear mobile view */}
      {gameState === 'PLAYING' && (
        <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 z-10 flex justify-between items-end pointer-events-none">
          <div className="flex gap-1.5 sm:gap-2 pointer-events-auto">
            <button
              onClick={() => setGameState('PAUSED')}
              className="bg-rose-400 hover:bg-rose-500 border-2 sm:border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-mono font-black uppercase text-black cursor-pointer"
            >
              ⏸ Pause
            </button>
            <button
              onClick={() => {
                audio.enabled = !audio.enabled;
                setIsMuted(!audio.enabled);
              }}
              className="bg-white hover:bg-yellow-300 border-2 sm:border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-sm sm:text-base cursor-pointer"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>

          {/* Active Powerups Indicators */}
          {activePowerup && (
            <div className="bg-purple-500 text-white border-2 sm:border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-mono font-black text-xs sm:text-sm animate-bounce pointer-events-none">
              ⚡ {activePowerup}: {powerupTimeLeft}s
            </div>
          )}

          {/* Ammo Selector */}
          <div className="flex gap-1 bg-white border-2 sm:border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-1 rounded-lg sm:rounded-xl pointer-events-auto">
            {PROJECTILES.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectile(p)}
                className={`w-7 h-7 sm:w-9 sm:h-9 rounded-md sm:rounded-lg border-2 border-black flex items-center justify-center transition-all cursor-pointer ${selectedProjectile.id === p.id ? 'scale-105 shadow-neo-xs ring-2 ring-black' : 'bg-gray-100 hover:bg-gray-200'}`}
                style={{ backgroundColor: selectedProjectile.id === p.id ? p.color : '' }}
                title={p.name}
              >
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border border-black shadow-xs" style={{ backgroundColor: p.color }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Menu Modal */}
      {gameState === 'MENU' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-40 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-yellow-400 border-4 sm:border-8 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rounded-2xl sm:rounded-3xl p-3 sm:p-6 max-w-lg w-full text-center flex flex-col items-center gap-2 sm:gap-3.5 max-h-[94vh] overflow-y-auto my-auto">
            <h1 className="text-2xl sm:text-5xl font-black uppercase text-black drop-shadow-[2px_2px_0px_#fff] sm:drop-shadow-[3px_3px_0px_#fff] -rotate-1">
              BIRD HUNTER
            </h1>
            <h2 className="text-xs sm:text-base font-black uppercase text-black bg-white px-2.5 py-0.5 sm:px-3 sm:py-1 border-2 sm:border-3 border-black inline-block">
              Slingshot Precision Challenge
            </h2>

            <p className="text-[11px] sm:text-sm font-bold max-w-md text-zinc-900 leading-snug sm:leading-relaxed">
              Pull back the slingshot with hand pinch gestures or mouse. Strike birds along chaotic flight paths and avoid letting 3 birds escape in a row!
            </p>

            {/* Gesture Guide Table */}
            <div className="w-full text-left bg-white border-2 sm:border-3 border-black p-2 sm:p-3 rounded-xl text-xs">
              <p className="font-display font-black text-xs sm:text-sm mb-1 sm:mb-1.5 uppercase text-black">🎯 Hand Gesture Controls:</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px] sm:text-[11px] font-bold">
                <div className="flex items-center gap-1.5"><span className="text-sm">🤏</span> <span>Pinch:</span></div>
                <div className="text-zinc-800">Grab pouch & stretch band</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">✋</span> <span>Move Hand:</span></div>
                <div className="text-zinc-800">Aim trajectory arc</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">🏹</span> <span>Release:</span></div>
                <div className="text-emerald-700">Launch projectile!</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">✊</span> <span>Fist:</span></div>
                <div className="text-rose-700">Cancel shot</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">🤟</span> <span>Rock Sign:</span></div>
                <div className="text-amber-700">Pause / Resume</div>
              </div>
            </div>

            {/* Ammo Selector */}
            <div className="w-full">
              <h3 className="text-[10px] sm:text-xs font-black mb-1 uppercase tracking-wider text-black">Select Ammo Type:</h3>
              <div className="flex justify-center gap-1.5 sm:gap-2 flex-wrap">
                {PROJECTILES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectile(p)}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border-2 border-black font-bold text-[10px] sm:text-xs flex items-center gap-1.5 transition-all ${selectedProjectile.id === p.id ? 'bg-black text-white shadow-neo-sm scale-105' : 'bg-white text-black'}`}
                  >
                    <div className="w-3 h-3 rounded-full border border-black" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startGame}
              className="w-full bg-green-400 hover:bg-green-500 text-black border-3 sm:border-4 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl tracking-wide uppercase transition-all mt-1"
            >
              START CHALLENGE
            </button>
          </div>
        </div>
      )}

      {/* Pause Menu Modal */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-40 p-4">
          <div className="bg-sky-300 border-8 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rounded-3xl p-6 text-center flex flex-col items-center gap-4 max-w-sm w-full">
            <h2 className="text-4xl font-black uppercase text-black">Game Paused</h2>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => setGameState('PLAYING')}
                className="w-full bg-green-400 hover:bg-green-500 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none py-3 rounded-xl font-black text-lg uppercase"
              >
                ▶ Resume
              </button>
              <button
                onClick={startGame}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none py-3 rounded-xl font-black text-lg uppercase"
              >
                ↺ Restart
              </button>
              <button
                onClick={() => setGameState('MENU')}
                className="w-full bg-white hover:bg-gray-100 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none py-3 rounded-xl font-black text-lg uppercase"
              >
                ☰ Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-40 p-4">
          <div className="bg-white border-8 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center flex flex-col items-center gap-4">
            <h2 className="text-4xl font-black uppercase text-red-600 tracking-tight">
              GAME OVER
            </h2>

            <div className="bg-red-400 border-4 border-black p-4 rounded-xl text-white w-full">
              <span className="block font-black text-xs uppercase tracking-widest text-red-100 mb-1">
                {consecutiveMisses >= 3 ? '❌ 3 BIRDS ESCAPED IN A ROW!' : 'CHALLENGE COMPLETE'}
              </span>
              <span className="block font-black text-xs text-red-100 uppercase">FINAL SCORE</span>
              <span className="text-4xl font-black">{score}</span>
            </div>

            <PostGameProgression result={lastProgressionResult} />

            {/* Dedicated Game Over Ad Slot */}
            <div className="w-full my-3 flex justify-center">
              <AdSlot placement="game-over" format="banner" className="max-w-[280px] sm:max-w-[340px]" />
            </div>

            <button
              onClick={startGame}
              className="w-full bg-green-400 hover:bg-green-500 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none py-3.5 rounded-xl font-black text-xl uppercase"
            >
              ↺ PLAY AGAIN
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-white hover:bg-gray-100 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none py-3 rounded-xl font-black text-sm uppercase"
            >
              ← BACK TO HOME
            </button>
          </div>
        </div>
      )}
    </div>
  );
}