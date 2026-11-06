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
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 sm:p-4 select-none overflow-y-auto pointer-events-auto">
      <div className="neo-box-xl bg-[#FFFDF5] max-w-md landscape:max-w-2xl w-full p-3 sm:p-5 text-center relative border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] my-auto max-h-[96vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
        
        {/* Top Left Close/Back Button */}
        <button
          onClick={handleExit}
          className="absolute top-2 left-2 px-2 py-1 bg-white hover:bg-zinc-100 border-2 border-black flex items-center justify-center font-mono font-black text-[10px] sm:text-xs shadow-neo-sm cursor-pointer z-10 text-black active:translate-x-0.5 active:translate-y-0.5"
          title="Return to Lobby"
        >
          ← LOBBY
        </button>

        {/* ── Content Grid (Single Column in Portrait, 2-Column in Landscape) ── */}
        <div className="flex flex-col landscape:grid landscape:grid-cols-2 landscape:gap-4 landscape:items-center mt-4 sm:mt-0">
          
          {/* Left Column: Banner & Rewards */}
          <div className="flex flex-col items-center">
            {/* Banner */}
            <div className="mb-2 sm:mb-3">
              {isWinner ? (
                <div>
                  <div className="inline-block px-3 sm:px-4 py-1 bg-neo-lime border-3 border-black shadow-neo font-display font-black text-lg sm:text-2xl uppercase tracking-wider text-black rotate-1">
                    🏆 VICTORY!
                  </div>
                  {matchResult?.forfeit && (
                    <div className="block mt-1 font-mono font-black text-[9px] sm:text-xs uppercase bg-[#FFE142] border-2 border-black py-0.5 px-2 text-black shadow-neo-sm">
                      ⚡ OPPONENT FORFEIT
                    </div>
                  )}
                </div>
              ) : isDraw ? (
                <div className="inline-block px-3 sm:px-4 py-1 bg-neo-yellow border-3 border-black shadow-neo font-display font-black text-lg sm:text-2xl uppercase tracking-wider text-black">
                  🤝 TIED DRAW!
                </div>
              ) : (
                <div className="inline-block px-3 sm:px-4 py-1 bg-neo-red border-3 border-black shadow-neo font-display font-black text-lg sm:text-2xl uppercase tracking-wider text-white -rotate-1">
                  💀 DEFEAT
                </div>
              )}
            </div>

            {/* Coins Won Announcement */}
            <div className="w-full p-2 sm:p-3 bg-white border-2 border-black shadow-neo-sm mb-2 sm:mb-3">
              <div className="font-mono text-[8px] sm:text-[10px] font-black uppercase text-zinc-500 mb-0.5">
                {isWinner ? 'TOTAL MATCH REWARD' : isDraw ? 'ENTRY REFUND' : 'MATCH REWARD'}
              </div>
              <div className="font-display font-black text-xl sm:text-3xl text-black flex items-center justify-center gap-1.5 sm:gap-2">
                <span>🪙</span>
                <span>{isWinner ? `+${coinsWon.toLocaleString()}` : isDraw ? `+${coinsWon.toLocaleString()}` : '0'}</span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-zinc-600">COINS</span>
              </div>
              <p className="font-mono text-[9px] sm:text-[11px] text-zinc-600 mt-0.5 line-clamp-2">
                {matchResult?.forfeit && isWinner
                  ? 'Opponent exited the match. You claimed full pool victory!'
                  : isWinner
                  ? 'Congratulations! You claimed the full winner match pool.'
                  : isDraw
                  ? 'Scores were equal! Both player stakes have been refunded.'
                  : 'Better luck next match! Keep sharpening your archery skills.'}
              </p>
            </div>
          </div>

          {/* Right Column: Score Comparison & Action Buttons */}
          <div className="flex flex-col">
            {/* Score Comparison */}
            <div className="flex items-center justify-between gap-2 bg-zinc-50 border-2 border-black p-2 sm:p-2.5 mb-2 sm:mb-3">
              {/* You */}
              <div className="flex-1 flex flex-col items-center">
                <span className="text-xl sm:text-2xl">{me.avatar}</span>
                <span className="font-mono font-black text-[9px] sm:text-xs uppercase truncate max-w-[80px] sm:max-w-[100px]">{me.username}</span>
                <span className="font-display font-black text-lg sm:text-2xl text-black">{me.score}</span>
                <span className="font-mono text-[7px] sm:text-[9px] font-black text-zinc-500 uppercase">You</span>
              </div>

              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-black text-white font-mono font-black text-[9px] sm:text-xs flex items-center justify-center shrink-0">
                VS
              </div>

              {/* Opponent */}
              <div className="flex-1 flex flex-col items-center">
                <span className="text-xl sm:text-2xl">{opponent.avatar}</span>
                <span className="font-mono font-black text-[9px] sm:text-xs uppercase truncate max-w-[80px] sm:max-w-[100px]">{opponent.username}</span>
                <span className="font-display font-black text-lg sm:text-2xl text-black">{opponent.score}</span>
                <span className="font-mono text-[7px] sm:text-[9px] font-black text-zinc-500 uppercase">Rival</span>
              </div>
            </div>

            {/* Rematch invitation status */}
            {opponentWantsRematch && (
              <div className="mb-2 p-1 bg-neo-yellow border-2 border-black font-mono text-[9px] sm:text-xs font-black uppercase animate-bounce">
                ⚔️ Rival wants a rematch! Accept to play!
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <button
                onClick={handlePlayAgain}
                disabled={rematchRequested || matchResult?.forfeit}
                className={`w-full py-2 sm:py-2.5 font-mono font-black text-[10px] sm:text-xs uppercase tracking-wider border-2 sm:border-3 border-black shadow-neo active:scale-95 transition-all ${
                  matchResult?.forfeit
                    ? 'bg-zinc-200 text-zinc-400 border-zinc-400 cursor-not-allowed shadow-none'
                    : rematchRequested
                    ? 'bg-zinc-200 text-zinc-600 cursor-not-allowed'
                    : 'bg-neo-lime hover:bg-lime-300 cursor-pointer'
                }`}
              >
                {matchResult?.forfeit
                  ? 'OPPONENT EXITED MATCH ✕'
                  : rematchRequested
                  ? 'WAITING FOR OPPONENT... ⏳'
                  : '↺ PLAY AGAIN (REMATCH)'}
              </button>

              <button
                onClick={handleExit}
                className="w-full py-1.5 sm:py-2 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-black text-[10px] sm:text-xs uppercase shadow-neo-sm cursor-pointer active:scale-95 text-black"
              >
                ← RETURN TO LOBBY
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
