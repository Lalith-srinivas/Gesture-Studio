import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import { useGestureAcademy } from '../hooks/useGestureAcademy';
import AuthModal from '../components/AuthModal';
import ProfileDropdown from '../components/ProfileDropdown';
import AdSlot from '../components/ads/AdSlot';

const GAMES = [
  {
    to: '/fruit-ninja',
    id: 'fruit-ninja',
    emoji: '🍉',
    tag: 'ARCADE SLICE',
    title: 'Fruit Ninja',
    desc: 'Slice juicy airborne fruits in real-time with finger swipes. Avoid bombs and trigger slow-motion combos!',
    bg: 'bg-[#FECDD3]',
    accent: 'bg-[#FB7185]',
    badgeBg: 'bg-[#FDA4AF]',
    buttonBg: 'bg-[#E11D48] hover:bg-[#BE123C] text-white',
    badgeText: 'text-black',
  },
  {
    to: '/hill-climb',
    id: 'hill-climb',
    emoji: '🏎️',
    tag: 'HIGH SPEED',
    title: 'Crazy Road',
    desc: 'Navigate lanes and dodge highway traffic using gestures. Build up charge to unleash nitro boost!',
    bg: 'bg-[#FEF08A]',
    accent: 'bg-[#FACC15]',
    badgeBg: 'bg-[#FDE047]',
    buttonBg: 'bg-[#CA8A04] hover:bg-[#A16207] text-white',
    badgeText: 'text-black',
  },
  {
    to: '/flappy-bird',
    id: 'flappy-bird',
    emoji: '🐦',
    tag: 'RETRO ARCADE',
    title: 'Flappy Bird',
    desc: 'Flap through pipes with pinch gestures or keyboard taps. Aim for the highest high score record!',
    bg: 'bg-[#BBF7D0]',
    accent: 'bg-[#4ADE80]',
    badgeBg: 'bg-[#86EFAC]',
    buttonBg: 'bg-[#16A34A] hover:bg-[#15803D] text-white',
    badgeText: 'text-black',
  },
  {
    to: '/archery',
    id: 'archery',
    emoji: '🏹',
    tag: 'PRECISION BOW',
    title: 'Archery Challenge',
    desc: 'Draw back your bowstring with pinch gestures, aim, and strike moving targets and dynamic powerup bubbles!',
    bg: 'bg-[#FED7AA]',
    accent: 'bg-[#F97316]',
    badgeBg: 'bg-[#FDBA74]',
    buttonBg: 'bg-[#EA580C] hover:bg-[#C2410C] text-white',
    badgeText: 'text-black',
  },
  {
    to: '/bird-hunter',
    id: 'bird-hunter',
    emoji: '🦅',
    tag: 'SLINGSHOT HUNT',
    title: 'Bird Hunter',
    desc: 'Pull back the slingshot with pinch gestures, aim at unpredictable birds, and unleash combo trick shots!',
    bg: 'bg-[#BAE6FD]',
    accent: 'bg-[#38BDF8]',
    badgeBg: 'bg-[#7DD3FC]',
    buttonBg: 'bg-[#0284C7] hover:bg-[#0369A1] text-white',
    badgeText: 'text-black',
  },
  {
    to: '/space-shooter',
    id: 'space-shooter',
    emoji: '🚀',
    tag: 'SPACE ARCADE',
    title: 'Space Shooter',
    desc: 'Survive endless waves of galactic invaders! Steer with your index finger, trigger EMP blasts with pinch, and conquer the cosmos!',
    bg: 'bg-[#DDD6FE]',
    accent: 'bg-[#A78BFA]',
    badgeBg: 'bg-[#C4B5FD]',
    buttonBg: 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white',
    badgeText: 'text-black',
  },
];

const COMING_SOON_GAMES = [
  {
    id: 'gesture-boxing',
    emoji: '🥊',
    tag: 'Action',
    title: 'Gesture Boxing',
    desc: 'Punch / dodge / block — duck, slip, and throw lightning jabs with real-time motion tracking in arcade boxing duels!',
    bg: 'bg-[#FFE4E6]',
    badgeBg: 'bg-[#FECDD3]',
    badgeText: 'text-black',
  },
  {
    id: 'stack-cut',
    emoji: '🧱',
    tag: 'Physics / skill',
    title: 'Stack Cut',
    desc: 'Cut rope — slice ropes with swift finger cuts to balance falling blocks and build towering physics stacks!',
    bg: 'bg-[#FED7AA]',
    badgeBg: 'bg-[#FDBA74]',
    badgeText: 'text-black',
  },
  {
    id: 'gesture-gravity',
    emoji: '🌀',
    tag: 'Puzzle / arcade',
    title: 'Gesture Gravity',
    desc: 'Control gravity — invert and bend gravitational fields with hand gestures to navigate mind-bending space puzzles!',
    bg: 'bg-[#E0E7FF]',
    badgeBg: 'bg-[#C7D2FE]',
    badgeText: 'text-black',
  },
];

