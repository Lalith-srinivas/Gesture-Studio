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
    leaveRoom,
  } = useMultiplayer();

  const { currentUser } = useAuth();
  const { playerData } = usePlayer();

  if (!isOpen) return null;

  const myUid = currentUser?.uid || playerData?.uid || localStorage.getItem('gesture_studio_last_uid') || '';
  const p1 = matchResult?.player1 || { uid: myUid, username: playerData?.username || 'You', avatar: '🎮', score: 0 };
  const p2 = matchResult?.player2 || { uid: 'opponent_remote', username: 'Rival', avatar: '🎯', score: 0 };

  const isWinner = matchResult ? matchResult.winnerId === myUid : true;
  const isDraw = matchResult?.winnerId === 'DRAW';

  const me = p1.uid === myUid ? p1 : p2;
  const opponent = p1.uid === myUid ? p2 : p1;

  const coinsWon = matchResult?.coinsWon ?? (isWinner ? 400 : 0);

  const handlePlayAgain = () => {
    playAgain();
  };

  const handleExit = () => {
    leaveRoom();
    resetState();
    onReturnToLobby?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 sm:p-4 select-none overflow-y-auto">
      <div className="neo-box-xl bg-[#FFFDF5] max-w-md w-full p-4 sm:p-6 text-center relative border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] my-auto max-h-[94vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Left Close/Back Button */}
        <button
          onClick={handleExit}
          className="absolute top-2.5 left-2.5 px-2 py-1 bg-white hover:bg-zinc-100 border-2 border-black flex items-center justify-center font-mono font-black text-xs shadow-neo-sm cursor-pointer z-10 text-black"
          title="Return to Lobby"
        >
          ← LOBBY
        </button>

        {/* Banner */}
        <div className="mb-2 sm:mb-3 mt-1 sm:mt-0">
          {isWinner ? (
            <div>
              <div className="inline-block px-3 sm:px-4 py-1 bg-neo-lime border-3 border-black shadow-neo font-display font-black text-xl sm:text-2xl uppercase tracking-wider text-black rotate-1">
                🏆 VICTORY!
              </div>
              {matchResult.forfeit && (
                <div className="block mt-1.5 font-mono font-black text-[10px] sm:text-xs uppercase bg-[#FFE142] border-2 border-black py-0.5 px-2 text-black shadow-neo-sm">
                  ⚡ OPPONENT FORFEIT (LEFT THE MATCH)
                </div>
              )}
            </div>
          ) : isDraw ? (
            <div className="inline-block px-3 sm:px-4 py-1 bg-neo-yellow border-3 border-black shadow-neo font-display font-black text-xl sm:text-2xl uppercase tracking-wider text-black">
              🤝 TIED DRAW!
            </div>
          ) : (
            <div className="inline-block px-3 sm:px-4 py-1 bg-neo-red border-3 border-black shadow-neo font-display font-black text-xl sm:text-2xl uppercase tracking-wider text-white -rotate-1">
              💀 DEFEAT
            </div>
          )}
        </div>

        {/* Coins Won Announcement */}
        <div className="p-2 sm:p-3 bg-white border-2 border-black shadow-neo-sm mb-2 sm:mb-3">
          <div className="font-mono text-[9px] sm:text-[10px] font-black uppercase text-zinc-500 mb-0.5">
            {isWinner ? 'TOTAL MATCH REWARD' : isDraw ? 'ENTRY REFUND' : 'MATCH REWARD'}
          </div>
          <div className="font-display font-black text-2xl sm:text-3xl text-black flex items-center justify-center gap-2">
            <span>🪙</span>
            <span>{isWinner ? `+${coinsWon.toLocaleString()}` : isDraw ? `+${coinsWon.toLocaleString()}` : '0'}</span>
            <span className="text-[10px] font-mono font-bold text-zinc-600">COINS</span>
          </div>
          <p className="font-mono text-[10px] sm:text-[11px] text-zinc-600 mt-0.5">
            {matchResult.forfeit && isWinner
              ? 'Opponent exited the match and did not return. You were awarded the full match pool victory!'
              : isWinner
              ? 'Congratulations! You claimed the full winner match pool.'
              : isDraw
              ? 'Scores were equal! Both player entry stakes have been refunded.'
              : 'Better luck next match! Keep sharpening your skills.'}
          </p>
        </div>

        {/* Score Comparison */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 bg-zinc-50 border-2 border-black p-2 sm:p-3 mb-3 sm:mb-4">
          {/* You */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-2xl sm:text-3xl mb-0.5">{me.avatar}</span>
            <span className="font-mono font-black text-[10px] sm:text-xs uppercase truncate max-w-[90px] sm:max-w-[100px]">{me.username}</span>
            <span className="font-display font-black text-xl sm:text-2xl text-black mt-0.5">{me.score}</span>
            <span className="font-mono text-[8px] sm:text-[9px] font-black text-zinc-500 uppercase">Your Score</span>
          </div>

          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black text-white font-mono font-black text-[10px] sm:text-xs flex items-center justify-center shrink-0">
            VS
          </div>

          {/* Opponent */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-2xl sm:text-3xl mb-0.5">{opponent.avatar}</span>
            <span className="font-mono font-black text-[10px] sm:text-xs uppercase truncate max-w-[90px] sm:max-w-[100px]">{opponent.username}</span>
            <span className="font-display font-black text-xl sm:text-2xl text-black mt-0.5">{opponent.score}</span>
            <span className="font-mono text-[8px] sm:text-[9px] font-black text-zinc-500 uppercase">Rival Score</span>
          </div>
        </div>

        {/* Rematch invitation status */}
        {opponentWantsRematch && (
          <div className="mb-2 sm:mb-3 p-1.5 bg-neo-yellow border-2 border-black font-mono text-[10px] sm:text-xs font-black uppercase animate-bounce">
            ⚔️ Rival wants a rematch! Accept to play again!
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handlePlayAgain}
            disabled={rematchRequested || matchResult.forfeit}
            className={`w-full py-2.5 sm:py-3 font-mono font-black text-xs sm:text-sm uppercase tracking-wider border-2 sm:border-3 border-black shadow-neo transition-all ${
              matchResult.forfeit
                ? 'bg-zinc-200 text-zinc-400 border-zinc-400 cursor-not-allowed shadow-none'
                : rematchRequested
                ? 'bg-zinc-200 text-zinc-600 cursor-not-allowed'
                : 'bg-neo-lime hover:bg-lime-300 cursor-pointer active:translate-y-0.5'
            }`}
          >
            {matchResult.forfeit
              ? 'OPPONENT EXITED MATCH ✕'
              : rematchRequested
              ? 'WAITING FOR OPPONENT... ⏳'
              : '↺ PLAY AGAIN (REMATCH)'}
          </button>

          <button
            onClick={handleExit}
            className="w-full py-2 sm:py-2.5 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
          >
            ← RETURN TO LOBBY
          </button>
        </div>

      </div>
    </div>
  );
}
