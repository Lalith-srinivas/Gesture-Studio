import React, { useState, useEffect } from 'react';
import { getUserMatchHistory } from '../../firebase/firestore';

export default function MatchHistorySection({ uid }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (uid) {
      setLoading(true);
      getUserMatchHistory(uid).then((res) => {
        if (active) {
          setHistory(res);
          setLoading(false);
        }
      });
    }
    return () => { active = false; };
  }, [uid]);

  if (loading) {
    return (
      <div className="bg-white border-3 border-black shadow-neo-sm p-4 text-center">
        <p className="font-mono text-xs font-bold text-zinc-500">Loading match history...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-3 border-black shadow-neo-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-black text-sm uppercase flex items-center gap-2">
          <span>⚔️</span>
          <span>Multiplayer Match History</span>
        </h3>
        <span className="font-mono text-[10px] font-bold text-zinc-500">
          {history.length} {history.length === 1 ? 'Match' : 'Matches'}
        </span>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-6 bg-zinc-50 border-2 border-dashed border-zinc-200 p-4">
          <span className="text-3xl block mb-1">🎮</span>
          <p className="font-mono font-bold text-xs text-zinc-700">No multiplayer matches recorded yet</p>
          <p className="font-mono text-[10px] text-zinc-400 mt-0.5">
            Jump into 1v1 Fruit Ninja matches to test your skills and earn match coins!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((m) => {
            const isPlayer1 = m.player1?.uid === uid;
            const myPlayer = isPlayer1 ? m.player1 : m.player2;
            const oppPlayer = isPlayer1 ? m.player2 : m.player1;

            const isWinner = m.winnerId === uid;
            const isDraw = m.winnerId === 'DRAW';

            const myScore = myPlayer?.score ?? (m.scores?.[uid] ?? 0);
            const oppScore = oppPlayer?.score ?? (m.scores?.[oppPlayer?.uid] ?? 0);

            const resultLabel = isWinner ? 'WIN' : isDraw ? 'DRAW' : 'LOSS';
            const resultBadgeBg = isWinner ? 'bg-neo-lime text-black' : isDraw ? 'bg-neo-yellow text-black' : 'bg-neo-red text-white';

            const matchDate = m.createdAt || (m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString() : 'Recent');

            return (
              <div
                key={m.id || m.matchId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-zinc-50 border-2 border-black shadow-xs"
              >
                {/* Left: Opponent & Game */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center text-xl shrink-0">
                    {oppPlayer?.avatar || '🤖'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-xs uppercase text-black">
                        vs {oppPlayer?.username || 'Opponent'}
                      </span>
                      <span className={`px-1.5 py-0.2 border border-black font-mono font-black text-[9px] uppercase ${resultBadgeBg}`}>
                        {resultLabel}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {m.gameName || 'Fruit Ninja'} · {matchDate}
                    </p>
                  </div>
                </div>

                {/* Right: Scores & Entry Coins */}
                <div className="flex items-center justify-between sm:justify-end gap-4 text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-200">
                  <div>
                    <div className="font-display font-black text-base text-black">
                      {myScore} <span className="text-zinc-400 font-mono text-xs">-</span> {oppScore}
                    </div>
                    <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase">
                      Scores
                    </span>
                  </div>

                  <div className="bg-white border border-black px-2 py-1">
                    <span className="font-mono font-black text-[11px] text-black flex items-center gap-1">
                      <span>🪙</span>
                      <span>{m.entryFee || 200}</span>
                    </span>
                    <span className="font-mono text-[8px] font-bold text-zinc-500 uppercase block">
                      {m.tier || 'Bronze'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
