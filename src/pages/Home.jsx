import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="w-full min-h-screen flex flex-col items-center py-12 md:justify-center bg-[#0a0a0f] text-white overflow-x-hidden overflow-y-auto relative font-sans">
      
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-600/20 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="z-10 text-center mb-10 md:mb-16 px-4">
        <h1 className="text-[clamp(2.5rem,8vw,4rem)] font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-sky-400 drop-shadow-sm leading-tight">
          Gesture Studio
        </h1>
        <p className="text-zinc-400 text-base md:text-xl max-w-lg mx-auto font-medium">
          Explore interactive, real-time hand tracking experiences right in your browser.
        </p>
      </div>

      <div className="z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 px-6 max-w-7xl w-full">
        
        {/* Air Draw Card */}
        <Link 
          to="/air-draw"
          className="group relative flex flex-col items-center justify-center p-8 py-12 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)] hover:border-violet-500/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-3xl shadow-lg shadow-violet-500/25 group-hover:scale-110 transition-transform duration-500">
            🎨
          </div>
          <h2 className="text-xl font-bold mb-2 group-hover:text-violet-300 transition-colors">Air Draw</h2>
          <p className="text-zinc-400 text-center text-xs font-medium">
            Draw in the air using your finger and hand gestures.
          </p>
        </Link>

        {/* Fruit Ninja Card */}
        <Link 
          to="/fruit-ninja"
          className="group relative flex flex-col items-center justify-center p-8 py-12 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_40px_-10px_rgba(14,165,233,0.3)] hover:border-sky-500/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center text-3xl shadow-lg shadow-sky-500/25 group-hover:scale-110 transition-transform duration-500">
            🍉
          </div>
          <h2 className="text-xl font-bold mb-2 group-hover:text-sky-300 transition-colors">Fruit Ninja</h2>
          <p className="text-zinc-400 text-center text-xs font-medium">
            Slice fruits in mid-air using hand tracking.
          </p>
        </Link>

        {/* Hill Climb Card */}
        <Link 
          to="/hill-climb"
          className="group relative flex flex-col items-center justify-center p-8 py-12 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_40px_-10px_rgba(245,158,11,0.3)] hover:border-amber-500/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/25 group-hover:scale-110 transition-transform duration-500">
            🏎️
          </div>
          <h2 className="text-xl font-bold mb-2 group-hover:text-amber-300 transition-colors">Hill Climb</h2>
          <p className="text-zinc-400 text-center text-xs font-medium">
            Drive and lean using gestures. Use Nitro to climb!
          </p>
        </Link>
        
        {/* Flappy Bird Card */}
        <Link 
          to="/flappy-bird"
          className="group relative flex flex-col items-center justify-center p-8 py-12 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_40px_-10px_rgba(250,204,21,0.3)] hover:border-yellow-500/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-3xl shadow-lg shadow-yellow-500/25 group-hover:scale-110 transition-transform duration-500">
            🐦
          </div>
          <h2 className="text-xl font-bold mb-2 group-hover:text-yellow-300 transition-colors">Flappy Bird</h2>
          <p className="text-zinc-400 text-center text-xs font-medium">
            Flap your way through pipes with a pinch!
          </p>
        </Link>
        
        {/* Mob Control Card */}
        <Link 
          to="/mob-control"
          className="group relative flex flex-col items-center justify-center p-8 py-12 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_40px_-10px_rgba(236,72,153,0.3)] hover:border-pink-500/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-3xl shadow-lg shadow-pink-500/25 group-hover:scale-110 transition-transform duration-500">
            👥
          </div>
          <h2 className="text-xl font-bold mb-2 group-hover:text-pink-300 transition-colors">Mob Control</h2>
          <p className="text-zinc-400 text-center text-xs font-medium">
            Guide the crowd through multiplier gates!
          </p>
        </Link>

      </div>
    </div>
  );
}
