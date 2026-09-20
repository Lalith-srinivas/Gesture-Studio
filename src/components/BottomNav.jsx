/**
 * BottomNav — Fixed bottom navigation for mobile screens.
 * Only visible on mobile (hidden on md+).
 * Neo-Brutalist design matching Gesture Studio.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/',              label: 'HOME',    icon: '🏠' },
  { path: '/leaderboard',  label: 'RANKINGS', icon: '🏆' },
  { path: '/gesture-academy', label: 'ACADEMY', icon: '🎓' },
  { path: '/profile',      label: 'PROFILE',  icon: '👤' },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t-3 border-black bg-white shadow-[0_-4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-stretch h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === '/'
              ? pathname === '/'
              : pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex-1 flex flex-col items-center justify-center gap-0.5 text-center
                transition-colors select-none touch-manipulation
                ${isActive
                  ? 'bg-neo-yellow border-r border-l border-black/20'
                  : 'hover:bg-zinc-50 active:bg-neo-yellow/50'
                }
              `}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className={`text-[9px] font-mono font-black uppercase tracking-wider leading-none ${isActive ? 'text-black' : 'text-zinc-500'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

