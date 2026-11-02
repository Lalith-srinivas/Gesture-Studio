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
    // Navigate to the challenged game if not already there
    if (gameId === 'fruit-ninja') {
      navigate('/fruit-ninja?mode=multiplayer');
    }
  };

  const handleReject = () => {
    respondToInvite(inviteId, false);
    dismissInvite();
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 max-w-sm w-full bg-[#FFFDF5] border-3 border-black shadow-neo-lg p-4 animate-in slide-in-from-bottom-5 duration-200 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b-2 border-black/10">
        <span className="font-mono text-[10px] font-black uppercase bg-neo-yellow border border-black px-1.5 py-0.5 shadow-xs">
          ⚔️ 1v1 MATCH INVITATION
        </span>
        <button
          onClick={handleReject}
          className="text-xs font-mono font-black text-zinc-400 hover:text-black cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center text-3xl shadow-neo-sm">
          {fromUser?.avatar || '🎮'}
        </div>
        <div>
          <h4 className="font-display font-black text-sm uppercase text-black leading-tight">
            {fromUser?.username || 'A friend'}
          </h4>
          <p className="font-mono text-xs text-zinc-600">
            challenged you to <strong className="text-black">{gameName || 'Fruit Ninja'}</strong>!
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          className="flex-1 py-2 bg-neo-lime hover:bg-lime-300 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm transition-all cursor-pointer"
        >
          ✓ ACCEPT
        </button>
        <button
          onClick={handleReject}
          className="flex-1 py-2 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm transition-all cursor-pointer"
        >
          ✕ DECLINE
        </button>
      </div>

    </div>
  );
}
