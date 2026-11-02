import React from 'react';
import { useMultiplayer } from '../../context/MultiplayerContext';
import { usePlayer } from '../../hooks/usePlayer';
import { useAuth } from '../../hooks/useAuth';

export default function MultiplayerVSHUD({
  timeLeft = 60,
  myLives = 10,
  maxLives = 10,
  myBombs = 0,
  maxBombs = 3,
}) {
  const { opponent, myScore, opponentScore, totalPool, tier } = useMultiplayer();
  const { currentUser } = useAuth();
  const { playerData } = usePlayer();

  const myUsername = playerData?.username || currentUser?.displayName || 'You';
  const myAvatar = playerData?.avatar || '🎮';

  const oppUsername = opponent?.username || 'Opponent';
  const oppAvatar = opponent?.avatar || '🤖';

  const tierColors = {
    bronze: 'bg-[#FED7AA]',
    silver: 'bg-[#E2E8F0]',
    gold: 'bg-[#FEF08A]',
  };

  const poolBg = tierColors[tier] || 'bg-neo-yellow';

  return (
    <div className="absolute top-0 left-0 right-0 z-40 pointer-events-none select-none px-3 sm:px-6 pt-3 flex justify-between items-start">
      
      {/* ── Player 1 (You) ── */}
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2 bg-white border-2 sm:border-3 border-black shadow-neo-sm p-1.5 sm:p-2">
          <span className="text-2xl sm:text-3xl">{myAvatar}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-black text-xs sm:text-sm uppercase max-w-[110px] truncate text-black">
                {myUsername}
              </span>
              <span className="bg-neo-lime border border-black text-[9px] font-mono font-black px-1">YOU</span>
            </div>
            <div className="font-display font-black text-2xl sm:text-3xl leading-none text-black">
              {myScore}
            </div>
          </div>
        </div>

        {/* Lives / Bombs Indicators */}
        <div className="flex gap-1">
          <div className="bg-[#FFFDF5] border border-black px-1.5 py-0.5 text-[10px] font-mono font-bold">
            ❤️ {myLives}/{maxLives}
          </div>
          <div className="bg-[#FFFDF5] border border-black px-1.5 py-0.5 text-[10px] font-mono font-bold">
            💣 {maxBombs - myBombs}/{maxBombs}
          </div>
        </div>
      </div>

      {/* ── Center: Match Info & Timer ── */}
      <div className="flex flex-col items-center">
        {/* Timer Box */}
        <div className="bg-neo-red border-3 border-black shadow-neo px-4 py-1 flex items-center gap-1.5">
          <span className="text-white font-mono text-xs">⏱️</span>
          <span className="font-display font-black text-2xl sm:text-3xl text-white leading-none">
            {timeLeft}s
          </span>
        </div>

        {/* Prize Pool Badge */}
        <div className={`${poolBg} border-2 border-black shadow-neo-sm px-2.5 py-0.5 mt-1 flex items-center gap-1 text-[10px] sm:text-xs font-mono font-black uppercase text-black`}>
          <span>🏆</span>
          <span>POOL: {totalPool.toLocaleString()} COINS</span>
        </div>
      </div>

      {/* ── Player 2 (Opponent) ── */}
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 bg-white border-2 sm:border-3 border-black shadow-neo-sm p-1.5 sm:p-2 text-right">
          <div>
            <div className="flex items-center justify-end gap-1.5">
              <span className="bg-neo-pink border border-black text-[9px] font-mono font-black px-1">RIVAL</span>
              <span className="font-mono font-black text-xs sm:text-sm uppercase max-w-[110px] truncate text-black">
                {oppUsername}
              </span>
            </div>
            <div className="font-display font-black text-2xl sm:text-3xl leading-none text-black">
              {opponentScore}
            </div>
          </div>
          <span className="text-2xl sm:text-3xl">{oppAvatar}</span>
        </div>

        {/* Opponent live indicator */}
        <div className="bg-neo-lime border border-black px-2 py-0.5 text-[9px] font-mono font-black uppercase flex items-center gap-1 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-black animate-ping" />
          <span>SYNC LIVE</span>
        </div>
      </div>

    </div>
  );
}
