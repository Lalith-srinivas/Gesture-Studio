import React from 'react';

export default function GameModeModal({ isOpen, onClose, onSelectSinglePlayer, onSelectMultiplayer, gameTitle = "Fruit Ninja" }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="neo-box-xl bg-[#FFFDF5] max-w-lg w-full p-6 sm:p-8 text-center relative border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-white border-2 border-black font-mono font-black text-xs hover:bg-zinc-100 flex items-center justify-center cursor-pointer shadow-neo-sm"
        >
          ✕
        </button>

        {/* Header Badge */}
        <div className="inline-block px-3 py-1 bg-neo-yellow border-2 border-black font-mono font-black text-xs uppercase mb-3 shadow-neo-sm">
          🎮 SELECT GAMEPLAY MODE
        </div>

        <h2 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-black mb-2">
          {gameTitle}
        </h2>
        <p className="font-mono text-xs font-bold text-zinc-600 uppercase tracking-wider mb-6">
          Choose how you want to play
        </p>

        {/* Two Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Single Player Option */}
          <button
            onClick={onSelectSinglePlayer}
            className="flex flex-col items-center justify-between p-5 bg-white border-3 border-black shadow-neo hover:-translate-y-1 hover:shadow-neo-lg active:translate-y-0 transition-all text-left group cursor-pointer"
          >
            <div className="w-full flex items-center justify-between mb-3">
              <span className="text-3xl">👤</span>
              <span className="font-mono text-[10px] font-black uppercase bg-zinc-100 border border-black px-2 py-0.5">
                SOLO
              </span>
            </div>
            <div className="w-full">
              <h3 className="font-display font-black text-xl text-black uppercase mb-1">
                Single Player
              </h3>
              <p className="font-mono text-[11px] text-zinc-600 leading-snug">
                Classic arcade mode. Slice fruits, dodge bombs, and break your personal best high score.
              </p>
            </div>
            <div className="w-full mt-4 py-2 bg-neo-yellow border-2 border-black font-mono font-black text-xs uppercase text-center group-hover:bg-amber-300">
              PLAY SOLO →
            </div>
          </button>

          {/* Multiplayer Option */}
          <button
            onClick={onSelectMultiplayer}
            className="flex flex-col items-center justify-between p-5 bg-[#FFE4E6] border-3 border-black shadow-neo hover:-translate-y-1 hover:shadow-neo-lg active:translate-y-0 transition-all text-left group cursor-pointer relative overflow-hidden"
          >
            {/* Live Badge */}
            <div className="absolute top-2 right-2 bg-neo-red text-white text-[9px] font-mono font-black px-1.5 py-0.5 border border-black uppercase animate-pulse">
              LIVE 1v1
            </div>

            <div className="w-full flex items-center justify-between mb-3">
              <span className="text-3xl">⚔️</span>
              <span className="font-mono text-[10px] font-black uppercase bg-neo-pink border border-black px-2 py-0.5">
                MULTIPLAYER
              </span>
            </div>
            <div className="w-full">
              <h3 className="font-display font-black text-xl text-black uppercase mb-1">
                Multiplayer
              </h3>
              <p className="font-mono text-[11px] text-zinc-700 leading-snug">
                Challenge friends or battle random players live for coin prizes with identical synchronized spawns!
              </p>
            </div>
            <div className="w-full mt-4 py-2 bg-neo-red text-white border-2 border-black font-mono font-black text-xs uppercase text-center group-hover:bg-rose-600">
              VS LOBBY →
            </div>
          </button>

        </div>

      </div>
    </div>
  );
}
