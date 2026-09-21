import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import HolographicHand from '../components/HolographicHand';
import { useHandTracking } from '../hooks/useHandTracking';
import { GESTURES } from '../utils/gestureDetector';
import { useGestureAcademy } from '../hooks/useGestureAcademy';
import { usePlayer } from '../hooks/usePlayer';
import CrazyRoadTutorial from '../components/academy/CrazyRoadTutorial';
import FlappyBirdTutorial from '../components/academy/FlappyBirdTutorial';

// ── Web Audio Sound Synthesis ─────────────────────────────────────────────
class SoundPlayer {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playClick() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // AudioContext failure fallback
    }
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
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.18, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.25);
      });
    } catch {
      // AudioContext failure fallback
    }
  }

  playFanfare() {
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [392, 523.25, 659.25, 783.99, 1046.5, 1318.5];
      const now = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.2, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.4);
      });
    } catch {
      // AudioContext failure fallback
    }
  }
}

const sounds = new SoundPlayer();

// ── Game Metadata Mapping ─────────────────────────────────────────────────
const GAME_MAP = {
  'fruit-ninja': { name: 'Fruit Ninja', path: '/fruit-ninja', emoji: '🍉' },
  'hill-climb': { name: 'Crazy Road', path: '/hill-climb', emoji: '🏎️' },
  'flappy-bird': { name: 'Flappy Bird', path: '/flappy-bird', emoji: '🐦' },
  'archery': { name: 'Archery Challenge', path: '/archery', emoji: '🏹' },
  'bird-hunter': { name: 'Bird Hunter', path: '/bird-hunter', emoji: '🦅' },
  'space-shooter': { name: 'Space Shooter', path: '/space-shooter', emoji: '🚀' },
};

// ── Master Gestures Dictionary ───────────────────────────────────────────
const ALL_LESSONS = {
  'index-point': {
    id: 'index-point',
    name: 'Index Point',
    emoji: '☝️',
    holoGesture: 'INDEX_POINT',
    badge: 'POINT / SLICE',
    badgeBg: 'bg-neo-yellow',
    description: 'Extend your index finger upwards while curling your thumb and other fingers.',
    usage: 'Fruit Ninja · Space Pilot · Move',
    hint: 'Point your index finger straight up. Steers your starship or slices fruits!',
    verify: (gesture) => gesture === GESTURES.DRAW,
  },
  'two-fingers': {
    id: 'two-fingers',
    name: 'Peace Sign',
    emoji: '✌️',
    holoGesture: 'TWO_FINGERS',
    badge: 'ACTION / STEER',
    badgeBg: 'bg-neo-cyan',
    description: 'Raise both your index and middle fingers in a classic peace or V-sign.',
    usage: 'Traffic Lane 2 · Left',
    hint: 'Keep index and middle fingers extended apart in a peace sign.',
    verify: (gesture) => gesture === GESTURES.ERASE,
  },
  'rock': {
    id: 'rock',
    name: 'Rock Sign',
    emoji: '🤟',
    holoGesture: 'ROCK',
    badge: 'PAUSE & CONTROL',
    badgeBg: 'bg-orange-300',
    description: 'Extend your index and pinky fingers up, keeping middle and ring fingers folded.',
    usage: 'Universal Pause / Resume Across All Games',
    hint: 'Show the rock / horns sign (index + pinky up). Universal pause/resume across all games!',
    verify: (gesture) => gesture === GESTURES.ROCK,
  },
  'pinch': {
    id: 'pinch',
    name: 'Pinch Finger',
    emoji: '🤏',
    holoGesture: 'PINCH',
    badge: 'GRAB & ACTION',
    badgeBg: 'bg-neo-pink',
    description: 'Pinch your thumb tip and index fingertip firmly together.',
    usage: 'Slingshot · Bow · Flap · EMP Blast',
    hint: 'Touch thumb to index tip. Triggers EMP blast in Space Shooter or draws bow.',
    verify: (gesture) => gesture === GESTURES.PINCH,
  },
  'fist': {
    id: 'fist',
    name: 'Closed Fist',
    emoji: '✊',
    holoGesture: 'FIST',
    badge: 'POWER & CANCEL',
    badgeBg: 'bg-amber-300',
    description: 'Curl all fingers tightly into a solid closed fist.',
    usage: 'Cancel Aim · Nitro Boost',
    hint: 'Tuck all fingers firmly into your palm.',
    verify: (gesture) => gesture === GESTURES.PAN,
  },
  'scroll-up': {
    id: 'scroll-up',
    name: 'Scroll Up',
    emoji: '👆',
    holoGesture: 'SCROLL_UP',
    badge: 'NAVIGATION',
    badgeBg: 'bg-purple-300',
    description: 'Move or hold your hand towards the upper part of the screen.',
    usage: 'Scroll Up · Upward Movement',
    hint: 'Raise your hand into the top portion of the camera frame.',
    verify: (gesture, landmarks) => {
      if (!landmarks || landmarks.length < 21) return false;
      return landmarks[0].y < 0.40 || landmarks[8].y < 0.32;
    },
  },
  'scroll-down': {
    id: 'scroll-down',
    name: 'Scroll Down',
    emoji: '👇',
    holoGesture: 'SCROLL_DOWN',
    badge: 'NAVIGATION',
    badgeBg: 'bg-blue-300',
    description: 'Move or hold your hand towards the lower part of the screen.',
    usage: 'Scroll Down · Downward Movement',
    hint: 'Lower your hand into the bottom portion of the camera frame.',
    verify: (gesture, landmarks) => {
      if (!landmarks || landmarks.length < 21) return false;
      return landmarks[0].y > 0.60 || landmarks[8].y > 0.65;
    },
  },
  'move-slice': {
    id: 'move-slice',
    name: 'Moving / Slice',
    emoji: '⚔️',
    holoGesture: 'MOVE_RIGHT',
    badge: 'SWIPE & SLICE',
    badgeBg: 'bg-neo-lime',
    description: 'Glide your hand across the screen to slice airborne fruits.',
    usage: 'Fruit Ninja (Swipe to Slice)',
    hint: 'Move your hand left and right across the camera to slice fruits.',
    verify: (gesture, landmarks) => {
      if (!landmarks || landmarks.length < 21) return false;
      return true;
    },
  },
};

