/**
 * AchievementsPage — Standalone achievements page.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import { ACHIEVEMENTS, getAchievementProgress } from '../services/achievementService';
import { GAME_LABELS } from '../services/gameStatsService';
import AdSlot from '../components/ads/AdSlot';

const FILTER_OPTIONS = [
  { id: 'all',      label: 'ALL' },
  { id: 'platform', label: 'PLATFORM' },
  { id: 'game',     label: 'GAME' },
  { id: 'unlocked', label: 'UNLOCKED' },
  { id: 'locked',   label: 'LOCKED' },
];

export default function AchievementsPage() {
  const { unlockedAchievements, playerData, allGameStats, loading } = usePlayer();
  const [filter, setFilter] = useState('all');

  const checkUnlocked = (ach) => {
    return (
      unlockedAchievements.includes(ach.id) ||
      Boolean(ach.check && ach.check({ ...playerData, allGameStats }))
    );
  };

  const filtered = ACHIEVEMENTS.filter((a) => {
    const isUnl = checkUnlocked(a);
    if (filter === 'unlocked') return isUnl;
    if (filter === 'locked')   return !isUnl;
    if (filter === 'platform') return a.category === 'platform';
    if (filter === 'game')     return a.category === 'game';
    return true;
  });

  const unlocked = ACHIEVEMENTS.filter(checkUnlocked).length;
  const total = ACHIEVEMENTS.length;
  const percent = Math.round((unlocked / total) * 100);

  return (
    <div className="w-full min-h-screen bg-neo-dots text-black font-sans pb-24 md:pb-12">

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 w-full bg-neo-yellow border-b-3 border-black shadow-neo-sm flex items-center justify-between px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2 font-mono font-black text-xs uppercase hover:underline">
          <img src="/gesturestudio.png" alt="Gesture Studio" className="w-5 h-5 object-contain" />
          <span>← HOME</span>
        </Link>
        <h1 className="font-display font-black text-base uppercase tracking-tight">🥇 ACHIEVEMENTS</h1>
        <div className="w-16" />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="bg-white border-3 border-black shadow-neo-lg p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="font-display font-black text-3xl uppercase">🥇 Achievements</h2>
              <p className="font-mono text-sm text-zinc-600 mt-1">
                <span className="font-black text-black text-base">{unlocked}</span>
                <span className="text-zinc-400"> / {total}</span> Unlocked
              </p>
            </div>
            <div className="sm:w-48">
              {/* Overall progress */}
              <div className="flex justify-between text-[10px] font-mono font-black text-zinc-500 mb-1">
                <span>OVERALL PROGRESS</span>
                <span>{percent}%</span>
              </div>
              <div className="h-5 bg-zinc-200 border-3 border-black relative overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neo-yellow to-amber-400 transition-all duration-700"
                  style={{ width: `${percent}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-black">
                  {unlocked}/{total}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sponsored Space ───────────────────────────────────────────── */}
        <div className="mb-6">
          <AdSlot placement="achievements" format="responsive" className="max-w-4xl mx-auto" />
        </div>

        {/* ── Filter Pills ─────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {FILTER_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 border-2 border-black text-xs font-mono font-black uppercase transition-all ${filter === id ? 'bg-neo-yellow shadow-neo-sm' : 'bg-white hover:bg-zinc-100'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Achievement Grid ─────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-100 border-2 border-zinc-200 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center bg-white border-3 border-black shadow-neo-sm">
            <p className="text-5xl mb-3">🔍</p>
            <p className="font-display font-black text-lg uppercase">No achievements match</p>
            <p className="font-mono text-sm text-zinc-500 mt-1">Try a different filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((ach) => {
              const isUnlocked = checkUnlocked(ach);
              const progress = ach.progress ? getAchievementProgress(ach.id, playerData) : null;
              const gameInfo = ach.gameId ? GAME_LABELS[ach.gameId] : null;

              return (
                <div
                  key={ach.id}
                  className={`
                    border-2 border-black p-4 flex flex-col gap-2.5 transition-all
                    ${isUnlocked
                      ? 'bg-white shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5'
                      : 'bg-zinc-100 shadow-neo-sm opacity-60'
                    }
                  `}
                >
                  {/* Icon + Status */}
                  <div className="flex items-start justify-between">
                    <span className="text-4xl">{ach.icon}</span>
                    <div className="flex flex-col items-end gap-1">
                      {isUnlocked
                        ? <span className="text-[9px] font-mono font-black bg-neo-lime border border-black px-1.5 py-0.5">✓ UNLOCKED</span>
                        : <span className="text-[9px] font-mono font-black bg-zinc-200 border border-zinc-400 text-zinc-600 px-1.5 py-0.5">🔒 LOCKED</span>
                      }
                      <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 border ${isUnlocked ? 'bg-neo-yellow border-black' : 'bg-zinc-200 border-zinc-300 text-zinc-500'}`}>
                        +{ach.xp} XP
                      </span>
                    </div>
                  </div>

                  {/* Title + Description */}
                  <div>
                    <p className="font-display font-black text-sm uppercase leading-tight">{ach.title}</p>
                    <p className="text-[11px] font-mono text-zinc-600 mt-0.5 leading-tight">{ach.description}</p>
                  </div>

                  {/* Progress */}
                  {progress && !isUnlocked && (
                    <div>
                      <div className="flex justify-between text-[9px] font-mono font-bold text-zinc-500 mb-0.5">
                        <span>{progress.current.toLocaleString()} / {progress.target.toLocaleString()}</span>
                        <span>{progress.percent}%</span>
                      </div>
                      <div className="h-2 bg-zinc-200 border border-black">
                        <div className="h-full bg-neo-yellow" style={{ width: `${progress.percent}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Category badge */}
                  <div className="mt-auto">
                    {ach.category === 'platform'
                      ? <span className="text-[9px] font-mono font-black bg-[#E0E7FF] border border-[#818CF8] px-1.5 py-0.5">🌐 PLATFORM</span>
                      : gameInfo
                      ? <span className="text-[9px] font-mono font-black bg-neo-yellow/40 border border-black px-1.5 py-0.5">{gameInfo.emoji} {gameInfo.label.toUpperCase()}</span>
                      : null
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