const GESTURE_GUIDES = [
  { emoji: '☝️', name: 'Index Point', use: 'Fruit Ninja · Move Ship · Traffic' },
  { emoji: '✌️', name: 'Peace Sign', use: 'Traffic Lane 2 · Left' },
  { emoji: '🤟', name: 'Rock Sign', use: 'Traffic Lane 3 · Pause / Resume' },
  { emoji: '🤏', name: 'Pinch Finger', use: 'EMP Blast · Slingshot · Bow · Flap' },
  { emoji: '✊', name: 'Closed Fist', use: 'Cancel Aim · Nitro Boost' },
];

export default function Home() {
  const { playerData, unseenAchievementsCount } = usePlayer();
  const { isGlobalDone } = useGestureAcademy();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Academy is globally complete if either the hook says so OR playerData confirms it
  const academyCompleted = isGlobalDone || playerData?.tutorialCompleted === true;

  return (
    <div className="w-full min-h-screen bg-neo-dots text-black flex flex-col font-sans selection:bg-neo-yellow selection:text-black overflow-x-hidden">
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      
      {/* ── Top Neo Marquee Ticker & Auth Action ───────────────────────────── */}
      <div className="w-full bg-neo-yellow border-b-3 border-black py-2 flex items-center justify-between px-3 shadow-neo-sm select-none relative z-30">
        <Link to="/" className="flex items-center gap-2 mr-3 shrink-0 group">
          <img
            src="/gesturestudio.png"
            alt="Gesture Studio Logo"
            className="w-7 h-7 object-contain filter drop-shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] group-hover:scale-110 transition-transform"
          />
          <span className="font-display font-black text-xs md:text-sm uppercase tracking-tight hidden lg:inline text-black">
            GESTURE STUDIO
          </span>
        </Link>

        <div className="flex-1 overflow-hidden">
          <div className="flex whitespace-nowrap animate-marquee font-mono font-black text-xs md:text-sm tracking-wider uppercase">
            <span className="mx-4">⚡ GESTURE STUDIO ⚡</span>
            <span className="mx-4">🎓 GESTURE ACADEMY ONLINE</span>
            <span className="mx-4">✦ REAL-TIME AI HAND TRACKING ✦</span>
            <span className="mx-4">🎮 100% IN-BROWSER</span>
            <span className="mx-4">🚫 NO CONTROLLER REQUIRED</span>
            <span className="mx-4">🍉 FRUIT NINJA</span>
            <span className="mx-4">🏎️ CRAZY ROAD</span>
            <span className="mx-4">🐦 FLAPPY BIRD</span>
            <span className="mx-4">🏹 ARCHERY CHALLENGE</span>
            <span className="mx-4">🦅 BIRD HUNTER</span>
            <span className="mx-4">🚀 SPACE SHOOTER</span>
            <span className="mx-4">🥊 GESTURE BOXING (COMING SOON)</span>
            <span className="mx-4">🧱 STACK CUT (COMING SOON)</span>
            <span className="mx-4">🌀 GESTURE GRAVITY (COMING SOON)</span>
          </div>
        </div>

        {/* Top Actions: Gesture Academy, Leaderboards, Achievements & Profile Dropdown */}
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <Link
            to="/gesture-academy"
            className="px-2.5 sm:px-3 py-1 bg-[#818CF8] hover:bg-[#6366F1] text-white border-2 border-black font-mono font-black text-xs uppercase flex items-center gap-1.5 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
          >
            <span>🎓</span>
            <span className="hidden sm:inline">Academy</span>
          </Link>

          <Link
            to="/leaderboard"
            className="px-2.5 sm:px-3 py-1 bg-neo-yellow hover:bg-yellow-400 text-black border-2 border-black font-mono font-black text-xs uppercase flex items-center gap-1.5 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
          >
            <span>🏆</span>
            <span className="hidden sm:inline">Leaderboard</span>
          </Link>

          <Link
            to="/achievements"
            className="relative px-2.5 sm:px-3 py-1 bg-[#FDE047] hover:bg-yellow-300 text-black border-2 border-black font-mono font-black text-xs uppercase flex items-center gap-1.5 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            title="Achievements"
          >
            <span>🥇</span>
            <span className="hidden sm:inline">Achievements</span>
            {unseenAchievementsCount > 0 && (
              <span className="absolute -top-2.5 -right-2 bg-red-500 text-white border-2 border-black rounded-full min-w-[19px] h-[19px] px-1 flex items-center justify-center font-mono font-black text-[9px] shadow-sm animate-bounce z-20">
                {unseenAchievementsCount > 99 ? '99+' : unseenAchievementsCount}
              </span>
            )}
          </Link>

          <ProfileDropdown />
        </div>
      </div>

      {/* ── Main Container ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex-1 flex flex-col items-center pb-28 md:pb-12 overflow-x-hidden">
        
        {/* ── Hero Section ────────────────────────────────────────────────── */}
        <div className="w-full max-w-4xl text-center mb-10 md:mb-12 relative flex flex-col items-center">
          
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-white border-2 border-black shadow-neo-sm font-mono text-[11px] sm:text-xs md:text-sm font-bold uppercase tracking-wider mb-6 rotate-[-1deg] hover:rotate-0 transition-transform max-w-full">
            <span className="w-2.5 h-2.5 rounded-full bg-neo-lime border border-black animate-pulse" />
            <span>VISION AI · WEBCAM POWERED</span>
            <span className="bg-neo-pink px-1.5 py-0.2 border border-black text-[10px]">v2.0</span>
          </div>

          {/* Main Title & Brand Logo Icon */}
          <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-4">
            <img
              src="/gesturestudio.png"
              alt="Gesture Studio Logo"
              className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 object-contain filter drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:rotate-6 hover:scale-105 transition-all duration-200"
            />
            <div className="relative inline-block text-center sm:text-left">
              <h1 className="font-display font-black text-4xl sm:text-6xl md:text-7xl tracking-tight uppercase leading-[0.95] text-black">
                Gesture Studio
              </h1>
              
              {/* Sticker Badges */}
              <div className="hidden sm:block absolute -top-4 -right-10 bg-neo-cyan px-3 py-1 border-2 border-black shadow-neo-sm font-mono font-black text-xs uppercase rotate-12">
                TOUCHLESS! ✋
              </div>
              <div className="hidden sm:block absolute -bottom-3 -left-8 bg-neo-yellow px-3 py-1 border-2 border-black shadow-neo-sm font-mono font-black text-xs uppercase -rotate-6">
                AI MAGIC ✨
              </div>
            </div>
          </div>

          <p className="text-zinc-800 text-base sm:text-xl font-medium max-w-2xl mt-2 leading-relaxed">
            Turn your webcam into an interactive playground. Paint with hand gestures, slice fruits, drive supercars, and battle mobs in thin air.
          </p>

          {/* Feature Quick Chips */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-6">
            <span className="neo-tag bg-white">📸 Zero Install</span>
            <span className="neo-tag bg-neo-yellowLight">⚡ Ultra Low Latency</span>
            <span className="neo-tag bg-neo-cyanLight">🔒 100% Client-Side Privacy</span>
            <span className="hidden md:inline-flex neo-tag bg-neo-pinkLight">🖱️ Air Cursor Enabled</span>
            <span className="inline-flex md:hidden neo-tag bg-neo-pinkLight">📱 Touch &amp; Gesture Ready</span>
          </div>
        </div>

        {/* ── Featured Gesture Academy Hero Card ──────────────────────────── */}
        <div className="w-full mb-12 bg-[#E0E7FF] border-3 md:border-4 border-black p-6 sm:p-8 shadow-neo-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group hover:shadow-neo-xl transition-all">
          {/* Subtle Decorative AR background text */}
          <div className="absolute -bottom-6 -right-6 font-display font-black text-8xl text-indigo-200/40 select-none pointer-events-none uppercase">
            ACADEMY
          </div>

          <div className="flex-1 relative z-10">
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <span className="neo-tag bg-[#A5B4FC] text-black font-black">
                NEW SYSTEM
              </span>
              <span className="neo-tag bg-white text-black font-mono">
                7 INTERACTIVE LESSONS
              </span>
              {academyCompleted ? (
                <span className="bg-neo-lime px-2 py-0.5 border-2 border-black font-mono font-black text-[10px] uppercase flex items-center gap-1 shadow-neo-xs">
                  ✅ COMPLETED
                </span>
              ) : (
                <span className="bg-neo-yellow px-2 py-0.5 border border-black font-mono font-black text-[10px] uppercase animate-pulse">
                  RECOMMENDED FIRST
                </span>
              )}
            </div>

            <h2 className="font-display font-black text-2xl sm:text-4xl text-black uppercase tracking-tight mb-2 flex items-center gap-2.5">
              <span>Gesture Academy</span>
              <span className="text-3xl">🎓</span>
            </h2>

            <p className="text-zinc-800 text-sm sm:text-base font-medium max-w-2xl leading-relaxed mb-4">
              Learn hand gestures before playing games. Master index point, pinch, peace sign, open palm, and fist controls with real-time AI computer vision and futuristic holographic feedback.
            </p>

            {/* Quick Gesture Pills */}
            <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
              <span className="bg-white border border-black px-2 py-1 shadow-neo-xs">☝️ Point</span>
              <span className="bg-white border border-black px-2 py-1 shadow-neo-xs">✌️ Peace</span>
              <span className="bg-white border border-black px-2 py-1 shadow-neo-xs">🤏 Pinch</span>
              <span className="bg-white border border-black px-2 py-1 shadow-neo-xs">✋ Palm</span>
              <span className="bg-white border border-black px-2 py-1 shadow-neo-xs">✊ Fist</span>
              <span className="bg-white border border-black px-2 py-1 shadow-neo-xs">👈 Left</span>
              <span className="bg-white border border-black px-2 py-1 shadow-neo-xs">👉 Right</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0 relative z-10">
            <Link
              to="/gesture-academy"
              className={`px-8 py-4 text-white border-3 border-black font-display font-black text-sm sm:text-base uppercase tracking-wider shadow-neo hover:shadow-neo-lg active:translate-x-1 active:translate-y-1 transition-all flex items-center justify-center gap-2 text-center ${
                academyCompleted
                  ? 'bg-[#16A34A] hover:bg-[#15803D]'
                  : 'bg-[#6366F1] hover:bg-[#4F46E5]'
              }`}
            >
              <span>{academyCompleted ? 'REVISIT ACADEMY' : 'ENTER ACADEMY'}</span>
              <span className="text-lg">➔</span>
            </Link>
            <span className="text-center font-mono text-[11px] font-bold text-zinc-600">
              {academyCompleted ? '✅ Certification earned!' : '⚡ 2-minute quick certification'}
            </span>
          </div>
        </div>

        {/* ── Responsive Ad Slot (Controlled height, zero CLS) ───────────── */}
        <div className="w-full flex justify-center mb-8">
          <AdSlot placement="home" format="responsive" className="max-w-4xl" />
        </div>

        {/* ── Games Grid ──────────────────────────────────────────────────── */}
        <nav aria-label="Popular Games Directory" id="games" className="w-full mb-14">
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {GAMES.map((game) => (
              <Link
                key={game.to}
                to={game.to}
                title={`Play ${game.title} Online - Gesture Studio`}
                aria-label={`Play ${game.title} - ${game.desc}`}
                className={`
                  group relative flex flex-col justify-between p-6 md:p-7
                  border-3 md:border-4 border-black ${game.bg} shadow-neo-lg
                  transition-all duration-200
                  hover:-translate-x-1 hover:-translate-y-1 hover:shadow-neo-xl
                  active:translate-x-1 active:translate-y-1 active:shadow-neo-sm
                  overflow-hidden
                `}
              >
                {/* Top Row: Tag & Emoji Icon */}
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className={`neo-tag ${game.badgeBg} ${game.badgeText}`}>
                      {game.tag}
                    </span>
                    <div className="w-12 h-12 rounded-xl bg-white border-2 border-black shadow-neo-sm flex items-center justify-center text-2xl group-hover:scale-110 group-hover:rotate-6 transition-transform">
                      {game.emoji}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h2 className="font-display font-black text-2xl md:text-3xl text-black uppercase tracking-tight mb-2">
                    {game.title}
                  </h2>
                  <p className="text-zinc-800 text-sm font-medium leading-normal mb-6">
                    {game.desc}
                  </p>
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  <div className={`
                    w-full py-3 px-4 rounded-none font-display font-black text-sm uppercase tracking-wider
                    border-2 border-black shadow-neo-sm flex items-center justify-between
                    ${game.buttonBg} transition-all group-hover:shadow-neo
                  `}>
                    <span>LAUNCH APP</span>
                    <span className="text-lg group-hover:translate-x-1 transition-transform">➔</span>
                  </div>
                </div>
              </Link>
            ))}

            {/* ── Coming Soon Games ─────────────────────────────────────── */}
            {COMING_SOON_GAMES.map((game) => (
              <div
                key={game.id}
                className={`
                  group relative flex flex-col justify-between p-6 md:p-7
                  border-3 md:border-4 border-black ${game.bg} shadow-neo-lg
                  transition-all duration-200
                  hover:-translate-x-1 hover:-translate-y-1 hover:shadow-neo-xl
                  overflow-hidden select-none
                `}
              >
                {/* Coming Soon Corner Ribbon */}
                <div className="absolute top-3 right-[-32px] w-28 bg-black text-neo-yellow border-y border-black text-[9px] font-mono font-black uppercase tracking-widest text-center py-0.5 rotate-45 pointer-events-none shadow-sm">
                  SOON
                </div>

                {/* Top Row: Tag & Emoji Icon */}
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`neo-tag ${game.badgeBg} ${game.badgeText}`}>
                        {game.tag}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-black uppercase border-2 border-black bg-neo-yellow text-black shadow-[1.5px_1.5px_0px_#000]">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                        COMING SOON
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white border-2 border-black shadow-neo-sm flex items-center justify-center text-2xl group-hover:scale-110 group-hover:rotate-6 transition-transform">
                      {game.emoji}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h2 className="font-display font-black text-2xl md:text-3xl text-black uppercase tracking-tight mb-2">
                    {game.title}
                  </h2>
                  <p className="text-zinc-800 text-sm font-medium leading-normal mb-6">
                    {game.desc}
                  </p>
                </div>

                {/* Action Button: Disabled / Coming Soon */}
                <div className="pt-2">
                  <div className="
                    w-full py-3 px-4 rounded-none font-display font-black text-sm uppercase tracking-wider
                    border-2 border-black shadow-neo-sm flex items-center justify-between
                    bg-zinc-900 text-zinc-300 cursor-not-allowed
                  ">
                    <span className="flex items-center gap-2">
                      <span>🔒</span>
                      <span>COMING SOON</span>
                    </span>
                    <span className="text-[11px] font-mono font-bold text-neo-yellow uppercase tracking-widest">
                      IN LABS
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* ── Gesture Cheat-Sheet ─────────────────────────────────────────── */}
        <div className="w-full max-w-5xl bg-white border-3 md:border-4 border-black shadow-neo-lg p-6 sm:p-8 relative">
          
          {/* Header Accent */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-3 border-black pb-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-neo-yellow border-2 border-black shadow-neo-sm flex items-center justify-center font-black text-sm">
                🎮
              </span>
              <div>
                <h3 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight">
                  Universal Gesture Guide
                </h3>
                <p className="text-xs font-mono text-zinc-600 font-semibold">
                  Recognized by the built-in MediaPipe AI model
                </p>
              </div>
            </div>
            <Link
              to="/gesture-academy"
              className="neo-tag bg-neo-lime hover:bg-lime-400 text-black border-2 border-black font-black flex items-center gap-1.5 shadow-neo-xs transition-colors"
            >
              <span>🎓 OPEN ACADEMY</span>
              <span>➔</span>
            </Link>
          </div>

          {/* Gesture Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {GESTURE_GUIDES.map((g) => (
              <div
                key={g.name}
                className="bg-neo-cream border-2 border-black shadow-neo-sm p-3.5 flex flex-col items-center text-center transition-transform hover:-translate-y-0.5"
              >
                <span className="text-3xl mb-1.5 filter drop-shadow-sm">{g.emoji}</span>
                <span className="font-display font-black text-xs sm:text-sm uppercase tracking-tight text-black mb-1">
                  {g.name}
                </span>
                <span className="font-mono text-[11px] text-zinc-700 leading-tight font-medium">
                  {g.use}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="mt-12 text-center text-xs font-mono font-bold text-zinc-600 flex flex-wrap items-center justify-center gap-4 select-none">
          <div className="flex items-center gap-2">
            <img src="/gesturestudio.png" alt="Gesture Studio" className="w-5 h-5 object-contain" />
            <span>GESTURE STUDIO</span>
          </div>
          <span>•</span>
          <Link
            to="/privacy-policy"
            onClick={() => {
              window.scrollTo(0, 0);
              const r = document.getElementById('root');
              if (r) r.scrollTop = 0;
            }}
            className="hover:text-black hover:underline transition-colors"
          >
            PRIVACY POLICY
          </Link>
          <span>•</span>
          <Link
            to="/terms"
            onClick={() => {
              window.scrollTo(0, 0);
              const r = document.getElementById('root');
              if (r) r.scrollTop = 0;
            }}
            className="hover:text-black hover:underline transition-colors"
          >
            TERMS OF USE
          </Link>
          <span>•</span>
          <span>BUILT WITH REACT 19 & TAILWIND</span>
          <span>•</span>
          <span>POWERED BY MEDIAPIPE</span>
        </footer>

      </div>
    </div>
  );
}
