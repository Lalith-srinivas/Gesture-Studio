/**
 * LevelUpModal — Celebration modal shown when player levels up.
 * Shown AFTER game ends, not during active gameplay.
 * Auto-dismisses after 4 seconds.
 */
import React, { useEffect } from 'react';

export default function LevelUpModal({ levelUpData, onClose }) {
  useEffect(() => {
    if (!levelUpData) return;
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [levelUpData, onClose]);

  if (!levelUpData) return null;
  const { level, prevLevel } = levelUpData;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative bg-neo-yellow border-4 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rounded-2xl p-8 max-w-sm w-full text-center">
        {/* Confetti dots */}
        <div className="absolute -top-3 -left-3 w-6 h-6 bg-neo-pink border-2 border-black rounded-full" />
        <div className="absolute -top-3 -right-3 w-6 h-6 bg-neo-cyan border-2 border-black rounded-full" />
        <div className="absolute -bottom-3 -left-3 w-5 h-5 bg-neo-lime border-2 border-black rounded-full" />
        <div className="absolute -bottom-3 -right-3 w-5 h-5 bg-neo-purple border-2 border-black rounded-full" />

        <div className="text-5xl mb-3 animate-bounce">🎉</div>

        <div className="inline-block bg-black text-neo-yellow px-4 py-1 font-mono font-black text-xs uppercase mb-3">
          LEVEL UP!
        </div>

        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-3xl font-black text-black/40 line-through">{prevLevel}</span>
          <span className="text-5xl">→</span>
          <span className="text-6xl font-display font-black text-black">{level}</span>
        </div>

        <p className="font-mono font-bold text-sm text-zinc-700 mb-5">
          You've reached <span className="text-black font-black">Level {level}</span>! Keep playing to unlock more rewards.
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 bg-black text-neo-yellow border-2 border-black font-display font-black text-sm uppercase hover:bg-zinc-800 active:translate-y-0.5 transition-all shadow-neo-sm"
        >
          AWESOME! ✨
        </button>

        <p className="text-[10px] font-mono text-zinc-600 mt-2">Auto-closes in a few seconds</p>
      </div>
    </div>
  );
}

