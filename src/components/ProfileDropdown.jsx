/**
 * ProfileDropdown — Desktop profile button with dropdown menu.
 * Shows username, streak, and navigation links.
 * Hidden on mobile (bottom nav handles navigation there).
 */
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlayer } from '../hooks/usePlayer';
import AuthModal from './AuthModal';
import DailyRewardModal from './DailyRewardModal';

export default function ProfileDropdown() {
  const { currentUser, isGuest, logout } = useAuth();
  const { playerData, xpInfo, dailyRewardClaimed } = usePlayer();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const dropRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const username = playerData?.username || currentUser?.displayName || (isGuest ? `Guest_${currentUser?.uid?.slice(-4) || '0000'}` : 'Player');
  const streak = playerData?.currentGameStreak || 0;
  const avatar = playerData?.avatar || (isGuest ? '👤' : '⭐');

  const handleLogout = async () => {
    setOpen(false);
    await logout();
  };

  // Not logged in
  if (!currentUser) {
    return (
      <>
        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
        <button
          onClick={() => setShowAuth(true)}
          className="px-3 py-1 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-black text-xs uppercase flex items-center gap-1.5 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
        >
          <span>🔑</span>
          <span className="hidden sm:inline">SIGN IN</span>
        </button>
      </>
    );
  }

  return (
    <>
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
      <DailyRewardModal isOpen={showReward} onClose={() => setShowReward(false)} />

      <div className="relative" ref={dropRef}>
        {/* Trigger button */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="px-3 py-1 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-black text-xs uppercase flex items-center gap-1.5 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform"
        >
          <span>{avatar}</span>
          <span className="hidden sm:inline max-w-[80px] truncate">{username}</span>
          {streak > 0 && (
            <span className="bg-amber-300 px-1 border border-black text-[10px] hidden sm:inline">
              🔥 {streak}D
            </span>
          )}
          {/* Daily reward indicator */}
          {!dailyRewardClaimed && (
            <span className="w-2 h-2 bg-neo-pink rounded-full border border-black animate-pulse" />
          )}
          <span className="text-[10px] text-zinc-400">▾</span>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden z-50 animate-fade-in">
            {/* User header */}
            <div className="px-3 py-2.5 bg-neo-yellow border-b-2 border-black">
              <p className="font-display font-black text-sm uppercase truncate">{username}</p>
              <p className="text-[10px] font-mono text-zinc-700">
                {isGuest ? '👤 Guest Account' : `LV ${xpInfo?.level || 1} · ${xpInfo?.xpIntoLevel || 0} XP`}
              </p>
            </div>

            {/* Menu items */}
            {[
              { to: '/profile', icon: '👤', label: 'MY PROFILE' },
              { to: '/leaderboard', icon: '🏆', label: 'LEADERBOARDS' },
              { to: '/achievements', icon: '🥇', label: 'ACHIEVEMENTS' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-neo-yellow/40 border-b border-black/10 text-xs font-mono font-black uppercase transition-colors"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}

            {/* Daily Reward */}
            <button
              onClick={() => { setOpen(false); setShowReward(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-neo-yellow/40 border-b border-black/10 text-xs font-mono font-black uppercase transition-colors"
            >
              <span>🎁</span>
              <span>DAILY REWARD</span>
              {!dailyRewardClaimed && (
                <span className="ml-auto bg-neo-pink border border-black px-1 py-0.5 text-[9px] animate-pulse">
                  READY!
                </span>
              )}
              {dailyRewardClaimed && (
                <span className="ml-auto text-neo-lime text-[10px]">✓</span>
              )}
            </button>

            {/* Settings */}
            <Link
              to="/profile?tab=settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-neo-yellow/40 border-b border-black/10 text-xs font-mono font-black uppercase transition-colors"
            >
              <span>⚙️</span>
              <span>SETTINGS</span>
            </Link>

            {/* Upgrade if guest */}
            {isGuest && (
              <button
                onClick={() => { setOpen(false); setShowAuth(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-neo-lime/40 border-b border-black/10 text-xs font-mono font-black uppercase transition-colors text-green-700"
              >
                <span>🔗</span>
                <span>SAVE PROGRESS</span>
              </button>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-red-50 text-xs font-mono font-black uppercase transition-colors text-red-600"
            >
              <span>🚪</span>
              <span>LOG OUT</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

