import { Link } from 'react-router-dom';

const GAMES = [
  {
    to: '/air-draw',
    emoji: '🎨',
    tag: 'CREATIVE LAB',
    title: 'Air Draw',
    desc: 'Draw and sketch in mid-air using your index finger. Features custom colors, glow mode, and PNG export.',
    bg: 'bg-[#E9D5FF]',
    accent: 'bg-[#A855F7]',
    badgeBg: 'bg-[#C084FC]',
    buttonBg: 'bg-[#9333EA] hover:bg-[#7E22CE] text-white',
    badgeText: 'text-black',
  },
  {
    to: '/fruit-ninja',
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
    to: '/mob-control',
    emoji: '👥',
    tag: 'STRATEGY CROWD',
    title: 'Mob Control',
    desc: 'Direct your crowd through multiplier gates (+10, ×2, ×3) and conquer enemy battle zones in slow-mo!',
    bg: 'bg-[#BAE6FD]',
    accent: 'bg-[#38BDF8]',
    badgeBg: 'bg-[#7DD3FC]',
    buttonBg: 'bg-[#0284C7] hover:bg-[#0369A1] text-white',
    badgeText: 'text-black',
  },
  {
    to: '/archery',
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
];

const GESTURE_GUIDES = [
  { emoji: '☝️', name: 'Index Point', use: 'Air Draw · Traffic Lane 1 · Move' },
  { emoji: '✌️', name: 'Peace Sign', use: 'Erase Mode · Traffic Lane 2 · Left' },
  { emoji: '🤟', name: 'Rock Sign', use: 'Traffic Lane 3 · Aim Action' },
  { emoji: '🤏', name: 'Pinch Finger', use: 'Click · Flap Bird · Draw Bow' },
  { emoji: '✊', name: 'Closed Fist', use: 'Nitro Boost · Cancel Bow Aim' },
];

export default function Home() {
  return (
    <div className="w-full min-h-screen bg-neo-dots text-black flex flex-col font-sans selection:bg-neo-yellow selection:text-black">
      
      {/* ── Top Neo Marquee Ticker ────────────────────────────────────────── */}
      <div className="w-full bg-neo-yellow border-b-3 border-black py-2.5 overflow-hidden flex items-center shadow-neo-sm select-none z-20">
        <div className="flex whitespace-nowrap animate-marquee font-mono font-black text-xs md:text-sm tracking-wider uppercase">
          <span className="mx-4">⚡ GESTURE STUDIO ⚡</span>
          <span className="mx-4">✦ REAL-TIME AI HAND TRACKING ✦</span>
          <span className="mx-4">🎮 100% IN-BROWSER</span>
          <span className="mx-4">🚫 NO CONTROLLER REQUIRED</span>
          <span className="mx-4">🎨 AIR DRAW</span>
          <span className="mx-4">🍉 FRUIT NINJA</span>
          <span className="mx-4">🏎️ CRAZY ROAD</span>
          <span className="mx-4">🐦 FLAPPY BIRD</span>
          <span className="mx-4">👥 MOB CONTROL</span>
          <span className="mx-4">🏹 ARCHERY CHALLENGE</span>
          <span className="mx-4">⚡ GESTURE STUDIO ⚡</span>
          <span className="mx-4">✦ REAL-TIME AI HAND TRACKING ✦</span>
          <span className="mx-4">🎮 100% IN-BROWSER</span>
          <span className="mx-4">🚫 NO CONTROLLER REQUIRED</span>
          <span className="mx-4">🎨 AIR DRAW</span>
          <span className="mx-4">🍉 FRUIT NINJA</span>
          <span className="mx-4">🏎️ CRAZY ROAD</span>
          <span className="mx-4">🐦 FLAPPY BIRD</span>
          <span className="mx-4">👥 MOB CONTROL</span>
          <span className="mx-4">🏹 ARCHERY CHALLENGE</span>
        </div>
      </div>

      {/* ── Main Container ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex-1 flex flex-col items-center">
        
        {/* ── Hero Section ────────────────────────────────────────────────── */}
        <div className="w-full max-w-4xl text-center mb-10 md:mb-14 relative flex flex-col items-center">
          
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border-2 border-black shadow-neo-sm font-mono text-xs md:text-sm font-bold uppercase tracking-wider mb-6 rotate-[-1deg] hover:rotate-0 transition-transform">
            <span className="w-2.5 h-2.5 rounded-full bg-neo-lime border border-black animate-pulse" />
            <span>VISION AI · WEBCAM POWERED</span>
            <span className="bg-neo-pink px-1.5 py-0.2 border border-black text-[10px]">v2.0</span>
          </div>

          {/* Main Title */}
          <div className="relative inline-block mb-4">
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

          <p className="text-zinc-800 text-base sm:text-xl font-medium max-w-2xl mt-2 leading-relaxed">
            Turn your webcam into an interactive playground. Paint with hand gestures, slice fruits, drive supercars, and battle mobs in thin air.
          </p>

          {/* Feature Quick Chips */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-6">
            <span className="neo-tag bg-white">📸 Zero Install</span>
            <span className="neo-tag bg-neo-yellowLight">⚡ Ultra Low Latency</span>
            <span className="neo-tag bg-neo-cyanLight">🔒 100% Client-Side Privacy</span>
            <span className="neo-tag bg-neo-pinkLight">🖱️ Air Cursor Enabled</span>
          </div>
        </div>

        {/* ── Games Grid ──────────────────────────────────────────────────── */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-14">
          {GAMES.map((game, idx) => (
            <Link
              key={game.to}
              to={game.to}
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
        </div>

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
            <span className="neo-tag bg-neo-lime text-black">
              READY TO DETECT
            </span>
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
        <footer className="mt-12 text-center text-xs font-mono font-bold text-zinc-600 flex flex-wrap items-center justify-center gap-4">
          <span>⚡ GESTURE STUDIO</span>
          <span>•</span>
          <span>BUILT WITH REACT 19 & TAILWIND</span>
          <span>•</span>
          <span>POWERED BY MEDIAPIPE</span>
        </footer>

      </div>
    </div>
  );
}
