import React, { useState, useEffect } from 'react';

/**
 * FriendCoinRequestModal
 * ──────────────────────
 * Allows requesting 400 daily bonus coins from selected friends.
 * The friend who accepts loses 0 coins (it's a free game bonus).
 * Limited to 1 request session per day.
 */
export default function FriendCoinRequestModal({
  isOpen,
  onClose,
  friendsList = [],
  friendsStatus = {},
  onSendRequests,
  isSending = false,
  hasRequestedToday = false,
}) {
  const [selectedUids, setSelectedUids] = useState([]);

  // Select all by default when modal opens
  useEffect(() => {
    if (isOpen && friendsList.length > 0) {
      setSelectedUids(friendsList.map((f) => f.uid));
    }
  }, [isOpen, friendsList]);

  if (!isOpen) return null;

  const allSelected = friendsList.length > 0 && selectedUids.length === friendsList.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedUids([]);
    } else {
      setSelectedUids(friendsList.map((f) => f.uid));
    }
  };

  const handleToggleFriend = (uid) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = () => {
    if (selectedUids.length === 0 || isSending || hasRequestedToday) return;
    onSendRequests(selectedUids);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#FFFDF5] max-w-md w-full p-6 relative border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-white border-2 border-black font-mono font-black text-xs hover:bg-zinc-100 flex items-center justify-center cursor-pointer shadow-neo-sm"
        >
          ✕
        </button>

        {/* Title */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-neo-yellow border-2 border-black font-display font-black text-xs uppercase mb-1">
            <span>🎁 DAILY FRIEND BONUS</span>
          </div>
          <h3 className="font-display font-black text-2xl uppercase text-black leading-tight">
            REQUEST 400 COINS
          </h3>
          <p className="font-mono text-xs text-zinc-600 mt-1">
            Request your daily 400 coins bonus from your friends once per day!
          </p>
        </div>

        {/* Notice Info Box */}
        <div className="p-3 bg-amber-50 border-2 border-black mb-4">
          <div className="flex items-start gap-2">
            <span className="text-base">💡</span>
            <p className="font-mono text-[11px] text-zinc-800 leading-snug">
              <span className="font-black text-black">FREE BONUS:</span> Your friends will{' '}
              <span className="underline font-black text-neo-red">NOT</span> lose any coins when they
              accept! You receive 400 coins as a friendship gift funded by the game.
            </p>
          </div>
        </div>

        {/* Content / Friends List */}
        {hasRequestedToday ? (
          <div className="text-center py-8 bg-zinc-100 border-2 border-dashed border-zinc-300 p-4 mb-4">
            <span className="text-4xl block mb-2">⏳</span>
            <p className="font-mono font-bold text-sm text-zinc-800 mb-1">
              Already Requested Today!
            </p>
            <p className="font-mono text-xs text-zinc-500">
              You can send 1 daily coin request session per day. Please check back tomorrow!
            </p>
          </div>
        ) : friendsList.length === 0 ? (
          <div className="text-center py-8 bg-white border-2 border-dashed border-zinc-300 p-4 mb-4">
            <span className="text-3xl block mb-2">👥</span>
            <p className="font-mono font-bold text-xs text-zinc-700 mb-1">No Friends Added Yet</p>
            <p className="font-mono text-[11px] text-zinc-400">
              Add friends using their Player ID or Nickname to exchange daily coin bonuses!
            </p>
          </div>
        ) : (
          <>
            {/* Select All Toggle Bar */}
            <div className="flex items-center justify-between p-2 bg-zinc-100 border-2 border-black mb-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 accent-black cursor-pointer"
                />
                <span className="font-mono font-black text-xs uppercase text-black">
                  SELECT ALL FRIENDS ({friendsList.length})
                </span>
              </label>

              <span className="font-mono text-[10px] text-zinc-600 font-bold">
                {selectedUids.length} selected
              </span>
            </div>

            {/* Friends Scroll List */}
            <div className="space-y-2 overflow-y-auto max-h-56 pr-1 mb-4">
              {friendsList.map((friend) => {
                const isSelected = selectedUids.includes(friend.uid);
                const isOnline = Boolean(friendsStatus[friend.uid]?.online);

                return (
                  <div
                    key={friend.uid}
                    onClick={() => handleToggleFriend(friend.uid)}
                    className={`flex items-center justify-between p-2.5 border-2 border-black shadow-neo-sm cursor-pointer transition-colors ${
                      isSelected ? 'bg-neo-yellow/30' : 'bg-white hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent onClick
                        className="w-4 h-4 accent-black cursor-pointer"
                      />
                      <div className="relative">
                        <span className="text-2xl">{friend.avatar}</span>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-black ${
                            isOnline ? 'bg-emerald-500' : 'bg-zinc-400'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-mono font-black text-xs text-black leading-tight">
                            {friend.username}
                          </p>
                          <span className="font-mono text-[9px] bg-zinc-100 border border-black px-1 text-zinc-600">
                            #{friend.playerTag || 'GS-0000'}
                          </span>
                        </div>
                        <p className="font-mono text-[10px] text-zinc-500">
                          {isOnline ? '🟢 Online' : '⚫ Offline'}
                        </p>
                      </div>
                    </div>

                    <span className="font-mono font-bold text-[10px] bg-neo-lime border border-black px-1.5 py-0.5 text-black">
                      +400 🪙
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-zinc-200">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
          >
            CANCEL
          </button>

          <button
            onClick={handleSubmit}
            disabled={selectedUids.length === 0 || isSending || hasRequestedToday || friendsList.length === 0}
            className={`flex-1 py-2.5 font-mono font-black text-xs uppercase border-2 border-black shadow-neo transition-all ${
              selectedUids.length === 0 || isSending || hasRequestedToday || friendsList.length === 0
                ? 'bg-zinc-200 text-zinc-400 border-zinc-400 cursor-not-allowed shadow-none'
                : 'bg-neo-lime hover:bg-lime-300 text-black cursor-pointer active:translate-y-0.5'
            }`}
          >
            {isSending
              ? 'SENDING...'
              : hasRequestedToday
              ? 'REQUESTED TODAY ✓'
              : `SEND REQUEST (${selectedUids.length}) ➔`}
          </button>
        </div>
      </div>
    </div>
  );
}

