import React, { useState, useEffect } from 'react';
import { useMultiplayer } from '../../context/MultiplayerContext';
import { usePlayer } from '../../hooks/usePlayer';
import { useAuth } from '../../hooks/useAuth';
import { getFriendsProfiles, sendFriendRequest, searchUsersByUsername } from '../../firebase/firestore';

export default function MultiplayerLobbyModal({ isOpen, onClose, gameId = "fruit-ninja", gameTitle = "Fruit Ninja" }) {
  const {
    wsConnected,
    matchState,
    currentRoom,
    opponent,
    p1Tier,
    p2Tier,
    tier,
    entryFee,
    totalPool,
    friendsStatus,
    joinQueue,
    leaveQueue,
    confirmMatch,
    selectTier,
    sendFriendInvite,
    checkFriendsStatus,
    resetState,
  } = useMultiplayer();

  const { currentUser } = useAuth();
  const { playerData, coins } = usePlayer();

  const [activeTab, setActiveTab] = useState('random'); // 'random' | 'friends'
  const [friendsList, setFriendsList] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [confirmedReady, setConfirmedReady] = useState(false);
  const [selectedTierLocal, setSelectedTierLocal] = useState(null);
  const [invitingUid, setInvitingUid] = useState(null);

  const friendsUids = playerData?.friends || [];
  const myUid = currentUser?.uid || '';
  const myUsername = playerData?.username || currentUser?.displayName || 'Player';
  const myAvatar = playerData?.avatar || '🎮';

  // Load friends profiles and poll their online status
  useEffect(() => {
    let active = true;
    if (isOpen && friendsUids.length > 0) {
      setLoadingFriends(true);
      getFriendsProfiles(friendsUids).then((profiles) => {
        if (active) {
          setFriendsList(profiles);
          setLoadingFriends(false);
          checkFriendsStatus(friendsUids);
        }
      });
    } else {
      setFriendsList([]);
    }
    return () => { active = false; };
  }, [isOpen, friendsUids.length, checkFriendsStatus]);

  // Periodic poll of friends online status
  useEffect(() => {
    if (!isOpen || friendsUids.length === 0) return;
    const interval = setInterval(() => {
      checkFriendsStatus(friendsUids);
    }, 5000);
    return () => clearInterval(interval);
  }, [isOpen, friendsUids, checkFriendsStatus]);

  // Reset local ready state when moving between states
  useEffect(() => {
    if (matchState === 'MATCH_FOUND') {
      setConfirmedReady(false);
    }
    if (matchState === 'TIER_SELECTION') {
      setSelectedTierLocal(null);
    }
  }, [matchState]);

  const handleSearchUsers = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchingUsers(true);
    const results = await searchUsersByUsername(searchQuery, myUid);
    setSearchResults(results);
    setIsSearchingUsers(false);
  };

  const handleAddFriend = async (targetUser) => {
    if (!myUid) return;
    const sender = {
      uid: myUid,
      username: myUsername,
      avatar: myAvatar,
      playerTag: playerData?.playerTag || 'GS-0000',
    };
    await sendFriendRequest(sender, targetUser);
    setSearchResults((prev) => prev.filter((u) => u.uid !== targetUser.uid));
  };

  const handleInviteFriend = (friendUid) => {
    setInvitingUid(friendUid);
    sendFriendInvite(friendUid, gameId);
    setTimeout(() => setInvitingUid(null), 3000);
  };

  const handleConfirmReady = () => {
    setConfirmedReady(true);
    confirmMatch();
  };

  const handleSelectTier = (t) => {
    setSelectedTierLocal(t);
    selectTier(t);
  };

  const handleClose = () => {
    if (matchState === 'SEARCHING') {
      leaveQueue();
    }
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none">
      <div className="neo-box-xl bg-[#FFFDF5] max-w-lg w-full p-6 relative border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        {matchState !== 'COUNTDOWN' && matchState !== 'PLAYING' && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white border-2 border-black font-mono font-black text-xs hover:bg-zinc-100 flex items-center justify-center cursor-pointer shadow-neo-sm"
          >
            ✕
          </button>
        )}

        {/* Top Coin Balance Pill */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-zinc-200">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍉</span>
            <div>
              <h2 className="font-display font-black text-lg uppercase text-black leading-tight">
                {gameTitle} 1v1
              </h2>
              <p className="font-mono text-[10px] text-zinc-500 uppercase">Multiplayer Arena</p>
            </div>
          </div>

          <div className="bg-neo-yellow border-2 border-black px-3 py-1 font-mono font-black text-xs flex items-center gap-1.5 shadow-neo-sm">
            <span>🪙</span>
            <span>{coins.toLocaleString()} COINS</span>
          </div>
        </div>

        {/* ── STATE 1: IDLE (Choose Random vs Friends) ────────────────────── */}
        {matchState === 'IDLE' && (
          <div>
            {/* Tabs */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setActiveTab('random')}
                className={`flex-1 py-2 font-mono font-black text-xs uppercase border-2 border-black transition-all cursor-pointer ${
                  activeTab === 'random' ? 'bg-neo-pink shadow-neo-sm' : 'bg-white hover:bg-zinc-100'
                }`}
              >
                🎲 Random Match
              </button>
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 py-2 font-mono font-black text-xs uppercase border-2 border-black transition-all cursor-pointer ${
                  activeTab === 'friends' ? 'bg-neo-lime shadow-neo-sm' : 'bg-white hover:bg-zinc-100'
                }`}
              >
                👥 Friends List
              </button>
            </div>

            {/* Sub-tab 1: Play with Random Player */}
            {activeTab === 'random' && (
              <div className="text-center py-6">
                <div className="w-20 h-20 bg-neo-yellow border-3 border-black shadow-neo rounded-full flex items-center justify-center text-4xl mx-auto mb-4 animate-bounce">
                  ⚡
                </div>
                <h3 className="font-display font-black text-2xl uppercase mb-1">Quick Matchmaking</h3>
                <p className="font-mono text-xs text-zinc-600 max-w-xs mx-auto mb-6">
                  Get matched instantly with another online player ready for a 1v1 Fruit Ninja duel.
                </p>

                <button
                  onClick={() => joinQueue(gameId)}
                  disabled={!wsConnected}
                  className="neo-btn-primary w-full py-3.5 text-base uppercase tracking-wider font-mono font-black cursor-pointer shadow-neo"
                >
                  {wsConnected ? 'FIND OPPONENT NOW ⚔️' : 'CONNECTING TO SERVER...'}
                </button>
              </div>
            )}

            {/* Sub-tab 2: Invite a Friend */}
            {activeTab === 'friends' && (
              <div className="space-y-4">
                {/* Search / Add Friend */}
                <form onSubmit={handleSearchUsers} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Player ID (#GS-XXXX) or Nickname..."
                    className="flex-1 bg-white border-2 border-black px-3 py-1.5 font-mono text-xs focus:outline-none focus:bg-neo-yellow/20"
                  />
                  <button
                    type="submit"
                    className="bg-black text-white px-3 py-1.5 border-2 border-black font-mono font-black text-xs uppercase hover:bg-zinc-800 cursor-pointer"
                  >
                    {isSearchingUsers ? '...' : 'SEARCH'}
                  </button>
                </form>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="p-2 bg-amber-50 border-2 border-black space-y-1.5">
                    <span className="font-mono text-[10px] font-black uppercase text-zinc-600">Search Results:</span>
                    {searchResults.map((user) => (
                      <div key={user.uid} className="flex items-center justify-between bg-white border border-black p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{user.avatar}</span>
                          <div>
                            <span className="font-mono font-bold text-xs">{user.username}</span>
                            <span className="font-mono text-[9px] text-zinc-500 ml-1">#{user.playerTag}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddFriend(user)}
                          className="bg-neo-lime border border-black px-2 py-0.5 font-mono font-black text-[10px] uppercase shadow-neo-sm hover:bg-lime-300 cursor-pointer"
                        >
                          + SEND REQUEST
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Friends List */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] font-black uppercase text-zinc-600">
                      Your Friends ({friendsList.length})
                    </span>
                    <span className="font-mono text-[9px] text-zinc-400">🟢 Online Indicator</span>
                  </div>

                  {loadingFriends ? (
                    <div className="text-center py-6 font-mono text-xs text-zinc-500">Loading friends...</div>
                  ) : friendsList.length === 0 ? (
                    <div className="text-center py-8 bg-white border-2 border-dashed border-zinc-300 p-4">
                      <span className="text-3xl block mb-2">🤝</span>
                      <p className="font-mono font-bold text-xs text-zinc-600 mb-1">No friends added yet</p>
                      <p className="font-mono text-[11px] text-zinc-400">Search a friend's nickname above to add them!</p>
                    </div>
                  ) : (
                    friendsList.map((friend) => {
                      const isOnline = Boolean(friendsStatus[friend.uid]?.online);
                      return (
                        <div
                          key={friend.uid}
                          className="flex items-center justify-between p-2.5 bg-white border-2 border-black shadow-neo-sm"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <span className="text-2xl">{friend.avatar}</span>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-black ${
                                  isOnline ? 'bg-emerald-500' : 'bg-zinc-400'
                                }`}
                                title={isOnline ? 'Online' : 'Offline'}
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
                                {isOnline ? '🟢 Online now' : '⚫ Offline'}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleInviteFriend(friend.uid)}
                            disabled={!isOnline || invitingUid === friend.uid}
                            className={`px-3 py-1 font-mono font-black text-xs uppercase border-2 border-black transition-all ${
                              isOnline
                                ? 'bg-neo-lime hover:bg-lime-300 shadow-neo-sm cursor-pointer'
                                : 'bg-zinc-200 text-zinc-400 border-zinc-400 cursor-not-allowed'
                            }`}
                          >
                            {invitingUid === friend.uid ? 'INVITED! ✉️' : 'INVITE ⚔️'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STATE 2: SEARCHING (Matchmaking Queue) ────────────────────────── */}
        {matchState === 'SEARCHING' && (
          <div className="text-center py-8">
            <div className="relative w-24 h-24 mx-auto mb-5">
              <div className="absolute inset-0 rounded-full border-4 border-dashed border-neo-red animate-spin" />
              <div className="absolute inset-2 rounded-full bg-neo-yellow border-2 border-black flex items-center justify-center text-4xl shadow-neo">
                🔍
              </div>
            </div>

            <h3 className="font-display font-black text-2xl uppercase mb-1">Searching for Player...</h3>
            <p className="font-mono text-xs text-zinc-600 mb-6 animate-pulse">
              Matching with an opponent in {gameTitle}...
            </p>

            <button
              onClick={leaveQueue}
              className="px-6 py-2 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
            >
              ✕ CANCEL SEARCH
            </button>
          </div>
        )}

        {/* ── STATE 3: MATCH_FOUND ─────────────────────────────────────────── */}
        {matchState === 'MATCH_FOUND' && opponent && (
          <div className="text-center py-4">
            <div className="inline-block px-3 py-1 bg-neo-lime border-2 border-black font-mono font-black text-xs uppercase mb-4 shadow-neo-sm animate-bounce">
              🎉 MATCH FOUND!
            </div>

            <div className="flex items-center justify-around gap-2 mb-6">
              {/* You */}
              <div className="flex flex-col items-center bg-white border-2 border-black p-3 shadow-neo-sm w-36">
                <span className="text-4xl mb-1">{myAvatar}</span>
                <span className="font-mono font-black text-xs uppercase truncate max-w-[120px]">{myUsername}</span>
                <span className="font-mono text-[10px] text-zinc-500">YOU</span>
              </div>

              {/* VS Badge */}
              <div className="w-10 h-10 bg-neo-red text-white font-display font-black text-lg border-2 border-black flex items-center justify-center shadow-neo rotate-3">
                VS
              </div>

              {/* Opponent */}
              <div className="flex flex-col items-center bg-white border-2 border-black p-3 shadow-neo-sm w-36">
                <span className="text-4xl mb-1">{opponent.avatar}</span>
                <span className="font-mono font-black text-xs uppercase truncate max-w-[120px]">{opponent.username}</span>
                <span className="font-mono text-[10px] text-zinc-500">RIVAL</span>
              </div>
            </div>

            <button
              onClick={handleConfirmReady}
              disabled={confirmedReady}
              className={`w-full py-3.5 font-mono font-black text-sm uppercase tracking-wider border-3 border-black shadow-neo transition-all ${
                confirmedReady
                  ? 'bg-zinc-200 text-zinc-600 cursor-not-allowed'
                  : 'bg-neo-lime hover:bg-lime-300 cursor-pointer active:translate-y-0.5'
              }`}
            >
              {confirmedReady ? '✓ READY! WAITING FOR OPPONENT...' : 'CONFIRM & READY ⚔️'}
            </button>
          </div>
        )}

        {/* ── STATE 4: TIER_SELECTION (Match Entry Coins) ──────────────────── */}
        {matchState === 'TIER_SELECTION' && (
          <div>
            <div className="text-center mb-4">
              <span className="font-mono text-[10px] font-black uppercase bg-neo-pink border border-black px-2 py-0.5 shadow-neo-sm">
                STEP 2: CHOOSE ENTRY POOL
              </span>
              <h3 className="font-display font-black text-xl uppercase mt-1">Select Match Stakes</h3>
              <p className="font-mono text-[11px] text-zinc-600">
                Both players must confirm the same match tier to start. Winner takes the full pool!
              </p>
            </div>

            {/* Tiers Grid */}
            <div className="space-y-3 mb-5">
              {[
                { id: 'bronze', name: 'Bronze Match', entry: 200, pool: 400, bg: 'bg-[#FED7AA]', badge: '🥉' },
                { id: 'silver', name: 'Silver Match', entry: 500, pool: 1000, bg: 'bg-[#E2E8F0]', badge: '🥈' },
                { id: 'gold',   name: 'Gold Match',   entry: 2500, pool: 5000, bg: 'bg-[#FEF08A]', badge: '🥇' },
              ].map((t) => {
                const canAfford = coins >= t.entry;
                const isSelected = selectedTierLocal === t.id;
                const opponentChoseThis = (p1Tier === t.id || p2Tier === t.id);

                return (
                  <button
                    key={t.id}
                    onClick={() => canAfford && handleSelectTier(t.id)}
                    disabled={!canAfford}
                    className={`w-full p-3 border-2 border-black flex items-center justify-between text-left transition-all ${
                      isSelected
                        ? `${t.bg} shadow-neo ring-2 ring-black -translate-y-0.5`
                        : canAfford
                        ? 'bg-white hover:bg-zinc-50 shadow-neo-sm'
                        : 'bg-zinc-100 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{t.badge}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-black text-sm uppercase">{t.name}</span>
                          {opponentChoseThis && (
                            <span className="bg-neo-lime text-[9px] font-mono font-black border border-black px-1.5 py-0.2 animate-pulse">
                              RIVAL'S CHOICE!
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-zinc-500">
                          Entry: {t.entry.toLocaleString()} coins each
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-display font-black text-base text-black">
                        🏆 {t.pool.toLocaleString()}
                      </span>
                      <p className="font-mono text-[9px] font-bold text-zinc-600 uppercase">Total Prize Pool</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedTierLocal && (
              <div className="p-2.5 bg-amber-50 border-2 border-black font-mono text-[11px] font-bold text-center text-zinc-800 animate-pulse">
                ⏳ Waiting for opponent to confirm the same match stake...
              </div>
            )}
          </div>
        )}

        {/* ── STATE 5: COUNTDOWN (3... 2... 1... GO!) ──────────────────────── */}
        {matchState === 'COUNTDOWN' && (
          <div className="text-center py-10">
            <div className="font-mono text-xs font-black uppercase text-zinc-500 mb-2">
              SYNCHRONIZING SEED & ARENA...
            </div>
            <div className="w-28 h-28 bg-neo-yellow border-4 border-black shadow-neo-lg rounded-full flex items-center justify-center mx-auto mb-4 animate-ping">
              <span className="font-display font-black text-6xl text-black">GO</span>
            </div>
            <h3 className="font-display font-black text-3xl uppercase">MATCH STARTING!</h3>
            <p className="font-mono text-xs text-zinc-700 mt-2">
              Entry fee locked. Slicing starts in 3 seconds!
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
