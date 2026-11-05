import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMultiplayer } from '../../context/MultiplayerContext';

export default function MatchInviteNotification() {
  const { incomingInvite, respondToInvite, dismissInvite } = useMultiplayer();
  const navigate = useNavigate();

  if (!incomingInvite) return null;

  const { inviteId, fromUser, gameId, gameName } = incomingInvite;

  const handleAccept = () => {
    respondToInvite(inviteId, true);
    dismissInvite();
    const targetGame = gameId || 'fruit-ninja';
    navigate(`/${targetGame}?mode=multiplayer`);
  };

  const handleReject = () => {
    respondToInvite(inviteId, false);
    dismissInvite();
  };

  return (
    <div className="fixed top-4 left-3 right-3 sm:top-auto sm:bottom-6 sm:left-6 sm:right-auto z-[10001] max-w-sm mx-auto sm:mx-0 bg-[#FFFDF5] border-3 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] p-4 animate-in slide-in-from-top-4 sm:slide-in-from-bottom-5 duration-200 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b-2 border-black/10">
        <span className="font-mono text-[10px] font-black uppercase bg-neo-yellow border border-black px-2 py-0.5 shadow-xs">
          ⚔️ 1v1 MATCH INVITATION
        </span>
        <button
          onClick={handleReject}
          className="w-6 h-6 flex items-center justify-center font-mono font-black text-xs text-zinc-400 hover:text-black hover:bg-zinc-100 border border-transparent hover:border-black cursor-pointer transition-colors"
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex items-center gap-3.5 mb-3.5">
        <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center text-3xl shadow-neo-sm shrink-0">
          {fromUser?.avatar || '🎮'}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-display font-black text-base uppercase text-black leading-tight truncate">
            {fromUser?.username || 'A friend'}
          </h4>
          <p className="font-mono text-xs text-zinc-600 truncate">
            challenged you to <strong className="text-black">{gameName || 'Fruit Ninja'}</strong>!
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2.5">
        <button
          onClick={handleAccept}
          className="flex-1 py-2.5 bg-neo-lime hover:bg-lime-300 active:translate-y-0.5 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>✓</span>
          <span>ACCEPT</span>
        </button>
        <button
          onClick={handleReject}
          className="flex-1 py-2.5 bg-white hover:bg-zinc-100 active:translate-y-0.5 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>✕</span>
          <span>DECLINE</span>
        </button>
      </div>

    </div>
  );
}
