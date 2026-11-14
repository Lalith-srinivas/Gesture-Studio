import React, { useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * NotFoundPage.jsx
 * Catches all unmatched routes with a clean Neo-Brutalist 404 screen,
 * preventing blank pages and soft-404 SEO penalties.
 */
export default function NotFoundPage() {
  useLayoutEffect(() => {
    document.title = '404 - Page Not Found | Gesture Studio';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-neo-dots text-black font-sans selection:bg-neo-yellow selection:text-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border-4 border-black p-8 shadow-neo-xl text-center space-y-4">
        {/* Top Tag */}
        <div className="inline-block px-3 py-1 bg-neo-pink border-2 border-black font-mono font-black text-xs uppercase shadow-neo-xs rotate-[-2deg]">
          HTTP ERROR 404
        </div>

        <h1 className="font-display font-black text-6xl sm:text-7xl uppercase tracking-tight text-black leading-none">
          LOST IN SPACE
        </h1>

        <p className="font-mono text-xs sm:text-sm text-zinc-700 leading-relaxed">
          The coordinate you tracked does not exist or has moved. Return to mission control to continue playing touchless gesture games.
        </p>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            to="/"
            className="neo-btn-primary w-full py-3.5 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <span>🏠 RETURN TO HOME</span>
            <span>➔</span>
          </Link>

          <Link
            to="/gesture-academy"
            className="w-full py-2.5 bg-[#818CF8] hover:bg-[#6366F1] text-white border-2 border-black font-mono font-black text-xs uppercase shadow-neo-xs flex items-center justify-center gap-2"
          >
            <span>🎓 GESTURE ACADEMY</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

