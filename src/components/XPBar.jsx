/**
 * XPBar — reusable XP progress bar in Neo-Brutalist style.
 * Shows level, XP amount, and fill bar.
 */
import React from 'react';

export default function XPBar({ xpInfo, compact = false }) {
  if (!xpInfo) return null;
  const { level, xpIntoLevel, xpNeededForNext, progressPercent } = xpInfo;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="bg-neo-yellow border-2 border-black px-2 py-0.5 font-mono font-black text-xs">
          LV {level}
        </span>
        <div className="flex-1 h-2.5 bg-zinc-200 border border-black relative overflow-hidden">
          <div
            className="h-full bg-neo-yellow transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-[10px] font-mono font-bold text-zinc-600 shrink-0">
          {xpIntoLevel}/{xpNeededForNext}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="bg-neo-yellow border-2 border-black px-3 py-1 font-display font-black text-sm shadow-neo-sm">
            LEVEL {level}
          </span>
          <span className="text-xs font-mono font-bold text-zinc-600">
            ⚡ {xpIntoLevel} XP
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-zinc-500">
          {xpNeededForNext - xpIntoLevel} XP to next level
        </span>
      </div>
      <div className="w-full h-4 bg-zinc-200 border-2 border-black relative overflow-hidden shadow-neo-sm">
        <div
          className="h-full bg-gradient-to-r from-neo-yellow to-amber-400 transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
        {/* Progress tick marks */}
        <div className="absolute inset-0 flex">
          {[25, 50, 75].map((p) => (
            <div key={p} className="absolute top-0 bottom-0 w-px bg-black/20" style={{ left: `${p}%` }} />
          ))}
        </div>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-mono text-zinc-500">{xpIntoLevel} / {xpNeededForNext} XP</span>
        <span className="text-[10px] font-mono text-zinc-500">{progressPercent}%</span>
      </div>
    </div>
  );
}

