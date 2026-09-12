/**
 * AchievementToast — Non-blocking notification for newly unlocked achievements.
 * Stacks up to 3 toasts in top-right corner.
 * Auto-dismisses each after 3.5 seconds.
 */
import React, { useEffect } from 'react';
import { usePlayer } from '../hooks/usePlayer';

function SingleToast({ achievement, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="flex items-start gap-3 bg-white border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-3 w-72 animate-fade-in">
      <div className="w-10 h-10 bg-neo-yellow border-2 border-black flex items-center justify-center text-xl shrink-0">
        {achievement.icon || '🏆'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-mono font-black uppercase tracking-wider text-zinc-500 mb-0.5">
          🏅 ACHIEVEMENT UNLOCKED!
        </p>
        <p className="font-display font-black text-sm text-black truncate">{achievement.title}</p>
        <p className="text-[10px] font-mono text-zinc-600 truncate">{achievement.description}</p>
        {achievement.xp > 0 && (
          <span className="inline-block mt-1 bg-neo-lime border border-black px-1.5 py-0.5 text-[10px] font-mono font-black">
            +{achievement.xp} XP
          </span>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-zinc-400 hover:text-black text-xs font-mono shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

export default function AchievementToastContainer() {
  const { pendingAchievements, shiftPendingAchievement } = usePlayer();

  // Show max 3 at a time
  const visible = pendingAchievements.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-auto">
      {visible.map((ach, i) => (
        <SingleToast
          key={`${ach.id}-${i}`}
          achievement={ach}
          onDismiss={shiftPendingAchievement}
        />
      ))}
    </div>
  );
}

