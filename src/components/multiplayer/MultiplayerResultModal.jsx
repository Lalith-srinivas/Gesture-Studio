import React from 'react';
import { useMultiplayer } from '../../context/MultiplayerContext';
import { useAuth } from '../../hooks/useAuth';
import { usePlayer } from '../../hooks/usePlayer';

export default function MultiplayerResultModal({ isOpen, onReturnToLobby }) {
  const {
    matchResult,
    playAgain,
    rematchRequested,
    opponentWantsRematch,
    resetState,
  } = useMultiplayer();

  const { currentUser } = useAuth();
  const { playerData } = usePlayer();

  if (!isOpen || !matchResult) return null;

  const myUid = currentUser?.uid || '';
  const isWinner = matchResult.winnerId === myUid;
  const isDraw = matchResult.winnerId === 'DRAW';

  const p1 = matchResult.player1;
  const p2 = matchResult.player2;

  const me = p1.uid === myUid ? p1 : p2;
  const opponent = p1.uid === myUid ? p2 : p1;

  const coinsWon = isWinner ? matchResult.coinsWon : (isDraw ? matchResult.coinsWon : 0);

  const handlePlayAgain = () => {
    playAgain();
  };

  const handleExit = () => {
    resetState();
    onReturnToLobby?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none">
      <div className="neo-box-xl bg-[#FFFDF5] max-w-md w-full p-6 sm:p-8 text-center relative border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Banner */}
        <div className="mb-4">
          {isWinner ? (
            <div className="inline-block px-4 py-1.5 bg-neo-lime border-3 border-black shadow-neo font-display font-black text-2xl uppercase tracking-wider text-black rotate-1">
              🏆 VICTORY!
            </div>
          ) : isDraw ? (
            <div className="inline-block px-4 py-1.5 bg-neo-yellow border-3 border-black shadow-neo font-display font-black text-2xl uppercase tracking-wider text-black">
              🤝 TIED DRAW!
            </div>
          ) : (
            <div className="inline-block px-4 py-1.5 bg-neo-red border-3 border-black shadow-neo font-display font-black text-2xl uppercase tracking-wider text-white -rotate-1">
              💀 DEFEAT
            </div>
          )}
        </div>

        {/* Coins Won Announcement */}
        <div className="p-4 bg-white border-2 border-black shadow-neo-sm mb-5">
          <div className="font-mono text-[10px] font-black uppercase text-zinc-500 mb-1">
            {isWinner ? 'TOTAL MATCH REWARD' : isDraw ? 'ENTRY REFUND' : 'MATCH REWARD'}
          </div>
          <div className="font-display font-black text-3xl sm:text-4xl text-black flex items-center justify-center gap-2">
            <span>🪙</span>
            <span>{isWinner ? `+${coinsWon.toLocaleString()}` : isDraw ? `+${coinsWon.toLocaleString()}` : '0'}</span>
            <span className="text-xs font-mono font-bold text-zinc-600">COINS</span>
          </div>
          <p className="font-mono text-[11px] text-zinc-600 mt-1">
            {isWinner
              ? 'Congratulations! You claimed the full winner match pool.'
              : isDraw
              ? 'Scores were equal! Both player entry stakes have been refunded.'
              : 'Better luck next match! Keep sharpening your slicing reflexes.'}
          </p>
        </div>

        {/* Score Comparison */}
        <div className="flex items-center justify-between gap-3 bg-zinc-50 border-2 border-black p-3 mb-6">
          {/* You */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-3xl mb-1">{me.avatar}</span>
            <span className="font-mono font-black text-xs uppercase truncate max-w-[100px]">{me.username}</span>
            <span className="font-display font-black text-2xl text-black mt-1">{me.score}</span>
            <span className="font-mono text-[9px] font-black text-zinc-500 uppercase">Your Score</span>
          </div>

          <div className="w-8 h-8 rounded-full bg-black text-white font-mono font-black text-xs flex items-center justify-center shrink-0">
            VS
          </div>

          {/* Opponent */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-3xl mb-1">{opponent.avatar}</span>
            <span className="font-mono font-black text-xs uppercase truncate max-w-[100px]">{opponent.username}</span>
            <span className="font-display font-black text-2xl text-black mt-1">{opponent.score}</span>
            <span className="font-mono text-[9px] font-black text-zinc-500 uppercase">Rival Score</span>
          </div>
        </div>

        {/* Rematch invitation status */}
        {opponentWantsRematch && (
          <div className="mb-4 p-2 bg-neo-yellow border-2 border-black font-mono text-xs font-black uppercase animate-bounce">
            ⚔️ Rival wants a rematch! Accept to play again!
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handlePlayAgain}
            disabled={rematchRequested}
            className={`w-full py-3.5 font-mono font-black text-sm uppercase tracking-wider border-3 border-black shadow-neo transition-all ${
              rematchRequested
                ? 'bg-zinc-200 text-zinc-600 cursor-not-allowed'
                : 'bg-neo-lime hover:bg-lime-300 cursor-pointer active:translate-y-0.5'
            }`}
          >
            {rematchRequested ? 'WAITING FOR OPPONENT... ⏳' : '↺ PLAY AGAIN (REMATCH)'}
          </button>

          <button
            onClick={handleExit}
            className="w-full py-2.5 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
          >
            ← RETURN TO LOBBY
          </button>
        </div>

      </div>
    </div>
  );
}
