/**
 * LeaderboardPage — Global and per-game leaderboard.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlayer } from '../hooks/usePlayer';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { GAME_LABELS } from '../services/gameStatsService';
import { findPlayerRank } from '../services/leaderboardService';

const TABS = [
  { id: 'global', label: '🌎 OVERALL', emoji: '🌎' },
  ...Object.entries(GAME_LABELS).map(([id, { label, emoji }]) => ({
    id,
    label: `${emoji} ${label.toUpperCase()}`,
    emoji,
  })),
];

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="font-display font-black text-sm text-zinc-500">#{rank}</span>;
}

function LeaderboardRow({ entry, isCurrentUser }) {
  const isTop3 = entry.rank <= 3;
  const bgColors = ['bg-amber-50 border-amber-300', 'bg-zinc-50 border-zinc-300', 'bg-orange-50 border-orange-200'];

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 border-2 transition-all
        ${isCurrentUser
          ? 'bg-neo-yellow/30 border-neo-yellow shadow-neo-sm ring-2 ring-neo-yellow'
          : isTop3
          ? bgColors[entry.rank - 1]
          : 'bg-white border-black/20 hover:border-black/40'
        }
      `}
    >
      <div className="w-10 flex items-center justify-center shrink-0">
        <RankBadge rank={entry.rank} />
      </div>

      <div className="w-9 h-9 bg-white border-2 border-black flex items-center justify-center text-lg shrink-0">
        {entry.avatar || '🎮'}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`font-mono font-black text-sm truncate ${isCurrentUser ? 'text-black' : 'text-zinc-800'}`}>
          {entry.username || 'Player'}
          {isCurrentUser && <span className="ml-2 text-[10px] bg-neo-yellow px-1 border border-black">YOU</span>}
        </p>
        {entry.level && (
          <p className="text-[10px] font-mono text-zinc-500">Level {entry.level}</p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className={`font-display font-black ${isTop3 ? 'text-xl' : 'text-base'}`}>
          {(entry.score ?? entry.totalScore ?? 0).toLocaleString()}
        </p>
        <p className="text-[10px] font-mono text-zinc-500">pts</p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-zinc-100 border-2 border-zinc-200 animate-pulse">
          <div className="w-10 h-6 bg-zinc-200 rounded" />
          <div className="w-9 h-9 bg-zinc-200 rounded" />
          <div className="flex-1">
            <div className="h-3 bg-zinc-200 rounded w-32 mb-1.5" />
            <div className="h-2.5 bg-zinc-200 rounded w-20" />
          </div>
          <div className="w-16 h-5 bg-zinc-200 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const [selectedGame, setSelectedGame] = useState('global');
  const { currentUser } = useAuth();
  const { playerData } = usePlayer();
  const { data, loading, error } = useLeaderboard(selectedGame);

  const playerEntry = currentUser ? findPlayerRank(currentUser.uid, data) : null;
  const isPlayerInTop = data.some((e) => e.uid === currentUser?.uid);

  return (
    <div className="w-full min-h-screen bg-neo-dots text-black font-sans pb-24 md:pb-12">

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 w-full bg-neo-yellow border-b-3 border-black shadow-neo-sm flex items-center justify-between px-4 py-2.5">
        <Link to="/" className="flex items-center gap-1.5 font-mono font-black text-xs uppercase hover:underline">
          ← HOME
        </Link>
        <h1 className="font-display font-black text-base uppercase tracking-tight">🏆 LEADERBOARDS</h1>
        <div className="w-16" />
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* ── Game Selector Tabs ───────────────────────────────────────── */}
        <div className="overflow-x-auto pb-2 mb-6">
          <div className="flex gap-1.5 min-w-max">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedGame(t.id)}
                className={`px-3 py-2 text-[11px] font-mono font-black uppercase whitespace-nowrap border-2 border-black transition-all ${selectedGame === t.id ? 'bg-neo-yellow shadow-neo-sm -translate-y-0.5' : 'bg-white hover:bg-zinc-100'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Leaderboard Title ─────────────────────────────────────────── */}
        <div className="mb-4">
          <h2 className="font-display font-black text-2xl uppercase">
            {TABS.find((t) => t.id === selectedGame)?.label || 'LEADERBOARD'}
          </h2>
          <p className="text-xs font-mono text-zinc-500 mt-0.5 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {selectedGame === 'global' ? 'Live · ranked by total score across all games' : 'Live · ranked by best score in this game'}
          </p>
        </div>

        {/* ── Column Headers ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-2 bg-black text-white border-2 border-black text-[10px] font-mono font-black uppercase mb-1">
          <span className="w-10 text-center">RANK</span>
          <span className="w-9" />
          <span className="flex-1">PLAYER</span>
          <span className="shrink-0">SCORE</span>
        </div>

        {/* ── Leaderboard List ─────────────────────────────────────────── */}
        {loading && <LoadingSkeleton />}

        {error && (
          <div className="py-8 text-center">
            <p className="text-3xl mb-2">📡</p>
            <p className="font-mono font-black text-sm text-zinc-600 uppercase">Couldn't load leaderboard</p>
            <p className="font-mono text-xs text-zinc-400 mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && data.length === 0 && (
          <div className="py-12 text-center bg-white border-3 border-black shadow-neo-sm">
            <p className="text-5xl mb-3">🏆</p>
            <p className="font-display font-black text-lg uppercase">No scores yet!</p>
            <p className="font-mono text-sm text-zinc-600 mt-1 max-w-xs mx-auto">
              Play any game to submit your first score and appear on the live leaderboard!
            </p>
            <Link to="/" className="inline-block mt-4 px-5 py-2.5 bg-neo-yellow border-3 border-black font-mono font-black text-xs uppercase shadow-neo-sm hover:shadow-neo active:translate-y-0.5">
              PLAY GAMES →
            </Link>
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <div className="space-y-1">
            {data.map((entry) => (
              <LeaderboardRow
                key={entry.uid}
                entry={entry}
                isCurrentUser={entry.uid === currentUser?.uid}
              />
            ))}
          </div>
        )}

        {/* ── Current Player's Rank (if outside top results) ─────────── */}
        {!loading && !isPlayerInTop && currentUser && playerEntry && (
          <div className="mt-6">
            <div className="border-t-2 border-b-2 border-black py-1 text-center text-[10px] font-mono font-black text-zinc-500 mb-1">
              YOUR RANK
            </div>
            <LeaderboardRow entry={playerEntry} isCurrentUser />
          </div>
        )}

        {!currentUser && (
          <div className="mt-6 bg-neo-yellow/30 border-2 border-black p-4 text-center">
            <p className="font-mono font-black text-xs uppercase text-zinc-700">
              🔑 Sign in to see your rank and appear on the leaderboard
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
