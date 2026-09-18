import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHandTracking } from "../hooks/useHandTracking";
import { GESTURES } from "../utils/gestureDetector";
import { usePlayer } from "../hooks/usePlayer";
import PostGameProgression from "../components/PostGameProgression";
import InGameGestureGuide from "../components/InGameGestureGuide";
import AdSlot from "../components/ads/AdSlot";

/**
 * SpaceShooter.jsx
 * ------------------------------------------------------------------
 * Top-down arcade space shooter built for Gesture Studio.
 * Controlled via MediaPipe hand gestures or keyboard / touch.
 */

const GAME_ID = "space-shooter";
const HIGH_SCORE_KEY = "spaceShooterHighScore";
const SOUND_PREF_KEY = "spaceShooterSoundOn";

// ------------------------------------------------------------------
// Neo-brutalist palette (matches Gesture Studio's UI language)
// ------------------------------------------------------------------
const COLORS = {
  ink: "#111111",
  paper: "#F5F0E6",
  yellow: "#FFE142",
  lavender: "#C9B6FF",
  pink: "#FF6FB5",
  green: "#7CFF6B",
  blue: "#5AC8FA",
  orange: "#FF9F43",
  red: "#FF3B30",
  crimson: "#DC2626",
  darkRed: "#991B1B",
};

// ------------------------------------------------------------------
// Small math / helpers
// ------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
const circleHit = (a, b) => dist2(a.x, a.y, b.x, b.y) <= (a.r + b.r) ** 2;
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};
const fmtScore = (n) => n.toLocaleString("en-US");

// ------------------------------------------------------------------
// Playable combat corridor - confines enemies, bosses & items to the active range
// ------------------------------------------------------------------
const getCombatBounds = (w) => {
  if (w > 760) {
    const margin = Math.max(140, Math.floor(w * 0.20));
    return { minX: margin, maxX: w - margin };
  }
  const margin = Math.max(16, Math.floor(w * 0.06));
  return { minX: margin, maxX: w - margin };
};

// ------------------------------------------------------------------
// Enemy type definitions - all red spaceship armada with distinct specs
// ------------------------------------------------------------------
const ENEMY_TYPES = {
  drone: {
    key: "drone",
    r: 16,
    baseHp: 1,
    baseSpeed: 60,
    score: 10,
    color: "#FF3B30",
    patterns: ["straight", "zigzag"],
  },
  scout: {
    key: "scout",
    r: 13,
    baseHp: 1,
    baseSpeed: 140,
    score: 20,
    color: "#FF4D4D",
    patterns: ["chase", "dive"],
  },
  tank: {
    key: "tank",
    r: 30,
    baseHp: 8,
    baseSpeed: 32,
    score: 50,
    color: "#991B1B",
    patterns: ["straight"],
  },
  shooter: {
    key: "shooter",
    r: 19,
    baseHp: 3,
    baseSpeed: 45,
    score: 35,
    color: "#E11D48",
    patterns: ["shooter"],
    fires: true,
  },
  swarm: {
    key: "swarm",
    r: 10,
    baseHp: 1,
    baseSpeed: 100,
    score: 8,
    color: "#FF2A2A",
    patterns: ["swarm"],
  },
  elite: {
    key: "elite",
    r: 24,
    baseHp: 6,
    baseSpeed: 90,
    score: 100,
    color: "#DC2626",
    patterns: ["orbit", "chase"],
    fires: true,
  },
};

// ------------------------------------------------------------------
// Power-up type definitions
// Every power-up lasts up to 30s only
// ------------------------------------------------------------------
const POWERUP_TYPES = {
  rapid: { key: "rapid", label: "RAPID FIRE", icon: "⚡", color: COLORS.yellow, duration: 30000 },
  multi: { key: "multi", label: "MULTI SHOT", icon: "💥", color: COLORS.pink, duration: 30000 },
  shield: { key: "shield", label: "SHIELD", icon: "🛡️", color: COLORS.blue, duration: 30000 },
  life: { key: "life", label: "EXTRA LIFE", icon: "❤️", color: COLORS.green, duration: 0 },
  bomb: { key: "bomb", label: "SPACE BOMB", icon: "💣", color: COLORS.orange, duration: 0 },
  plasma: { key: "plasma", label: "PLASMA", icon: "🔵", color: COLORS.lavender, duration: 30000 },
};