// Game specific gesture lesson mapping
const GAME_LESSON_IDS = {
  'fruit-ninja': ['index-point', 'move-slice'],
  'flappy-bird': ['pinch', 'rock'],
  'archery': ['pinch', 'rock'],
  'bird-hunter': ['pinch', 'fist', 'rock'],
  'hill-climb': ['index-point', 'two-fingers', 'rock', 'fist'],
  'space-shooter': ['index-point', 'pinch', 'rock'],
};

export default function GestureAcademy() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetGameKey = searchParams.get('game');
  const targetGame = targetGameKey ? GAME_MAP[targetGameKey] : null;
  const { recordAcademyCompletion } = usePlayer();

  // Filter lessons: specific gestures for specific game, or ALL gestures for full academy
  const lessons = useMemo(() => {
    if (targetGameKey && GAME_LESSON_IDS[targetGameKey]) {
      return GAME_LESSON_IDS[targetGameKey].map((id) => ALL_LESSONS[id]).filter(Boolean);
    }
    return Object.values(ALL_LESSONS).filter((l) => l.id !== 'move-slice');
  }, [targetGameKey]);

  const { completeGame, completeGlobal, resetAll, settings } = useGestureAcademy(targetGameKey);

  // Lesson states
  const [lessonIndex, setLessonIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Live detection feedback
  const [liveGesture, setLiveGesture] = useState(GESTURES.NONE);
  const [matchProgress, setMatchProgress] = useState(0); // 0 to 100
  const [isSuccessPulsing, setIsSuccessPulsing] = useState(false);

  // Video and Canvas refs for MediaPipe
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const confettiCanvasRef = useRef(null);

  // Timing and transition refs to avoid race conditions & duplicate advances across camera frames
  const holdStartTimeRef = useRef(null);
  const advanceTimeoutRef = useRef(null);
  const isAdvancingRef = useRef(false);
  const lessonIndexRef = useRef(lessonIndex);
  lessonIndexRef.current = lessonIndex;

  const currentLesson = lessons[lessonIndex] || lessons[0];

  // Confetti burst animation
  const triggerConfetti = useCallback(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#FACC15', '#FB7185', '#38BDF8', '#4ADE80', '#A855F7', '#F97316'];
    const particles = Array.from({ length: 70 }, () => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.8) * 18,
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      alpha: 1,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.45; // gravity
        p.rotation += p.vRot;
        p.alpha -= 0.015;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      if (alive) {
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    render();
  }, []);

  // Gesture callback from useHandTracking
  const handleGestureDetected = useCallback(
    (gesture, indexTip, dims, landmarks) => {
      setLiveGesture(gesture);

      // Lock out during completion or active transition to avoid duplicate advances
      if (isCompleted || isAdvancingRef.current) return;

      const currentIdx = lessonIndexRef.current;
      const lesson = lessons[currentIdx];
      if (!lesson) return;

      const isMatch = lesson.verify(gesture, landmarks);

      if (isMatch) {
        if (!holdStartTimeRef.current) {
          holdStartTimeRef.current = performance.now();
        }
        const elapsed = performance.now() - holdStartTimeRef.current;
        const requiredHold = 750; // Hold for 750ms
        const progress = Math.min(100, Math.round((elapsed / requiredHold) * 100));
        setMatchProgress(progress);

        if (progress >= 100 && !isAdvancingRef.current) {
          isAdvancingRef.current = true;
          setIsSuccessPulsing(true);
          sounds.playSuccess();
          triggerConfetti();

          if (advanceTimeoutRef.current) {
            clearTimeout(advanceTimeoutRef.current);
          }

          advanceTimeoutRef.current = setTimeout(() => {
            const nextIdx = lessonIndexRef.current + 1;
            if (nextIdx < lessons.length) {
              setLessonIndex(nextIdx);
              setMatchProgress(0);
              setIsSuccessPulsing(false);
              holdStartTimeRef.current = null;
              isAdvancingRef.current = false;
            } else {
              // Completed all lessons!
              setIsCompleted(true);
              if (targetGameKey) {
                completeGame(targetGameKey);
              } else {
                completeGlobal();
                recordAcademyCompletion?.();
              }
              sounds.playFanfare();
              triggerConfetti();
              isAdvancingRef.current = false;
            }
          }, 800);
        }
      } else {
        // Reset hold timer if match is broken
        holdStartTimeRef.current = null;
        setMatchProgress((prev) => Math.max(0, prev - 15));
      }
    },
    [isCompleted, triggerConfetti, completeGlobal, completeGame, targetGameKey]
  );

  // Initialize MediaPipe via useHandTracking hook
  useHandTracking({
    videoRef,
    overlayCanvasRef,
    onGesture: handleGestureDetected,
    enabled: targetGameKey !== 'hill-climb' && targetGameKey !== 'flappy-bird',
  });

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

  // Handle Skip Action
  const handleConfirmSkip = () => {
    sounds.playClick();
    if (targetGameKey) {
      completeGame(targetGameKey);
    } else {
      completeGlobal();
    }
    setShowSkipModal(false);
    if (targetGame) {
      navigate(targetGame.path);
    } else {
      navigate('/');
    }
  };

  // Launch target game or home
  const handleLaunchGame = () => {
    sounds.playClick();
    if (targetGame) {
      navigate(targetGame.path);
    } else {
      navigate('/');
    }
  };

  // Restart Academy
  const handleReplay = () => {
    sounds.playClick();
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    isAdvancingRef.current = false;
    setLessonIndex(0);
    setIsCompleted(false);
    setMatchProgress(0);
    setIsSuccessPulsing(false);
    holdStartTimeRef.current = null;
  };

  return (
    <div className="w-full min-h-screen bg-neo-dots text-black font-sans flex flex-col selection:bg-neo-yellow selection:text-black">
      {/* Confetti full-screen canvas */}
      <canvas
        ref={confettiCanvasRef}
        className="fixed inset-0 pointer-events-none z-50"
      />

      {/* ── Top Header Navigation Bar ──────────────────────────────────────── */}
      <header className="w-full bg-white border-b-3 border-black px-4 py-3 flex items-center justify-between shadow-neo-sm z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            onClick={() => sounds.playClick()}
            className="px-3 py-1 bg-neo-yellow hover:bg-yellow-300 border-2 border-black font-display font-black text-xs uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Exit</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <span className="font-display font-black text-lg uppercase tracking-tight hidden sm:inline">
              Gesture Academy
            </span>
            {targetGame && (
              <span className="bg-neo-pink px-2 py-0.5 border border-black font-mono text-[11px] font-black uppercase">
                {targetGame.emoji} {targetGame.name} Tutorial
              </span>
            )}
          </div>
        </div>

        {/* Action buttons: Skip & Settings */}
        <div className="flex items-center gap-2">
          {!isCompleted && (
            <button
              onClick={() => {
                sounds.playClick();
                setShowSkipModal(true);
              }}
              className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 border-2 border-black font-mono font-bold text-xs uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            >
              Skip Tutorial
            </button>
          )}
          <button
            onClick={() => {
              sounds.playClick();
              setShowSettingsModal(true);
            }}
            className="w-8 h-8 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-bold text-sm shadow-neo-sm flex items-center justify-center active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            title="Academy Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* ── Mode & Game Selector Sub-bar ───────────────────────────────────── */}
      <div className="w-full bg-[#FFFDF5] border-b-2 border-black px-4 py-2 flex items-center gap-2 overflow-x-auto shadow-xs z-20">
        <span className="font-mono font-black text-[11px] uppercase text-zinc-600 shrink-0">
          Mode:
        </span>
        <button
          onClick={() => {
            sounds.playClick();
            navigate('/gesture-academy');
          }}
          className={`px-3 py-1 text-xs font-mono font-black uppercase border-2 border-black transition-all shrink-0 ${
            !targetGameKey
              ? 'bg-neo-yellow text-black shadow-neo-sm'
              : 'bg-white text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          🎓 Universal Gestures
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            navigate('/gesture-academy?game=hill-climb');
          }}
          className={`px-3 py-1 text-xs font-mono font-black uppercase border-2 border-black transition-all shrink-0 flex items-center gap-1.5 ${
            targetGameKey === 'hill-climb'
              ? 'bg-neo-lime text-black shadow-neo-sm'
              : 'bg-white text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          <span>🏎️ Crazy Road Mini-Tutorial</span>
          <span className="bg-neo-pink text-white text-[9px] px-1 py-0.2 border border-black font-black">
            PLAYABLE
          </span>
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            navigate('/gesture-academy?game=flappy-bird');
          }}
          className={`px-3 py-1 text-xs font-mono font-black uppercase border-2 border-black transition-all shrink-0 flex items-center gap-1.5 ${
            targetGameKey === 'flappy-bird'
              ? 'bg-neo-cyan text-black shadow-neo-sm'
              : 'bg-white text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          <span>🐦 Flappy Bird Simulation</span>
          <span className="bg-neo-pink text-white text-[9px] px-1 py-0.2 border border-black font-black">
            PLAYABLE
          </span>
        </button>

        {Object.entries(GAME_MAP)
          .filter(([key]) => key !== 'hill-climb' && key !== 'flappy-bird')
          .map(([key, game]) => (
            <button
              key={key}
              onClick={() => {
                sounds.playClick();
                navigate(`/gesture-academy?game=${key}`);
              }}
              className={`px-2.5 py-1 text-xs font-mono font-bold uppercase border-2 border-black transition-all shrink-0 ${
                targetGameKey === key
                  ? 'bg-neo-cyan text-black shadow-neo-sm'
                  : 'bg-white text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              {game.emoji} {game.name}
            </button>
          ))}
      </div>

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 md:p-8 flex flex-col justify-center">
        {targetGameKey === 'hill-climb' ? (
          <CrazyRoadTutorial />
        ) : targetGameKey === 'flappy-bird' ? (
          <FlappyBirdTutorial />
        ) : !isCompleted ? (
          <div className="flex flex-col gap-6">
            {/* ── Progress Bar & Lesson Counter ────────────────────────────── */}
            <div className="w-full bg-white border-3 border-black p-4 shadow-neo-md">
              <div className="flex items-center justify-between font-mono font-black text-xs sm:text-sm uppercase mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-neo-lime border border-black animate-pulse" />
                  <span>
                    Lesson {lessonIndex + 1} of {lessons.length}: {currentLesson.name}
                  </span>
                </span>
                <span className="text-zinc-600">
                  {Math.round(((lessonIndex) / lessons.length) * 100)}% Complete
                </span>
              </div>
              <div className="w-full h-4 bg-zinc-100 border-2 border-black overflow-hidden relative">
                <div
                  className="h-full bg-neo-lime border-r-2 border-black transition-all duration-300"
                  style={{ width: `${((lessonIndex) / lessons.length) * 100}%` }}
                />
              </div>
            </div>

            {/* ── Lesson Interactive Grid ──────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Column: Holographic AR Hand & Instructions (5 Cols) */}
              <div className="lg:col-span-5 bg-white border-3 border-black p-5 shadow-neo-lg flex flex-col justify-between relative overflow-hidden">
                {/* Lesson Header */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`neo-tag ${currentLesson.badgeBg} text-black font-black`}>
                      {currentLesson.badge}
                    </span>
                    <span className="text-3xl">{currentLesson.emoji}</span>
                  </div>

                  <h2 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-black mb-2">
                    {currentLesson.name}
                  </h2>
                  <p className="text-zinc-800 text-sm font-medium mb-4 leading-relaxed">
                    {currentLesson.description}
                  </p>

                  <div className="bg-neo-cream border-2 border-black p-3 mb-4">
                    <span className="font-mono font-black text-xs uppercase block text-black mb-1">
                      🎮 Used in Games:
                    </span>
                    <span className="text-xs font-semibold text-zinc-700">
                      {currentLesson.usage}
                    </span>
                  </div>
                </div>

                {/* Holographic Hand 3D Graphic */}
                <div className="w-full flex flex-col items-center justify-center my-2 py-4 bg-zinc-900 border-2 border-black shadow-neo-sm relative rounded-none">
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 border border-cyan-400/50 text-[10px] font-mono text-cyan-300 uppercase tracking-widest">
                    AI AR SIMULATION
                  </div>
                  <HolographicHand
                    gesture={currentLesson.holoGesture}
                    width={240}
                    height={260}
                    glowColor="#38BDF8"
                    secondaryColor="#818CF8"
                  />
                  <div className="text-[11px] font-mono text-cyan-300 font-bold tracking-wide uppercase mt-1">
                    TARGET: {currentLesson.name}
                  </div>
                </div>

                {/* Helpful Instruction Tip */}
                <div className="mt-4 p-2.5 bg-neo-yellow/30 border border-black/60 font-mono text-xs text-zinc-800 flex items-start gap-2">
                  <span className="text-base">💡</span>
                  <span>{currentLesson.hint}</span>
                </div>
              </div>

              {/* Right Column: Live Camera Practice & Recognition (7 Cols) */}
              <div className="lg:col-span-7 bg-white border-3 border-black p-5 shadow-neo-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse border border-black" />
                      <span className="font-display font-black text-sm uppercase tracking-tight">
                        Live Webcam Practice
                      </span>
                    </div>
                    <span className="font-mono text-xs font-black bg-zinc-100 border border-black px-2 py-0.5">
                      Current: {liveGesture || 'Searching...'}
                    </span>
                  </div>

                  {/* Video Viewport with Mirror and Landmarks */}
                  <div className="relative w-full aspect-video bg-black border-3 border-black shadow-neo-sm overflow-hidden flex items-center justify-center">
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

                    {/* Recognition Success Overlay */}
                    {isSuccessPulsing && (
                      <div className="absolute inset-0 bg-neo-lime/40 backdrop-blur-xs flex flex-col items-center justify-center animate-in zoom-in-95 duration-200">
                        <div className="w-20 h-20 bg-neo-lime border-4 border-black rounded-full shadow-neo flex items-center justify-center text-4xl animate-bounce">
                          ✓
                        </div>
                        <span className="mt-3 px-4 py-1.5 bg-black text-white font-display font-black text-lg uppercase tracking-wider border-2 border-white shadow-neo">
                          PERFECT! NEXT GESTURE...
                        </span>
                      </div>
                    )}

                    {/* Live Match Progress Ring / Bar Overlay */}
                    {!isSuccessPulsing && (
                      <div className="absolute bottom-3 inset-x-3 bg-white/95 backdrop-blur-xs border-2 border-black p-2.5 shadow-neo-sm flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs font-mono font-bold uppercase mb-1">
                            <span>
                              {matchProgress > 0 ? 'Hold Gesture Steady...' : 'Perform Gesture in Frame'}
                            </span>
                            <span className="font-black text-black">{matchProgress}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-zinc-200 border border-black overflow-hidden">
                            <div
                              className="h-full bg-neo-lime transition-all duration-100"
                              style={{ width: `${matchProgress}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center font-black text-sm shrink-0 bg-neo-yellow">
                          {matchProgress >= 100 ? '✓' : currentLesson.emoji}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Navigation Buttons */}
                <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t-2 border-black">
                  <button
                    disabled={lessonIndex === 0}
                    onClick={() => {
                      sounds.playClick();
                      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
                      isAdvancingRef.current = false;
                      holdStartTimeRef.current = null;
                      setIsSuccessPulsing(false);
                      setLessonIndex((prev) => Math.max(0, prev - 1));
                      setMatchProgress(0);
                    }}
                    className={`px-4 py-2 border-2 border-black font-display font-black text-xs uppercase shadow-neo-sm ${
                      lessonIndex === 0
                        ? 'opacity-40 cursor-not-allowed bg-zinc-200'
                        : 'bg-white hover:bg-zinc-100 active:translate-x-0.5 active:translate-y-0.5'
                    }`}
                  >
                    ← Previous
                  </button>

                  {/* Manual advance if user camera has lighting issues */}
                  <button
                    onClick={() => {
                      sounds.playClick();
                      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
                      isAdvancingRef.current = false;
                      holdStartTimeRef.current = null;
                      setIsSuccessPulsing(false);
                      sounds.playSuccess();
                      const nextIdx = lessonIndexRef.current + 1;
                      if (nextIdx < lessons.length) {
                        setLessonIndex(nextIdx);
                        setMatchProgress(0);
                      } else {
                        setIsCompleted(true);
                        completeGlobal();
                        if (targetGameKey) completeGame(targetGameKey);
                        sounds.playFanfare();
                      }
                    }}
                    className="px-5 py-2.5 bg-neo-yellow hover:bg-yellow-300 border-2 border-black font-display font-black text-xs uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform flex items-center gap-2"
                  >
                    <span>Pass Lesson</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── Completion Screen ─────────────────────────────────────────── */
          <div className="w-full max-w-2xl mx-auto bg-white border-4 border-black p-8 shadow-neo-xl text-center animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 mx-auto mb-6 bg-neo-yellow border-4 border-black rounded-3xl shadow-neo flex items-center justify-center text-5xl rotate-3 hover:rotate-0 transition-transform">
              🎉
            </div>

            <div className="inline-block px-3 py-1 bg-neo-lime border-2 border-black font-mono font-black text-xs uppercase tracking-wider mb-4">
              {targetGame ? `${targetGame.name.toUpperCase()} TRAINING COMPLETE` : 'ACADEMY COMPLETED'}
            </div>

            <h1 className="font-display font-black text-3xl sm:text-5xl uppercase tracking-tight mb-3">
              {targetGame ? `Ready for ${targetGame.name}!` : 'You are Gesture Certified!'}
            </h1>

            <p className="text-zinc-700 text-base sm:text-lg font-medium max-w-lg mx-auto mb-8 leading-relaxed">
              {targetGame
                ? `Congratulations! You have mastered all gestures required for ${targetGame.name}. Jump in and set your high score!`
                : 'Congratulations! You have mastered all hand gestures recognized by Gesture Studio vision engine. You are now ready to dominate the games.'}
            </p>

            {/* Achievement Badges Row */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              {lessons.map((l) => (
                <div key={l.id} className="bg-neo-cream border-2 border-black p-3 text-center min-w-[100px]">
                  <span className="text-2xl mb-1 block">{l.emoji}</span>
                  <span className="font-mono font-bold text-[11px] uppercase block">{l.name}</span>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleLaunchGame}
                className="w-full sm:w-auto px-8 py-4 bg-neo-lime hover:bg-lime-400 border-3 border-black font-display font-black text-base uppercase tracking-wider shadow-neo hover:shadow-neo-lg active:translate-x-1 active:translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                <span>{targetGame ? `Launch ${targetGame.name}` : 'Explore Games'}</span>
                <span>➔</span>
              </button>

              <button
                onClick={handleReplay}
                className="w-full sm:w-auto px-6 py-4 bg-white hover:bg-zinc-100 border-3 border-black font-display font-black text-sm uppercase tracking-wider shadow-neo active:translate-x-1 active:translate-y-1 transition-all"
              >
                Replay Lessons ↺
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Skip Confirmation Modal ────────────────────────────────────────── */}
      {showSkipModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black shadow-neo-xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">⚠️</span>
              <h3 className="font-display font-black text-xl uppercase tracking-tight">
                Skip Gesture Academy?
              </h3>
            </div>
            <p className="text-zinc-700 text-sm font-medium mb-6 leading-relaxed">
              Are you sure you want to skip the training? You can replay lessons anytime from the main menu or settings.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  sounds.playClick();
                  setShowSkipModal(false);
                }}
                className="px-4 py-2 bg-white hover:bg-zinc-100 border-2 border-black font-display font-black text-xs uppercase shadow-neo-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSkip}
                className="px-4 py-2 bg-neo-yellow hover:bg-yellow-300 border-2 border-black font-display font-black text-xs uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
              >
                Confirm Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ─────────────────────────────────────────────────── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black shadow-neo-xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <h3 className="font-display font-black text-lg uppercase tracking-tight">
                  Academy & Guide Settings
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-7 h-7 bg-zinc-100 hover:bg-zinc-200 border border-black font-mono font-bold text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Option 1: In-game guide toggle */}
              <label className="flex items-center justify-between p-3 bg-neo-cream border-2 border-black cursor-pointer">
                <div>
                  <span className="font-display font-black text-xs uppercase block text-black">
                    Show Floating In-Game Guide
                  </span>
                  <span className="text-[11px] text-zinc-600 font-medium">
                    Displays brief gesture hints when launching any game.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showGuide}
                  onChange={(e) => {
                    sounds.playClick();
                    settings.setShowGuide(e.target.checked);
                  }}
                  className="w-5 h-5 accent-black border-2 border-black"
                />
              </label>

              {/* Option 2: Don't show tutorial again */}
              <label className="flex items-center justify-between p-3 bg-neo-cream border-2 border-black cursor-pointer">
                <div>
                  <span className="font-display font-black text-xs uppercase block text-black">
                    Don't Show Tutorials Again
                  </span>
                  <span className="text-[11px] text-zinc-600 font-medium">
                    Automatically bypasses Academy when clicking game cards.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.dontShow}
                  onChange={(e) => {
                    sounds.playClick();
                    settings.setDontShow(e.target.checked);
                  }}
                  className="w-5 h-5 accent-black border-2 border-black"
                />
              </label>

              {/* Action: Reset tutorial progress */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    sounds.playClick();
                    resetAll();
                    alert('Tutorial progress has been reset for all games.');
                    setShowSettingsModal(false);
                  }}
                  className="w-full py-2.5 bg-red-100 hover:bg-red-200 border-2 border-black font-display font-black text-xs uppercase text-red-700 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
                >
                  Reset All Tutorial Progress ↺
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  sounds.playClick();
                  setShowSettingsModal(false);
                }}
                className="px-4 py-2 bg-black text-white font-display font-black text-xs uppercase border-2 border-black shadow-neo-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

