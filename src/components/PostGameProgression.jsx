/**
 * PostGameProgression — Compact progression summary shown after a game ends.
 * Renders inside/below existing game-over UI — does NOT replace it.
 */
import React, { useState } from 'react';
import { useAd } from '../context/AdContext';

export default function PostGameProgression({ result, onClose }) {
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const { showRewardedAd } = useAd();

  if (!result || result.error === 'Duplicate session') return null;

  const { xpEarned, isPersonalBest, prevBest, newLevel, unlockedAchievements = [], currentStreak } = result;

  if (xpEarned === 0 && !isPersonalBest && unlockedAchievements.length === 0) return null;

  const handleClaimBonus = () => {
    showRewardedAd({
      rewardTitle: 'Match Bonus XP',
      rewardDescription: 'Watch a short sponsored message to earn bonus XP for this match!',
      rewardAmount: '+25 XP',
      onRewarded: () => {
        setBonusClaimed(true);
      },
    });
  };

  return (
    <div className="mt-3 bg-zinc-900 border-3 border-neo-yellow p-4 rounded-xl text-white">
      <div className="text-[10px] font-mono font-black uppercase tracking-wider text-neo-yellow mb-3 flex items-center gap-1.5">
        ⚡ PROGRESSION UPDATE
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {/* XP Earned */}
        {xpEarned > 0 && (
          <div className="flex items-center gap-1.5 bg-neo-yellow/20 border border-neo-yellow/60 px-2 py-1 rounded-lg">
            <span className="text-neo-yellow font-black font-mono text-sm">+{xpEarned} XP</span>
          </div>
        )}

        {/* Personal Best */}
        {isPersonalBest && (
          <div className="flex items-center gap-1.5 bg-neo-lime/20 border border-neo-lime/60 px-2 py-1 rounded-lg">
            <span className="text-neo-lime font-black font-mono text-sm">🔥 NEW BEST!</span>
          </div>
        )}

        {/* Level Up */}
        {newLevel && (
          <div className="flex items-center gap-1.5 bg-neo-purple/20 border border-neo-purple/60 px-2 py-1 rounded-lg">
            <span className="text-neo-purple font-black font-mono text-sm">⬆️ LEVEL {newLevel}!</span>
          </div>
        )}

        {/* Streak */}
        {currentStreak > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-400/60 px-2 py-1 rounded-lg">
            <span className="text-orange-400 font-black font-mono text-sm">🔥 {currentStreak}D STREAK</span>
          </div>
        )}
      </div>

      {/* Achievement unlocks */}
      {unlockedAchievements.length > 0 && (
        <div className="space-y-1.5">
          {unlockedAchievements.map((ach) => (
            <div key={ach.id} className="flex items-center gap-2 bg-white/10 border border-white/20 px-2.5 py-1.5 rounded-lg">
              <span className="text-base">{ach.icon}</span>
              <div className="flex-1">
                <span className="font-mono font-black text-xs text-white">{ach.title}</span>
                <span className="ml-2 text-[10px] font-mono text-neo-yellow">+{ach.xp} XP</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Achievement!</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Optional Rewarded Ad Placement (Safe buffer, opt-in) ── */}
      <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between gap-2">
        {bonusClaimed ? (
          <div className="w-full py-1.5 px-2 bg-neo-lime/20 border border-neo-lime text-neo-lime font-mono font-bold text-xs text-center rounded-lg">
            ✅ +25 BONUS XP CLAIMED!
          </div>
        ) : (
          <button
            onClick={handleClaimBonus}
            className="w-full py-2 px-3 bg-neo-yellow/20 hover:bg-neo-yellow/30 border border-neo-yellow/60 hover:border-neo-yellow text-neo-yellow font-mono font-bold text-xs uppercase flex items-center justify-center gap-1.5 rounded-lg transition-all active:scale-[0.98]"
          >
            <span>🎁</span>
            <span>Watch Short Ad for +25 XP</span>
          </button>
        )}
      </div>
    </div>
  );
}