export default function SpaceShooter({ gesturePosition = null, onGameComplete = null, className = "" }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const handOverlayRef = useRef(null);

  const { recordGameResult, allGameStats } = usePlayer();
  const [lastProgressionResult, setLastProgressionResult] = useState(null);
  const sessionRecordedRef = useRef(false);

  // ---- React (UI-facing) state -----------------------------------
  const [gameState, setGameState] = useState("start"); // start | playing | paused | gameover
  const gameStateRef = useRef("start");
  const [controlMode, setControlMode] = useState("gesture"); // gesture | touch | keyboard
  const [soundOn, setSoundOn] = useState(true);
  const [currentGesture, setCurrentGesture] = useState(GESTURES.NONE);
  const [handTracked, setHandTracked] = useState(false);
  const lastPinchRef = useRef(0);
  const lastRockRef = useRef(0);

  const [hud, setHud] = useState({
    score: 0,
    highScore: 0,
    wave: 1,
    lives: 3,
    combo: 0,
    powerUps: [],
    bossActive: false,
    bossHpPct: 1,
  });
  const [waveAnnounce, setWaveAnnounce] = useState(null); // { text }
  const [bossWarning, setBossWarning] = useState(false);
  const [finalStats, setFinalStats] = useState(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  // ---- Mutable game-object refs (NO react state per frame) -------
  const dims = useRef({ w: 360, h: 640, dpr: 1 });
  const rafRef = useRef(null);
  const lastTsRef = useRef(0);

  const playerRef = useRef({ x: 180, y: 560, r: 16, invulnUntil: 0, shieldHits: 0 });
  const targetRef = useRef({ x: 180, y: 560 });
  const keysRef = useRef({ left: false, right: false, up: false, down: false });
  const pointerRef = useRef({ active: false, x: 180, y: 560 });

  const enemiesRef = useRef([]);
  const projectilesRef = useRef([]);
  const enemyProjectilesRef = useRef([]);
  const powerUpsRef = useRef([]);
  const particlesRef = useRef([]);
  const asteroidsRef = useRef([]);
  const starsRef = useRef([]);
  const bossRef = useRef(null);

  const weaponRef = useRef({ level: 1, lastFire: 0 });
  const effectsRef = useRef({
    rapidUntil: 0,
    multiUntil: 0,
    plasmaUntil: 0,
    shieldUntil: 0,
  });
  const comboRef = useRef({ count: 0, mult: 1, lastKillAt: 0 });
  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);
  const livesRef = useRef(3);
  const waveRef = useRef(1);
  const waveProgressRef = useRef({ spawned: 0, target: 8, timer: 0 });
  const difficultyRef = useRef({ spawnInterval: 1200, speedMult: 1, hpMult: 1, eliteChance: 0.06 });
  const survivalStartRef = useRef(0);
  const survivalTimeRef = useRef(0);
  const enemiesDestroyedRef = useRef(0);
  const maxComboRef = useRef(0);
  const screenShakeRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const asteroidTimerRef = useRef(0);
  const bossPendingRef = useRef(false);
  const idCounter = useRef(1);
  const nextId = () => idCounter.current++;

  const audioCtxRef = useRef(null);
  const soundOnRef = useRef(true);
  const gestureRef = useRef(gesturePosition || { x: 0.5, y: 0.85, active: false });

  // Sync gameStateRef
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Sync high score from Firestore allGameStats across all devices/origins
  useEffect(() => {
    const firestoreBest = allGameStats?.['space-shooter']?.bestScore || 0;
    if (firestoreBest > 0) {
      if (firestoreBest > highScoreRef.current) {
        highScoreRef.current = firestoreBest;
        setHud((h) => ({ ...h, highScore: firestoreBest }));
        try {
          localStorage.setItem(HIGH_SCORE_KEY, String(firestoreBest));
        } catch {}
      }
    }
  }, [allGameStats]);

  // Setup: load persisted prefs
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || "0", 10);
      if (!Number.isNaN(saved) && saved > highScoreRef.current) {
        highScoreRef.current = saved;
        setHud((h) => ({ ...h, highScore: saved }));
      }
      const soundPref = localStorage.getItem(SOUND_PREF_KEY);
      if (soundPref !== null) {
        const on = soundPref === "true";
        soundOnRef.current = on;
        setSoundOn(on);
      }
    } catch {
      /* localStorage unavailable - ignore */
    }
  }, []);

  // ==================================================================
  // Canvas sizing (responsive, devicePixelRatio-aware)
  // ==================================================================
  useEffect(() => {
    const resize = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.max(360, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dims.current = { w, h, dpr };
      if (playerRef.current.x === 180 && playerRef.current.y === 560) {
        playerRef.current.x = w / 2;
        playerRef.current.y = h - 90;
        targetRef.current.x = w / 2;
        targetRef.current.y = h - 90;
      }
      if (starsRef.current.length === 0) {
        starsRef.current = createStars(w, h);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ==================================================================
  // Keyboard controls
  // ==================================================================
  useEffect(() => {
    const onDown = (e) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = true;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = true;
      if (["ArrowUp", "w", "W"].includes(e.key)) keysRef.current.up = true;
      if (["ArrowDown", "s", "S"].includes(e.key)) keysRef.current.down = true;
      if (e.key === "Escape") {
        setGameState((g) => (g === "playing" ? "paused" : g === "paused" ? "playing" : g));
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
    };
    const onUp = (e) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = false;
      if (["ArrowUp", "w", "W"].includes(e.key)) keysRef.current.up = false;
      if (["ArrowDown", "s", "S"].includes(e.key)) keysRef.current.down = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // ==================================================================
  // Touch / pointer drag controls
  // ==================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const toLocal = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const onPointerDown = (e) => {
      pointerRef.current.active = true;
      const p = toLocal(e.clientX, e.clientY);
      pointerRef.current.x = p.x;
      pointerRef.current.y = p.y;
    };
    const onPointerMove = (e) => {
      if (!pointerRef.current.active) return;
      const p = toLocal(e.clientX, e.clientY);
      pointerRef.current.x = p.x;
      pointerRef.current.y = p.y;
    };
    const onPointerUp = () => {
      pointerRef.current.active = false;
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  // ==================================================================
  // Sound (Web Audio API - synthesized, no external files)
  // ==================================================================
  const ensureAudio = () => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtxRef.current = new AC();
    }
    return audioCtxRef.current;
  };

  const playTone = useCallback((freq, dur, type = "square", gain = 0.06, glideTo = null) => {
    if (!soundOnRef.current) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }, []);

  const sfx = {
    laser: () => playTone(720, 0.08, "square", 0.04, 420),
    hit: () => playTone(220, 0.07, "square", 0.05, 120),
    destroy: () => playTone(180, 0.18, "sawtooth", 0.06, 40),
    powerUp: () => playTone(500, 0.18, "triangle", 0.06, 900),
    bossWarn: () => playTone(110, 0.4, "sawtooth", 0.08, 90),
    bossDown: () => playTone(80, 0.6, "sawtooth", 0.09, 400),
    playerHit: () => playTone(140, 0.25, "sawtooth", 0.09, 60),
    gameOver: () => playTone(200, 0.6, "sawtooth", 0.08, 50),
    highScore: () => playTone(660, 0.35, "triangle", 0.07, 1200),
  };

  const toggleSound = () => {
    const next = !soundOnRef.current;
    soundOnRef.current = next;
    setSoundOn(next);
    try {
      localStorage.setItem(SOUND_PREF_KEY, String(next));
    } catch (e) {}
  };

  // ==================================================================
  // World factories
  // ==================================================================
  function createStars(w, h) {
    const stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(0.5, 2.2),
        speed: rand(20, 90),
        tw: rand(0, Math.PI * 2),
      });
    }
    return stars;
  }

  function resetGameObjects() {
    const { w, h } = dims.current;
    playerRef.current = { x: w / 2, y: h - 90, r: 16, invulnUntil: 0, shieldHits: 0 };
    targetRef.current = { x: w / 2, y: h - 90 };
    enemiesRef.current = [];
    projectilesRef.current = [];
    enemyProjectilesRef.current = [];
    powerUpsRef.current = [];
    particlesRef.current = [];
    asteroidsRef.current = [];
    bossRef.current = null;
    weaponRef.current = { level: 1, lastFire: 0 };
    effectsRef.current = {
      rapidUntil: 0,
      multiUntil: 0,
      plasmaUntil: 0,
      shieldUntil: 0,
    };
    comboRef.current = { count: 0, mult: 1, lastKillAt: 0 };
    scoreRef.current = 0;
    livesRef.current = 3;
    waveRef.current = 1;
    waveProgressRef.current = { spawned: 0, target: 8, timer: 0 };
    difficultyRef.current = { spawnInterval: 1200, speedMult: 1, hpMult: 1, eliteChance: 0.06 };
    survivalStartRef.current = performance.now();
    survivalTimeRef.current = 0;
    enemiesDestroyedRef.current = 0;
    maxComboRef.current = 0;
    screenShakeRef.current = 0;
    spawnTimerRef.current = 0;
    asteroidTimerRef.current = 0;
    bossPendingRef.current = false;
    setBossWarning(false);
    setWaveAnnounce({ text: "WAVE 01" });
    setTimeout(() => setWaveAnnounce(null), 1400);

    // Initial friendly upgrade drop to ease early gameplay
    setTimeout(() => {
      if (gameStateRef.current === "playing") {
        const { minX, maxX } = getCombatBounds(dims.current.w);
        spawnPowerUp((minX + maxX) / 2, -20, "rapid");
      }
    }, 1500);

    syncHud();
  }

  function syncHud() {
    setHud({
      score: scoreRef.current,
      highScore: highScoreRef.current,
      wave: waveRef.current,
      lives: livesRef.current,
      combo: comboRef.current.count,
      powerUps: activePowerUpList(),
      bossActive: !!bossRef.current,
      bossHpPct: bossRef.current ? clamp(bossRef.current.hp / bossRef.current.maxHp, 0, 1) : 1,
    });
  }

  function activePowerUpList() {
    const now = performance.now();
    const list = [];
    if (effectsRef.current.rapidUntil > now) {
      const remainingSecs = Math.max(0, (effectsRef.current.rapidUntil - now) / 1000);
      list.push({ key: "rapid", label: "RAPID FIRE", secs: remainingSecs });
    }
    if (effectsRef.current.multiUntil > now) {
      const remainingSecs = Math.max(0, (effectsRef.current.multiUntil - now) / 1000);
      list.push({ key: "multi", label: "MULTI SHOT", secs: remainingSecs });
    }
    if (effectsRef.current.plasmaUntil > now) {
      const remainingSecs = Math.max(0, (effectsRef.current.plasmaUntil - now) / 1000);
      list.push({ key: "plasma", label: "PLASMA", secs: remainingSecs });
    }
    if (effectsRef.current.shieldUntil > now) {
      const remainingSecs = Math.max(0, (effectsRef.current.shieldUntil - now) / 1000);
      list.push({ key: "shield", label: "SHIELD", secs: remainingSecs });
    } else if (playerRef.current.shieldHits > 0) {
      list.push({ key: "shield", label: "SHIELD", hits: playerRef.current.shieldHits });
    }
    return list;
  }

  // ==================================================================
  // Enemy / asteroid / powerup / particle spawners
  // All spawns are strictly confined to the playable combat corridor
  // ==================================================================
  function spawnEnemy(forceType = null) {
    const { w } = dims.current;
    const diff = difficultyRef.current;
    let key = forceType;
    if (!key) {
      const roll = Math.random();
      if (roll < diff.eliteChance) key = "elite";
      else key = choice(["drone", "scout", "tank", "shooter", "swarm"]);
    }
    const def = ENEMY_TYPES[key];
    const { minX, maxX } = getCombatBounds(w);
    // Strictly spawn within the visible, reachable combat range
    const x = rand(minX + def.r + 8, maxX - def.r - 8);
    const y = -def.r - 10;
    const pattern = choice(def.patterns);
    enemiesRef.current.push({
      id: nextId(),
      type: key,
      x,
      y,
      r: def.r,
      hp: Math.ceil(def.baseHp * diff.hpMult),
      maxHp: Math.ceil(def.baseHp * diff.hpMult),
      speed: def.baseSpeed * diff.speedMult,
      color: def.color,
      score: def.score,
      pattern,
      phase: rand(0, Math.PI * 2),
      spawnedAt: performance.now(),
      lastFire: performance.now() + rand(0, 800),
      fires: !!def.fires,
      orbitAngle: rand(0, Math.PI * 2),
      orbitR: rand(50, 110),
    });
    waveProgressRef.current.spawned++;
  }

  function spawnSwarmGroup() {
    const { w } = dims.current;
    const { minX, maxX } = getCombatBounds(w);
    const groupX = rand(minX + 40, maxX - 40);
    for (let i = 0; i < 4; i++) {
      const def = ENEMY_TYPES.swarm;
      enemiesRef.current.push({
        id: nextId(),
        type: "swarm",
        x: groupX + rand(-20, 20),
        y: -20 - i * 22,
        r: def.r,
        hp: Math.ceil(def.baseHp * difficultyRef.current.hpMult),
        maxHp: Math.ceil(def.baseHp * difficultyRef.current.hpMult),
        speed: def.baseSpeed * difficultyRef.current.speedMult,
        color: def.color,
        score: def.score,
        pattern: "swarm",
        phase: rand(0, Math.PI * 2),
        groupX,
        spawnedAt: performance.now(),
        lastFire: 0,
        fires: false,
      });
    }
    waveProgressRef.current.spawned += 4;
  }

  function spawnAsteroid() {
    const { w } = dims.current;
    const { minX, maxX } = getCombatBounds(w);
    const r = rand(14, 28);
    asteroidsRef.current.push({
      id: nextId(),
      x: rand(minX + r, maxX - r),
      y: -r - 10,
      r,
      hp: Math.ceil(r / 8),
      rot: rand(0, Math.PI * 2),
      rotSpeed: rand(-1, 1),
      vy: rand(35, 70),
      vx: rand(-10, 10),
      points: makeAsteroidShape(r),
      score: 5,
    });
  }

  function makeAsteroidShape(r) {
    const pts = [];
    const n = randInt(7, 10);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * rand(0.7, 1.05);
      pts.push({ a, r: rr });
    }
    return pts;
  }

  function spawnPowerUp(x, y, forceKey = null) {
    const { w } = dims.current;
    const { minX, maxX } = getCombatBounds(w);
    const clampedX = clamp(x, minX + 24, maxX - 24);
    const key = forceKey || choice(Object.keys(POWERUP_TYPES));
    powerUpsRef.current.push({
      id: nextId(),
      key,
      x: clampedX,
      y,
      r: 14,
      vy: 55,
      phase: rand(0, Math.PI * 2),
    });
  }

  function spawnParticles(x, y, color, count = 10, speed = 120) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.3, speed);
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.3, 0.7),
        maxLife: 0.7,
        r: rand(1.5, 3.5),
        color,
      });
    }
    if (particlesRef.current.length > 240) {
      particlesRef.current.splice(0, particlesRef.current.length - 240);
    }
  }

  // ==================================================================
  // Weapons
  // ==================================================================
  function fireWeapon() {
    const p = playerRef.current;
    const now = performance.now();
    // Each power-up lasts up to 30s
    const rapid = effectsRef.current.rapidUntil > now;
    const multi = effectsRef.current.multiUntil > now;
    const plasma = effectsRef.current.plasmaUntil > now;
    const baseLevel = 1 + Math.min(4, Math.floor(scoreRef.current / 800));
    const level = (rapid || multi || plasma) ? Math.max(weaponRef.current.level, 3) : Math.max(weaponRef.current.level, baseLevel);

    const interval = rapid ? 110 : level >= 4 ? 200 : level >= 2 ? 240 : 280;
    if (now - weaponRef.current.lastFire < interval) return;
    weaponRef.current.lastFire = now;

    const dmg = plasma ? 3 : 1;
    const color = plasma ? COLORS.lavender : COLORS.blue;
    const speed = 560;

    const lanes = [];
    if (level === 1) lanes.push(0);
    else if (level === 2) lanes.push(-8, 8);
    else if (level === 3) lanes.push(-12, 0, 12);
    else if (level >= 4) lanes.push(-18, -6, 6, 18);

    if (multi) lanes.push(-26, 26);

    for (const off of lanes) {
      const spread = (level >= 4 || multi) ? off * 0.02 : 0;
      projectilesRef.current.push({
        id: nextId(),
        x: p.x + off,
        y: p.y - 20,
        vx: speed * spread,
        vy: -speed,
        r: plasma ? 5.5 : 3.5,
        dmg,
        color,
        trail: [],
      });
    }
    sfx.laser();
  }

  function fireEnemyShot(enemy) {
    const p = playerRef.current;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 220;
    enemyProjectilesRef.current.push({
      id: nextId(),
      x: enemy.x,
      y: enemy.y,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      r: 4.5,
      color: "#FF3B30",
    });
  }

  // ==================================================================
  // Boss
  // ==================================================================
  function spawnBoss() {
    const { w } = dims.current;
    const { minX, maxX } = getCombatBounds(w);
    const hp = 50 + waveRef.current * 10;
    bossRef.current = {
      x: (minX + maxX) / 2,
      y: -80,
      r: 46,
      hp,
      maxHp: hp,
      phase: 1,
      entering: true,
      dir: 1,
      lastFire: performance.now(),
      spawnedAt: performance.now(),
    };
  }

  function updateBoss(dt, now) {
    const boss = bossRef.current;
    if (!boss) return;
    const { w } = dims.current;
    const { minX, maxX } = getCombatBounds(w);

    if (boss.entering) {
      boss.y = lerp(boss.y, 110, 1 - Math.pow(0.001, dt));
      if (boss.y > 100) boss.entering = false;
      return;
    }

    // Phase transitions based on remaining HP
    const pct = boss.hp / boss.maxHp;
    boss.phase = pct > 0.66 ? 1 : pct > 0.33 ? 2 : 3;

    const speed = boss.phase === 1 ? 55 : boss.phase === 2 ? 80 : 110;
    boss.x += boss.dir * speed * dt;
    if (boss.x < minX + boss.r + 10) {
      boss.dir = 1;
      boss.x = minX + boss.r + 10;
    } else if (boss.x > maxX - boss.r - 10) {
      boss.dir = -1;
      boss.x = maxX - boss.r - 10;
    }

    const fireInterval = boss.phase === 1 ? 900 : boss.phase === 2 ? 550 : 350;
    if (now - boss.lastFire > fireInterval) {
      boss.lastFire = now;
      if (boss.phase === 1) {
        fireEnemyShot(boss);
      } else if (boss.phase === 2) {
        for (const off of [-0.35, 0, 0.35]) {
          const p = playerRef.current;
          const dx = p.x - boss.x;
          const dy = p.y - boss.y;
          const base = Math.atan2(dy, dx) + off;
          enemyProjectilesRef.current.push({
            id: nextId(),
            x: boss.x,
            y: boss.y,
            vx: Math.cos(base) * 210,
            vy: Math.sin(base) * 210,
            r: 5,
            color: COLORS.pink,
          });
        }
      } else {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          enemyProjectilesRef.current.push({
            id: nextId(),
            x: boss.x,
            y: boss.y,
            vx: Math.cos(a) * 180,
            vy: Math.sin(a) * 180,
            r: 5,
            color: COLORS.orange,
          });
        }
      }
    }
  }

  // ==================================================================
  // Combat resolution helpers
  // ==================================================================
  function addScore(base) {
    const mult = comboRef.current.mult;
    scoreRef.current += Math.round(base * mult);
  }

  function registerKill(x, y, color, scoreVal) {
    enemiesDestroyedRef.current++;
    spawnParticles(x, y, color, 14, 160);
    sfx.destroy();
    const now = performance.now();
    comboRef.current.count++;
    comboRef.current.lastKillAt = now;
    comboRef.current.mult = 1 + Math.min(4, Math.floor(comboRef.current.count / 5)) * 0.5;
    maxComboRef.current = Math.max(maxComboRef.current, comboRef.current.count);
    addScore(scoreVal);
    if (Math.random() < 0.22) spawnPowerUp(x, y);
  }

  function damagePlayer(amount = 1) {
    const p = playerRef.current;
    const now = performance.now();
    if (now < p.invulnUntil) return;

    // 60-second shield protects player completely while active
    if (effectsRef.current.shieldUntil > now) {
      p.invulnUntil = now + 700;
      spawnParticles(p.x, p.y, COLORS.blue, 14, 150);
      sfx.hit();
      return;
    }

    if (p.shieldHits > 0) {
      p.shieldHits--;
      p.invulnUntil = now + 600;
      spawnParticles(p.x, p.y, COLORS.blue, 10, 120);
      return;
    }
    livesRef.current -= amount;
    p.invulnUntil = now + 1500;
    screenShakeRef.current = 14;
    spawnParticles(p.x, p.y, COLORS.pink, 18, 180);
    sfx.playerHit();
    comboRef.current.count = 0;
    comboRef.current.mult = 1;
    if (livesRef.current <= 0) {
      endGame();
    }
    syncHud();
  }

  // ==================================================================
  // Difficulty / wave manager
  // ==================================================================
  function updateDifficulty() {
    const wave = waveRef.current;
    const d = difficultyRef.current;
    d.spawnInterval = clamp(1150 - wave * 35, 320, 1150);
    d.speedMult = clamp(1 + wave * 0.045, 1, 2.4);
    d.hpMult = clamp(1 + wave * 0.09, 1, 4.5);
    d.eliteChance = clamp(0.05 + wave * 0.008, 0.05, 0.35);
  }

  function advanceWave() {
    waveRef.current++;
    updateDifficulty();
    waveProgressRef.current = { spawned: 0, target: 8 + waveRef.current * 2, timer: 0 };

    if (waveRef.current % 5 === 0) {
      bossPendingRef.current = true;
      setBossWarning(true);
      sfx.bossWarn();
      setTimeout(() => {
        setBossWarning(false);
        spawnBoss();
        bossPendingRef.current = false;
      }, 1800);
    } else {
      setWaveAnnounce({ text: `WAVE ${String(waveRef.current).padStart(2, "0")}` });
      setTimeout(() => setWaveAnnounce(null), 1300);
    }
  }

  // ==================================================================
  // Main update loop
  // ==================================================================
  function update(dt, now) {
    const { w, h } = dims.current;
    const p = playerRef.current;

    // ---- Determine control mode & target position ----
    const gp = gestureRef.current;
    let mode = "keyboard";
    if (gp && gp.active) {
      mode = "gesture";
      targetRef.current.x = clamp(gp.x * w, p.r, w - p.r);
      targetRef.current.y = clamp(gp.y * h, p.r, h - p.r);
    } else if (pointerRef.current.active) {
      mode = "touch";
      targetRef.current.x = clamp(pointerRef.current.x, p.r, w - p.r);
      targetRef.current.y = clamp(pointerRef.current.y, p.r, h - p.r);
    } else {
      const speed = 320 * dt;
      const k = keysRef.current;
      if (k.left) targetRef.current.x -= speed;
      if (k.right) targetRef.current.x += speed;
      if (k.up) targetRef.current.y -= speed;
      if (k.down) targetRef.current.y += speed;
      targetRef.current.x = clamp(targetRef.current.x, p.r, w - p.r);
      targetRef.current.y = clamp(targetRef.current.y, p.r, h - p.r);
    }
    setControlMode((prev) => (prev === mode ? prev : mode));

    const smoothing = mode === "gesture" ? 1 - Math.pow(0.0015, dt) : mode === "touch" ? 1 - Math.pow(0.02, dt) : 1 - Math.pow(0.06, dt);
    p.x = lerp(p.x, targetRef.current.x, clamp(smoothing, 0, 1));
    p.y = lerp(p.y, targetRef.current.y, clamp(smoothing, 0, 1));
    p.x = clamp(p.x, p.r, w - p.r);
    p.y = clamp(p.y, p.r, h - p.r);

    // ---- Auto fire ----
    fireWeapon();

    // ---- Stars ----
    for (const s of starsRef.current) {
      s.y += s.speed * dt;
      if (s.y > h) {
        s.y = -2;
        s.x = rand(0, w);
      }
    }

    // ---- Spawn manager ----
    if (!bossRef.current && !bossPendingRef.current) {
      spawnTimerRef.current += dt * 1000;
      if (spawnTimerRef.current > difficultyRef.current.spawnInterval) {
        spawnTimerRef.current = 0;
        if (Math.random() < 0.16) spawnSwarmGroup();
        else spawnEnemy();
      }
      asteroidTimerRef.current += dt * 1000;
      if (asteroidTimerRef.current > 2600) {
        asteroidTimerRef.current = 0;
        if (Math.random() < 0.6) spawnAsteroid();
      }
      if (waveProgressRef.current.spawned >= waveProgressRef.current.target) {
        advanceWave();
      }
    }

    // ---- Projectiles (player) ----
    const projs = projectilesRef.current;
    for (let i = projs.length - 1; i >= 0; i--) {
      const pr = projs[i];
      pr.trail.push({ x: pr.x, y: pr.y });
      if (pr.trail.length > 5) pr.trail.shift();
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.y < -20 || pr.x < -20 || pr.x > w + 20) {
        projs.splice(i, 1);
      }
    }

    // ---- Enemy projectiles ----
    const eprojs = enemyProjectilesRef.current;
    for (let i = eprojs.length - 1; i >= 0; i--) {
      const pr = eprojs[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.y > h + 30 || pr.y < -30 || pr.x < -30 || pr.x > w + 30) {
        eprojs.splice(i, 1);
        continue;
      }
      if (circleHit(pr, p)) {
        eprojs.splice(i, 1);
        damagePlayer(1);
      }
    }

    // ---- Enemies: movement ----
    const enemies = enemiesRef.current;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      moveEnemy(e, p, dt, now);
      if (e.fires && now - e.lastFire > 1700) {
        e.lastFire = now;
        fireEnemyShot(e);
      }
      if (e.y > h + 60 || e.x < -60 || e.x > w + 60) {
        enemies.splice(i, 1);
        continue;
      }
      if (circleHit(e, p)) {
        enemies.splice(i, 1);
        spawnParticles(e.x, e.y, e.color, 10, 140);
        damagePlayer(1);
        continue;
      }
    }

    // ---- Boss ----
    if (bossRef.current) {
      updateBoss(dt, now);
      const b = bossRef.current;
      if (!b.entering && circleHit(b, p)) {
        damagePlayer(1);
      }
    }

    // ---- Asteroids ----
    const asteroids = asteroidsRef.current;
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.rotSpeed * dt;
      if (a.y > h + 60) {
        asteroids.splice(i, 1);
        continue;
      }
      if (circleHit(a, p)) {
        asteroids.splice(i, 1);
        spawnParticles(a.x, a.y, COLORS.orange, 10, 130);
        damagePlayer(1);
        continue;
      }
    }

    // ---- Power-ups ----
    const pups = powerUpsRef.current;
    for (let i = pups.length - 1; i >= 0; i--) {
      const pu = pups[i];
      pu.y += pu.vy * dt;
      pu.phase += dt * 4;
      if (pu.y > h + 30) {
        pups.splice(i, 1);
        continue;
      }
      if (circleHit(pu, p)) {
        pups.splice(i, 1);
        applyPowerUp(pu.key);
        continue;
      }
    }

    // ---- Particles ----
    const parts = particlesRef.current;
    for (let i = parts.length - 1; i >= 0; i--) {
      const pt = parts[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      pt.life -= dt;
      if (pt.life <= 0) parts.splice(i, 1);
    }

    // ---- Collisions: player projectiles vs enemies/asteroids/boss ----
    for (let i = projs.length - 1; i >= 0; i--) {
      const pr = projs[i];
      let consumed = false;

      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (circleHit(pr, e)) {
          e.hp -= pr.dmg;
          spawnParticles(pr.x, pr.y, e.color, 4, 80);
          sfx.hit();
          consumed = true;
          if (e.hp <= 0) {
            enemies.splice(j, 1);
            registerKill(e.x, e.y, e.color, e.score);
          }
          break;
        }
      }

      if (!consumed) {
        for (let j = asteroids.length - 1; j >= 0; j--) {
          const a = asteroids[j];
          if (circleHit(pr, a)) {
            a.hp -= pr.dmg;
            spawnParticles(pr.x, pr.y, COLORS.orange, 4, 70);
            consumed = true;
            if (a.hp <= 0) {
              asteroids.splice(j, 1);
              registerKill(a.x, a.y, COLORS.orange, a.score);
            }
            break;
          }
        }
      }

      if (!consumed && bossRef.current && !bossRef.current.entering && circleHit(pr, bossRef.current)) {
        bossRef.current.hp -= pr.dmg;
        spawnParticles(pr.x, pr.y, COLORS.yellow, 5, 90);
        sfx.hit();
        consumed = true;
        if (bossRef.current.hp <= 0) {
          const bx = bossRef.current.x;
          const by = bossRef.current.y;
          spawnParticles(bx, by, COLORS.yellow, 60, 260);
          screenShakeRef.current = 24;
          sfx.bossDown();
          addScore(1000);
          enemiesDestroyedRef.current++;
          spawnPowerUp(bx, by, "life");
          bossRef.current = null;
        }
      }

      if (consumed) projs.splice(i, 1);
    }

    // ---- Combo timeout ----
    if (comboRef.current.count > 0 && now - comboRef.current.lastKillAt > 3000) {
      comboRef.current.count = 0;
      comboRef.current.mult = 1;
    }

    // ---- Weapon level scales with score, enhanced while powerups active (up to 30s) ----
    const anyFiringPower = effectsRef.current.rapidUntil > now || effectsRef.current.multiUntil > now || effectsRef.current.plasmaUntil > now;
    const baseTargetLevel = 1 + Math.min(4, Math.floor(scoreRef.current / 800));
    weaponRef.current.level = anyFiringPower ? Math.max(weaponRef.current.level, 3) : baseTargetLevel;

    // ---- Screen shake decay ----
    if (screenShakeRef.current > 0) screenShakeRef.current = Math.max(0, screenShakeRef.current - dt * 40);

    // ---- Survival time ----
    survivalTimeRef.current = now - survivalStartRef.current;

    // ---- High score tracking ----
    if (scoreRef.current > highScoreRef.current) {
      highScoreRef.current = scoreRef.current;
    }
  }

  function applyPowerUp(key) {
    const now = performance.now();
    sfx.powerUp();
    if (key === "rapid") {
      effectsRef.current.rapidUntil = now + 30000;
      weaponRef.current.level = Math.min(4, Math.max(weaponRef.current.level, 2) + 1);
    } else if (key === "multi") {
      effectsRef.current.multiUntil = now + 30000;
      weaponRef.current.level = Math.min(4, Math.max(weaponRef.current.level, 2) + 1);
    } else if (key === "plasma") {
      effectsRef.current.plasmaUntil = now + 30000;
      weaponRef.current.level = Math.min(4, Math.max(weaponRef.current.level, 2) + 1);
    } else if (key === "shield") {
      // 30-second shield duration
      effectsRef.current.shieldUntil = now + 30000;
      playerRef.current.shieldHits = Math.max(playerRef.current.shieldHits, 5);
    } else if (key === "life") {
      livesRef.current = Math.min(9, livesRef.current + 1);
    } else if (key === "bomb") {
      const p = playerRef.current;
      for (const e of enemiesRef.current) {
        if (dist2(e.x, e.y, p.x, p.y) < 240 * 240) {
          spawnParticles(e.x, e.y, e.color, 8, 120);
          registerKill(e.x, e.y, e.color, e.score);
        }
      }
      enemiesRef.current = enemiesRef.current.filter((e) => dist2(e.x, e.y, p.x, p.y) >= 240 * 240);
      screenShakeRef.current = 18;
    }
  }

  function moveEnemy(e, p, dt, now) {
    const t = (now - e.spawnedAt) / 1000;
    switch (e.pattern) {
      case "straight":
        e.y += e.speed * dt;
        break;
      case "zigzag":
        e.y += e.speed * dt;
        e.x += Math.sin(t * 3 + e.phase) * 60 * dt;
        break;
      case "chase": {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        e.x += (dx / len) * e.speed * dt;
        e.y += (dy / len) * e.speed * dt;
        break;
      }
      case "dive": {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const accel = 1 + Math.min(1.6, t * 0.5);
        e.x += (dx / len) * e.speed * accel * dt;
        e.y += (dy / len) * e.speed * accel * dt;
        break;
      }
      case "orbit": {
        e.orbitAngle += dt * 1.4;
        const cx = p.x;
        const cy = Math.max(140, p.y - 200);
        e.x = cx + Math.cos(e.orbitAngle) * e.orbitR;
        e.y = cy + Math.sin(e.orbitAngle) * e.orbitR * 0.6;
        if (t < 1) e.y -= (1 - t) * 40;
        break;
      }
      case "swarm":
        e.y += e.speed * dt;
        e.x = e.groupX + Math.sin(t * 4 + e.phase) * 26;
        break;
      case "shooter":
        if (e.y < 130) e.y += e.speed * dt;
        else e.x += Math.sin(t * 1.5 + e.phase) * 40 * dt;
        break;
      default:
        e.y += e.speed * dt;
    }

    // Keep enemies strictly within the playable combat corridor
    const { w } = dims.current;
    const { minX, maxX } = getCombatBounds(w);
    e.x = clamp(e.x, minX + e.r, maxX - e.r);
  }

  // ==================================================================
  // Render loop
  // ==================================================================
  function render(ctx) {
    const { w, h } = dims.current;
    ctx.save();
    if (screenShakeRef.current > 0) {
      ctx.translate(rand(-1, 1) * screenShakeRef.current, rand(-1, 1) * screenShakeRef.current);
    }

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#05040c");
    grad.addColorStop(1, "#0c0a1a");
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    for (const s of starsRef.current) {
      const tw = 0.5 + 0.5 * Math.sin(performance.now() / 500 + s.tw);
      ctx.globalAlpha = 0.4 + tw * 0.6;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Subtle boundary guidelines for the active playable combat corridor
    if (w > 760) {
      const { minX, maxX } = getCombatBounds(w);
      ctx.save();
      ctx.strokeStyle = "rgba(90, 200, 250, 0.18)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(minX, 0);
      ctx.lineTo(minX, h);
      ctx.moveTo(maxX, 0);
      ctx.lineTo(maxX, h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Asteroids
    for (const a of asteroidsRef.current) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.beginPath();
      a.points.forEach((pt, i) => {
        const px = Math.cos(pt.a) * pt.r;
        const py = Math.sin(pt.a) * pt.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = "#5c5468";
      ctx.strokeStyle = "#1c1824";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Power-ups
    for (const pu of powerUpsRef.current) {
      const def = POWERUP_TYPES[pu.key];
      const bob = Math.sin(pu.phase) * 3;
      ctx.save();
      ctx.translate(pu.x, pu.y + bob);
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = def.color;
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, pu.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.icon, 0, 1);
      ctx.restore();
    }

    // Enemy projectiles
    for (const pr of enemyProjectilesRef.current) {
      ctx.save();
      ctx.shadowColor = pr.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Enemies
    for (const e of enemiesRef.current) {
      drawEnemy(ctx, e);
    }

    // Boss
    if (bossRef.current) drawBoss(ctx, bossRef.current);

    // Player projectiles (with glow trail)
    for (const pr of projectilesRef.current) {
      ctx.save();
      for (let i = 0; i < pr.trail.length; i++) {
        const t = pr.trail[i];
        ctx.globalAlpha = (i / pr.trail.length) * 0.4;
        ctx.fillStyle = pr.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, pr.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowColor = pr.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Particles
    for (const pt of particlesRef.current) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player ship
    drawPlayer(ctx);

    ctx.restore();
  }

  function drawPlayer(ctx) {
    const p = playerRef.current;
    const now = performance.now();
    const invuln = now < p.invulnUntil;
    if (invuln && Math.floor(now / 90) % 2 === 0) return; // flash

    ctx.save();
    ctx.translate(p.x, p.y);

    const hasTimedShield = effectsRef.current.shieldUntil > now;
    if (hasTimedShield || p.shieldHits > 0) {
      ctx.save();
      ctx.strokeStyle = COLORS.blue;
      ctx.globalAlpha = hasTimedShield ? 0.75 + Math.sin(now / 140) * 0.2 : 0.6;
      ctx.lineWidth = hasTimedShield ? 3 : 2;
      ctx.shadowColor = COLORS.blue;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 10, 0, Math.PI * 2);
      ctx.stroke();

      if (hasTimedShield) {
        const rot = (now / 350) % (Math.PI * 2);
        ctx.strokeStyle = COLORS.lavender;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.r + 15, rot, rot + Math.PI * 1.3);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.shadowColor = COLORS.blue;
    ctx.shadowBlur = 16;
    ctx.fillStyle = COLORS.paper;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(14, 16);
    ctx.lineTo(6, 10);
    ctx.lineTo(0, 16);
    ctx.lineTo(-6, 10);
    ctx.lineTo(-14, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(0, -2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // engine flame
    const flameLen = 8 + Math.sin(now / 60) * 4;
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.moveTo(-5, 15);
    ctx.lineTo(0, 15 + flameLen);
    ctx.lineTo(5, 15);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawEnemy(ctx, e) {
    const now = performance.now();
    ctx.save();
    ctx.translate(e.x, e.y);

    const flameLen = (e.r * 0.45) + Math.sin((now + e.id * 80) / 45) * (e.r * 0.2);

    ctx.shadowColor = "#FF3B30";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.2;

    if (e.type === "drone") {
      // Drone: Inverted red twin of player delta fighter
      const noseY = e.r * 1.25;
      const wingX = e.r * 0.95;
      const rearY = -e.r * 0.9;
      const notchY = -e.r * 0.55;
      const midY = -e.r * 0.95;

      // Rear engine flame (pointing up)
      ctx.fillStyle = COLORS.orange;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.35, midY);
      ctx.lineTo(0, midY - flameLen);
      ctx.lineTo(e.r * 0.35, midY);
      ctx.closePath();
      ctx.fill();

      // Delta Fighter Hull
      ctx.fillStyle = "#FF3B30";
      ctx.beginPath();
      ctx.moveTo(0, noseY);
      ctx.lineTo(wingX, rearY);
      ctx.lineTo(wingX * 0.45, notchY);
      ctx.lineTo(0, midY);
      ctx.lineTo(-wingX * 0.45, notchY);
      ctx.lineTo(-wingX, rearY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cockpit Canopy
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFEAEA";
      ctx.beginPath();
      ctx.arc(0, e.r * 0.1, e.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (e.type === "scout") {
      // Scout: Razor needle fighter with twin thrusters
      const noseY = e.r * 1.4;
      const wingSpan = e.r * 1.2;
      const waistY = -e.r * 0.3;
      const finY = -e.r * 1.05;

      // Twin thrusters
      ctx.fillStyle = COLORS.yellow;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.55, finY);
      ctx.lineTo(-e.r * 0.38, finY - flameLen * 0.9);
      ctx.lineTo(-e.r * 0.2, finY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(e.r * 0.2, finY);
      ctx.lineTo(e.r * 0.38, finY - flameLen * 0.9);
      ctx.lineTo(e.r * 0.55, finY);
      ctx.closePath();
      ctx.fill();

      // Needle Fighter Hull
      ctx.fillStyle = "#FF4D4D";
      ctx.beginPath();
      ctx.moveTo(0, noseY);
      ctx.lineTo(e.r * 0.25, e.r * 0.4);
      ctx.lineTo(wingSpan, waistY);
      ctx.lineTo(e.r * 0.6, finY);
      ctx.lineTo(0, -e.r * 0.7);
      ctx.lineTo(-e.r * 0.6, finY);
      ctx.lineTo(-wingSpan, waistY);
      ctx.lineTo(-e.r * 0.25, e.r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Slender diamond cockpit
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(0, e.r * 0.55);
      ctx.lineTo(e.r * 0.2, e.r * 0.15);
      ctx.lineTo(0, -e.r * 0.1);
      ctx.lineTo(-e.r * 0.2, e.r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.type === "tank") {
      // Tank: Heavy dreadnought with armor plates & dual engine nacelles
      const noseY = e.r * 0.95;
      const noseW = e.r * 0.45;
      const shoulderX = e.r * 1.25;
      const shoulderY = -e.r * 0.15;
      const engineX = e.r * 0.85;
      const engineY = -e.r * 1.0;

      // Dual heavy exhaust flames
      ctx.fillStyle = COLORS.orange;
      ctx.beginPath();
      ctx.moveTo(-engineX - e.r * 0.2, engineY);
      ctx.lineTo(-engineX, engineY - flameLen * 1.15);
      ctx.lineTo(-engineX + e.r * 0.2, engineY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(engineX - e.r * 0.2, engineY);
      ctx.lineTo(engineX, engineY - flameLen * 1.15);
      ctx.lineTo(engineX + e.r * 0.2, engineY);
      ctx.closePath();
      ctx.fill();

      // Heavy Armored Hull
      ctx.fillStyle = "#991B1B";
      ctx.beginPath();
      ctx.moveTo(-noseW, noseY);
      ctx.lineTo(noseW, noseY);
      ctx.lineTo(shoulderX, shoulderY);
      ctx.lineTo(engineX + e.r * 0.25, engineY);
      ctx.lineTo(engineX - e.r * 0.25, engineY);
      ctx.lineTo(e.r * 0.2, -e.r * 0.6);
      ctx.lineTo(-e.r * 0.2, -e.r * 0.6);
      ctx.lineTo(-engineX + e.r * 0.25, engineY);
      ctx.lineTo(-engineX - e.r * 0.25, engineY);
      ctx.lineTo(-shoulderX, shoulderY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Armor plating overlay
      ctx.fillStyle = "#DC2626";
      ctx.beginPath();
      ctx.moveTo(-noseW * 0.75, noseY - e.r * 0.15);
      ctx.lineTo(noseW * 0.75, noseY - e.r * 0.15);
      ctx.lineTo(shoulderX * 0.65, 0);
      ctx.lineTo(-shoulderX * 0.65, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Armored Command Visor
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFEAEA";
      ctx.fillRect(-e.r * 0.35, -e.r * 0.25, e.r * 0.7, e.r * 0.22);
      ctx.strokeRect(-e.r * 0.35, -e.r * 0.25, e.r * 0.7, e.r * 0.22);
    } else if (e.type === "shooter") {
      // Shooter: Heavy wing plasma cannons & central targeting optic
      const noseY = e.r * 0.8;
      const cannonY = e.r * 1.3;
      const cannonX = e.r * 0.95;
      const wingBackX = e.r * 1.1;
      const wingBackY = -e.r * 0.75;
      const engineY = -e.r * 0.9;

      // Center engine flame
      ctx.fillStyle = COLORS.orange;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.3, engineY);
      ctx.lineTo(0, engineY - flameLen);
      ctx.lineTo(e.r * 0.3, engineY);
      ctx.closePath();
      ctx.fill();

      // Artillery Hull
      ctx.fillStyle = "#C53030";
      ctx.beginPath();
      ctx.moveTo(0, noseY);
      ctx.lineTo(e.r * 0.38, e.r * 0.3);
      ctx.lineTo(cannonX - e.r * 0.12, e.r * 0.35);
      ctx.lineTo(cannonX - e.r * 0.12, cannonY);
      ctx.lineTo(cannonX + e.r * 0.15, cannonY);
      ctx.lineTo(cannonX + e.r * 0.15, 0);
      ctx.lineTo(wingBackX, wingBackY);
      ctx.lineTo(0, -e.r * 0.6);
      ctx.lineTo(-wingBackX, wingBackY);
      ctx.lineTo(-cannonX - e.r * 0.15, 0);
      ctx.lineTo(-cannonX - e.r * 0.15, cannonY);
      ctx.lineTo(-cannonX + e.r * 0.12, cannonY);
      ctx.lineTo(-cannonX + e.r * 0.12, e.r * 0.35);
      ctx.lineTo(-e.r * 0.38, e.r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing wing cannon tips
      ctx.fillStyle = "#FF6FB5";
      ctx.fillRect(cannonX - e.r * 0.12, cannonY - 4, e.r * 0.27, 5);
      ctx.fillRect(-cannonX - e.r * 0.15, cannonY - 4, e.r * 0.27, 5);

      // Central glowing targeting optic
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFE142";
      ctx.beginPath();
      ctx.arc(0, -e.r * 0.05, e.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (e.type === "swarm") {
      // Swarm: Compact aggressive mini delta arrow
      const noseY = e.r * 1.25;
      const wingX = e.r * 1.0;
      const rearY = -e.r * 0.85;

      // Small thruster flame
      ctx.fillStyle = COLORS.yellow;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.3, rearY);
      ctx.lineTo(0, rearY - flameLen * 0.85);
      ctx.lineTo(e.r * 0.3, rearY);
      ctx.closePath();
      ctx.fill();

      // Micro Fighter Hull
      ctx.fillStyle = "#FF2A2A";
      ctx.beginPath();
      ctx.moveTo(0, noseY);
      ctx.lineTo(wingX, rearY);
      ctx.lineTo(0, -e.r * 0.4);
      ctx.lineTo(-wingX, rearY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing core dot
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === "elite") {
      // Elite: Imperial Command Flagship with double-tiered wings & triple engines
      const noseY = e.r * 1.4;
      const canardX = e.r * 0.8;
      const canardY = e.r * 0.4;
      const mainWingX = e.r * 1.35;
      const mainWingY = -e.r * 0.7;
      const wingTipY = -e.r * 1.05;
      const engineY = -e.r * 0.95;

      // Triple exhaust flames
      ctx.fillStyle = COLORS.orange;
      for (const ox of [-e.r * 0.5, 0, e.r * 0.5]) {
        ctx.beginPath();
        ctx.moveTo(ox - e.r * 0.15, engineY);
        ctx.lineTo(ox, engineY - flameLen);
        ctx.lineTo(ox + e.r * 0.15, engineY);
        ctx.closePath();
        ctx.fill();
      }

      // Command Flagship Hull
      ctx.fillStyle = "#DC2626";
      ctx.beginPath();
      ctx.moveTo(0, noseY);
      ctx.lineTo(e.r * 0.35, e.r * 0.8);
      ctx.lineTo(canardX, canardY);
      ctx.lineTo(e.r * 0.4, 0);
      ctx.lineTo(mainWingX, mainWingY);
      ctx.lineTo(mainWingX, wingTipY);
      ctx.lineTo(e.r * 0.7, -e.r * 0.6);
      ctx.lineTo(0, -e.r * 0.75);
      ctx.lineTo(-e.r * 0.7, -e.r * 0.6);
      ctx.lineTo(-mainWingX, wingTipY);
      ctx.lineTo(-mainWingX, mainWingY);
      ctx.lineTo(-e.r * 0.4, 0);
      ctx.lineTo(-canardX, canardY);
      ctx.lineTo(-e.r * 0.35, e.r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Gold Command Bridge canopy
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFE142";
      ctx.beginPath();
      ctx.arc(0, e.r * 0.15, e.r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Wing energy emitters
      ctx.fillStyle = "#FF6B6B";
      ctx.beginPath();
      ctx.arc(mainWingX * 0.8, mainWingY * 0.6, e.r * 0.14, 0, Math.PI * 2);
      ctx.arc(-mainWingX * 0.8, mainWingY * 0.6, e.r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();

    // Mini health bar for tougher enemies
    if (e.maxHp > 1) {
      const pct = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 4);
      ctx.fillStyle = "#FF3B30";
      ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * pct, 4);
    }
  }

  function drawBoss(ctx, b) {
    const now = performance.now();
    ctx.save();
    ctx.translate(b.x, b.y);

    const flameLen = 14 + Math.sin(now / 50) * 8;

    // Quad heavy thruster flames
    ctx.fillStyle = COLORS.orange;
    for (const ox of [-b.r * 0.6, -b.r * 0.2, b.r * 0.2, b.r * 0.6]) {
      ctx.beginPath();
      ctx.moveTo(ox - 5, -b.r * 0.7);
      ctx.lineTo(ox, -b.r * 0.7 - flameLen);
      ctx.lineTo(ox + 5, -b.r * 0.7);
      ctx.closePath();
      ctx.fill();
    }

    // Shadow & Outline
    ctx.shadowColor = "#FF3B30";
    ctx.shadowBlur = 24;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;

    // Main Capital Ship Red Hull
    ctx.fillStyle = "#7F1D1D";
    ctx.beginPath();
    ctx.moveTo(0, b.r * 1.15); // front ram
    ctx.lineTo(b.r * 0.45, b.r * 0.6);
    ctx.lineTo(b.r * 1.25, 0); // wing tip
    ctx.lineTo(b.r * 1.15, -b.r * 0.6);
    ctx.lineTo(b.r * 0.7, -b.r * 0.4);
    ctx.lineTo(0, -b.r * 0.55); // rear indent
    ctx.lineTo(-b.r * 0.7, -b.r * 0.4);
    ctx.lineTo(-b.r * 1.15, -b.r * 0.6);
    ctx.lineTo(-b.r * 1.25, 0);
    ctx.lineTo(-b.r * 0.45, b.r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Secondary armored plating
    ctx.fillStyle = "#DC2626";
    ctx.beginPath();
    ctx.moveTo(0, b.r * 0.85);
    ctx.lineTo(b.r * 0.35, b.r * 0.3);
    ctx.lineTo(b.r * 0.8, -b.r * 0.2);
    ctx.lineTo(-b.r * 0.8, -b.r * 0.2);
    ctx.lineTo(-b.r * 0.35, b.r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Central Command Bridge with pulsating core
    ctx.shadowBlur = 10;
    ctx.fillStyle = b.phase === 3 ? COLORS.yellow : b.phase === 2 ? COLORS.orange : COLORS.pink;
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Turret pods on wingtips
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(-b.r * 1.15, -4, 10, 8);
    ctx.fillRect(b.r * 1.15 - 10, -4, 10, 8);

    ctx.restore();
  }

  // ==================================================================
  // Game control functions
  // ==================================================================
  function triggerEmpBlast() {
    const p = playerRef.current;
    sfx.powerUp();
    screenShakeRef.current = 22;
    spawnParticles(p.x, p.y, COLORS.blue, 30, 220);
    // Destroy regular enemy projectiles
    enemyProjectilesRef.current = [];
    for (const e of enemiesRef.current) {
      if (dist2(e.x, e.y, p.x, p.y) < 320 * 320) {
        e.hp -= 3;
        spawnParticles(e.x, e.y, e.color, 12, 140);
        if (e.hp <= 0) {
          registerKill(e.x, e.y, e.color, e.score);
        }
      }
    }
    enemiesRef.current = enemiesRef.current.filter((e) => e.hp > 0);
  }

  const startGame = () => {
    ensureAudio();
    sessionRecordedRef.current = false;
    setLastProgressionResult(null);
    resetGameObjects();
    setFinalStats(null);
    setIsNewHighScore(false);
    setGameState("playing");
  };

  const pauseGame = () => setGameState("paused");
  const resumeGame = () => setGameState("playing");
  const restartGame = () => startGame();
  const exitGame = () => {
    if (gameState === "start") {
      navigate("/");
    } else {
      setGameState("start");
    }
  };

  function endGame() {
    const wasNewHigh = scoreRef.current > 0 && scoreRef.current >= highScoreRef.current;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(highScoreRef.current));
    } catch (e) {}

    const stats = {
      score: scoreRef.current,
      highScore: highScoreRef.current,
      wave: waveRef.current,
      enemiesDestroyed: enemiesDestroyedRef.current,
      maxCombo: maxComboRef.current,
      survivalTime: survivalTimeRef.current,
    };
    setFinalStats(stats);
    setIsNewHighScore(wasNewHigh);
    sfx.gameOver();
    if (wasNewHigh) setTimeout(() => sfx.highScore(), 350);

    if (typeof onGameComplete === "function") {
      onGameComplete({
        gameId: GAME_ID,
        score: stats.score,
        highestCombo: stats.maxCombo,
        survivalTime: stats.survivalTime,
        enemiesDestroyed: stats.enemiesDestroyed,
        wave: stats.wave,
      });
    }

    if (!sessionRecordedRef.current) {
      sessionRecordedRef.current = true;
      recordGameResult({
        gameId: GAME_ID,
        score: stats.score,
        combo: stats.maxCombo,
        wave: stats.wave,
        survivalTime: stats.survivalTime,
        enemiesDestroyed: stats.enemiesDestroyed,
        sessionId: `ss_${Date.now()}_${Math.random()}`,
      }).then((res) => {
        if (res) setLastProgressionResult(res);
      });
    }

    setGameState("gameover");
  }

  // --- Hand tracking callback ---
  const handleGesture = useCallback((gesture, indexTip, dimsData, landmarks) => {
    setCurrentGesture(gesture);
    if (!indexTip && !landmarks) {
      setHandTracked(false);
      if (gestureRef.current) gestureRef.current.active = false;
      return;
    }

    setHandTracked(true);
    // Mirror X coordinate since camera is mirrored
    const tipX = indexTip ? (1 - indexTip.x) : (landmarks ? 1 - landmarks[8].x : 0.5);
    const tipY = indexTip ? indexTip.y : (landmarks ? landmarks[8].y : 0.5);

    gestureRef.current = {
      x: tipX,
      y: tipY,
      active: true,
    };

    const now = performance.now();

    // 1. PINCH: EMP blast / start game
    if (gesture === GESTURES.PINCH) {
      if (now - lastPinchRef.current > 1000) {
        lastPinchRef.current = now;
        if (gameStateRef.current === 'start') {
          startGame();
        } else if (gameStateRef.current === 'playing') {
          triggerEmpBlast();
        }
      }
    }

    // 2. ROCK: Pause / Resume toggle
    if (gesture === GESTURES.ROCK) {
      if (now - lastRockRef.current > 1500) {
        lastRockRef.current = now;
        if (gameStateRef.current === 'playing') {
          pauseGame();
        } else if (gameStateRef.current === 'paused') {
          resumeGame();
        }
      }
    }
  }, []);

  useHandTracking({
    videoRef,
    overlayCanvasRef: handOverlayRef,
    onGesture: handleGesture,
  });

  // ==================================================================
  // RAF loop
  // ==================================================================
  useEffect(() => {
    if (gameState !== "playing") return undefined;

    let hudTimer = 0;
    lastTsRef.current = performance.now();

    const loop = (ts) => {
      const dt = Math.min(0.04, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      update(dt, ts);

      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) render(ctx);

      hudTimer += dt * 1000;
      if (hudTimer > 120) {
        hudTimer = 0;
        syncHud();
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // Keep a static frame visible while paused
  useEffect(() => {
    if (gameState === "paused") {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) render(ctx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // ==================================================================
  // UI subcomponents
  // ==================================================================
  const NeoButton = ({ children, onClick, color = COLORS.yellow, className: cn = "" }) => (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-mono font-extrabold text-black border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-transform ${cn}`}
      style={{ background: color, minHeight: 44 }}
    >
      {children}
    </button>
  );

  const controlBadge = {
    gesture: { text: "GESTURE CONTROL", color: COLORS.green },
    touch: { text: "TOUCH CONTROL", color: COLORS.blue },
    keyboard: { text: "KEYBOARD CONTROL", color: COLORS.lavender },
  }[controlMode];

  const gestureReady = handTracked || !!(gesturePosition && gesturePosition.active !== undefined);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full h-full min-h-[480px] bg-[#05040c] border-[3px] border-black overflow-hidden select-none ${className}`}
      style={{ touchAction: "none" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* Back to Home Button */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-3 left-3 z-30 px-3 py-1 font-mono font-black text-xs uppercase bg-[#F5F0E6] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-white active:translate-x-0.5 active:translate-y-0.5"
      >
        ← HOME
      </button>

      {/* Floating In-Game Gesture Guide during active play */}
      {gameState === "playing" && (
        <InGameGestureGuide gameName="space-shooter" />
      )}

      {/* Picture-in-Picture Camera Feed */}
      <div
        className="fixed bottom-16 right-4 w-28 h-20 sm:w-32 sm:h-24 bg-black border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] z-40 overflow-hidden pointer-events-none"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover pointer-events-none"
          style={{ transform: "scaleX(-1)", opacity: 0.9 }}
        />
        <canvas
          ref={handOverlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: "scaleX(-1)" }}
        />
      </div>

      {/* ---------------- HUD (playing / paused) ---------------- */}
      {(gameState === "playing" || gameState === "paused") && (
        <>
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none font-mono">
            <div className="bg-[#F5F0E6] border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-3 py-1">
              <div className="text-[10px] font-extrabold tracking-wide">SCORE</div>
              <div className="text-lg font-extrabold leading-none">{fmtScore(hud.score)}</div>
            </div>

            <div className="bg-black text-white border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-3 py-1 text-center">
              <div className="text-xs font-extrabold" style={{ color: COLORS.yellow }}>
                WAVE {String(hud.wave).padStart(2, "0")}
              </div>
            </div>

            <div className="bg-[#F5F0E6] border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-3 py-1 text-right">
              <div className="text-[10px] font-extrabold tracking-wide">HIGH SCORE</div>
              <div className="text-lg font-extrabold leading-none">{fmtScore(hud.highScore)}</div>
            </div>
          </div>

          <div className="absolute top-16 left-2 flex flex-col gap-1 pointer-events-none">
            <div className="flex gap-1">
              {Array.from({ length: hud.lives }).map((_, i) => (
                <span key={i} className="text-lg leading-none">
                  ❤️
                </span>
              ))}
            </div>
            {hud.combo > 1 && (
              <div
                className="font-mono font-extrabold text-sm px-2 py-0.5 border-2 border-black w-fit"
                style={{ background: COLORS.pink }}
              >
                COMBO x{hud.combo}
              </div>
            )}
          </div>

          {hud.powerUps.length > 0 && (
            <div className="absolute top-16 right-2 flex flex-col gap-1 items-end pointer-events-none">
              {hud.powerUps.map((pu) => (
                <div
                  key={pu.key}
                  className="font-mono text-[10px] font-bold px-2 py-0.5 border-2 border-black bg-[#F5F0E6]"
                >
                  {pu.label} {pu.status ? `[${pu.status}]` : pu.secs ? `${Math.ceil(pu.secs)}s` : pu.hits ? `x${pu.hits}` : ""}
                </div>
              ))}
            </div>
          )}

          {hud.bossActive && (
            <div className="absolute top-28 left-1/2 -translate-x-1/2 w-3/4 max-w-xs pointer-events-none">
              <div className="text-center text-[10px] font-mono font-extrabold text-white mb-0.5">BOSS</div>
              <div className="h-3 border-2 border-black bg-black">
                <div
                  className="h-full"
                  style={{ width: `${hud.bossHpPct * 100}%`, background: COLORS.pink }}
                />
              </div>
            </div>
          )}

          <div
            className="absolute bottom-2 left-2 font-mono text-[10px] font-extrabold px-2 py-1 border-2 border-black pointer-events-none"
            style={{ background: controlBadge.color }}
          >
            {controlBadge.text}
          </div>

          <button
            onClick={pauseGame}
            className="absolute bottom-2 right-2 w-11 h-11 flex items-center justify-center font-mono font-extrabold text-lg border-[3px] border-black bg-[#F5F0E6] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            aria-label="Pause"
          >
            ⏸
          </button>

          <button
            onClick={toggleSound}
            className="absolute bottom-2 right-16 w-11 h-11 flex items-center justify-center font-mono font-extrabold text-lg border-[3px] border-black bg-[#F5F0E6] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            aria-label="Toggle sound"
          >
            {soundOn ? "\uD83D\uDD0A" : "\uD83D\uDD07"}
          </button>
        </>
      )}

      {/* ---------------- Wave announce ---------------- */}
      {waveAnnounce && gameState === "playing" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="font-mono font-extrabold text-3xl text-black px-6 py-3 border-[4px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-pulse"
            style={{ background: COLORS.yellow }}
          >
            {waveAnnounce.text}
          </div>
        </div>
      )}

      {/* ---------------- Boss warning ---------------- */}
      {bossWarning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="font-mono font-extrabold text-2xl text-white px-6 py-3 border-[4px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
            style={{ background: COLORS.pink }}
          >
            ⚠️ BOSS INCOMING
          </div>
        </div>
      )}

      {/* ---------------- Start screen ---------------- */}
      {gameState === "start" && (
        <div className="absolute inset-0 flex items-center justify-center p-4" style={{ background: "#05040c" }}>
          <div
            className="w-full max-w-sm bg-[#F5F0E6] border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 text-center font-mono"
          >
            <h1 className="text-3xl font-extrabold mb-1" style={{ color: COLORS.ink }}>
              SPACE SHOOTER
            </h1>
            <div className="text-sm font-extrabold mb-4" style={{ color: COLORS.pink }}>
              SURVIVE THE VOID
            </div>
            <p className="text-xs leading-relaxed mb-4">
              Automatically destroy incoming enemies. Move your ship. Collect power-ups. Survive as long as
              possible.
            </p>

            <div className="flex justify-center gap-3 mb-4">
              <div className="border-2 border-black px-3 py-2 bg-white">
                <div className="text-lg">🖐</div>
                <div className="text-[10px] font-bold">MOVE</div>
              </div>
              <div className="border-2 border-black px-3 py-2 bg-white">
                <div className="text-lg">🔫</div>
                <div className="text-[10px] font-bold">AUTO FIRE</div>
              </div>
            </div>

            <div
              className="text-[10px] font-extrabold mb-4 px-2 py-1 border-2 border-black inline-block"
              style={{ background: gestureReady ? COLORS.green : COLORS.lavender }}
            >
              {gestureReady ? "GESTURE READY" : "KEYBOARD / TOUCH READY"}
            </div>

            <div>
              <NeoButton onClick={startGame} color={COLORS.yellow}>
                START GAME
              </NeoButton>
            </div>

            {highScoreRef.current > 0 && (
              <div className="mt-4 text-xs font-bold">HIGH SCORE: {fmtScore(highScoreRef.current)}</div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Pause screen ---------------- */}
      {gameState === "paused" && (
        <div className="absolute inset-0 flex items-center justify-center p-4" style={{ background: "rgba(5,4,12,0.85)" }}>
          <div className="w-full max-w-xs bg-[#F5F0E6] border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 text-center font-mono">
            <h2 className="text-2xl font-extrabold mb-5">GAME PAUSED</h2>
            <div className="flex flex-col gap-3">
              <NeoButton onClick={resumeGame} color={COLORS.green}>
                RESUME
              </NeoButton>
              <NeoButton onClick={restartGame} color={COLORS.blue}>
                RESTART
              </NeoButton>
              <NeoButton onClick={exitGame} color={COLORS.pink}>
                EXIT
              </NeoButton>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Game over screen ---------------- */}
      {gameState === "gameover" && finalStats && (
        <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto" style={{ background: "#05040c" }}>
          <div className="w-full max-w-sm bg-[#F5F0E6] border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-5 text-center font-mono my-4">
            <h2 className="text-2xl font-extrabold mb-2" style={{ color: COLORS.pink }}>
              GAME OVER
            </h2>

            {isNewHighScore && (
              <div
                className="text-xs font-extrabold mb-3 px-2 py-1 border-2 border-black inline-block"
                style={{ background: COLORS.yellow }}
              >
                🔥 NEW HIGH SCORE!
              </div>
            )}

            <div className="text-[10px] font-extrabold tracking-wide mt-2">FINAL SCORE</div>
            <div className="text-3xl font-extrabold mb-2">{fmtScore(finalStats.score)}</div>

            <div className="grid grid-cols-2 gap-2 text-left text-xs mt-3">
              <div className="border-2 border-black bg-white px-2 py-1">
                <div className="text-[9px] font-bold opacity-70">HIGH SCORE</div>
                <div className="font-extrabold">{fmtScore(finalStats.highScore)}</div>
              </div>
              <div className="border-2 border-black bg-white px-2 py-1">
                <div className="text-[9px] font-bold opacity-70">WAVE REACHED</div>
                <div className="font-extrabold">{String(finalStats.wave).padStart(2, "0")}</div>
              </div>
              <div className="border-2 border-black bg-white px-2 py-1">
                <div className="text-[9px] font-bold opacity-70">ENEMIES DESTROYED</div>
                <div className="font-extrabold">{finalStats.enemiesDestroyed}</div>
              </div>
              <div className="border-2 border-black bg-white px-2 py-1">
                <div className="text-[9px] font-bold opacity-70">MAX COMBO</div>
                <div className="font-extrabold">x{finalStats.maxCombo}</div>
              </div>
              <div className="border-2 border-black bg-white px-2 py-1 col-span-2">
                <div className="text-[9px] font-bold opacity-70">SURVIVAL TIME</div>
                <div className="font-extrabold">{fmtTime(finalStats.survivalTime)}</div>
              </div>
            </div>

            <PostGameProgression result={lastProgressionResult} />

            {/* Dedicated Game Over Ad Slot */}
            <div className="w-full my-3 flex justify-center">
              <AdSlot placement="game-over" format="banner" className="max-w-[280px] sm:max-w-[340px]" />
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <NeoButton onClick={restartGame} color={COLORS.green}>
                PLAY AGAIN
              </NeoButton>
              <NeoButton onClick={exitGame} color={COLORS.lavender}>
                ← BACK TO HOME
              </NeoButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Metadata export - useful for Gesture Studio's game registry / menu
// ------------------------------------------------------------------
export const spaceShooterMeta = {
  gameId: GAME_ID,
  name: "SPACE SHOOTER",
  description: "Survive endless waves of enemies, dodge deadly attacks, collect power-ups, and destroy the void.",
  category: "SPACE ARCADE",
};
