/**
 * FriendsPage — Complete Social & Friends Hub
 * ─────────────────────────────────────────────
 * • Search players by Nickname OR Special Player ID (e.g. #GS-7891)
 * • Send, Receive, Accept & Decline Friend Requests
 * • Live Online/Offline presence & Instant 1v1 Match Challenges
 * • Shareable Special Player ID with 1-click Copy
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlayer } from '../hooks/usePlayer';
import { useMultiplayer } from '../context/MultiplayerContext';
import {
  getFriendsProfiles,
  searchUsersByUsername,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend
} from '../firebase/firestore';

export default function FriendsPage() {
  const navigate = useNavigate();
  const { currentUser, isGuest, loginAsGuest } = useAuth();
  const {
    playerData,
    friends: friendUids,
    playerTag,
    incomingFriendRequests,
    outgoingFriendRequests,
    coins
  } = usePlayer();

  const {
    friendsStatus,
    checkFriendsStatus,
    sendFriendInvite
  } = useMultiplayer();

  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'add' | 'requests'
  const [friendsList, setFriendsList] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingRequestTo, setSendingRequestTo] = useState(null);
  const [optimisticOutgoing, setOptimisticOutgoing] = useState([]);
  const [copiedId, setCopiedId] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  const effectiveUid = currentUser?.uid || playerData?.uid || localStorage.getItem('gesture_studio_last_uid') || '';
  const myUid = effectiveUid;
  const myUsername = playerData?.username || currentUser?.displayName || 'Player';
  const myAvatar = playerData?.avatar || '🎮';

  // Ensure user is signed in to Firebase Auth so Firestore rules pass
  useEffect(() => {
    if (!currentUser && !isGuest && loginAsGuest) {
      const preferredName = (myUsername && myUsername !== 'Player' && !myUsername.startsWith('Guest_')) ? myUsername : '';
      loginAsGuest(preferredName).catch(() => {});
    }
  }, [currentUser, isGuest, loginAsGuest, myUsername]);

  // Fetch full profiles for friends
  useEffect(() => {
    let active = true;
    if (friendUids.length > 0) {
      setLoadingFriends(true);
      getFriendsProfiles(friendUids).then((profiles) => {
        if (active) {
          setFriendsList(profiles);
          setLoadingFriends(false);
          checkFriendsStatus(friendUids);
        }
      });
    } else {
      setFriendsList([]);
      setLoadingFriends(false);
    }
    return () => { active = false; };
  }, [friendUids, checkFriendsStatus]);

  // Periodic poll of friends online status
  useEffect(() => {
    if (friendUids.length === 0) return;
    const interval = setInterval(() => {
      checkFriendsStatus(friendUids);
    }, 6000);
    return () => clearInterval(interval);
  }, [friendUids, checkFriendsStatus]);

  const copyPlayerTag = () => {
    if (playerTag) {
      navigator.clipboard.writeText(playerTag);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchUsersByUsername(searchQuery, myUid);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleSendRequest = async (targetUser) => {
    if (!myUid) {
      setActionFeedback('Loading player session, please try again in a moment...');
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }
    setSendingRequestTo(targetUser.uid);
    const sender = {
      uid: myUid,
      username: myUsername,
      avatar: myAvatar,
      playerTag: playerTag || 'GS-0000',
    };
    const success = await sendFriendRequest(sender, targetUser);
    setSendingRequestTo(null);
    if (success) {
      setOptimisticOutgoing((prev) => [...prev, targetUser.uid]);
      setActionFeedback(`Friend request sent to ${targetUser.username}!`);
      setTimeout(() => setActionFeedback(null), 3500);
    } else {
      setActionFeedback(`Could not send request. Please check your connection and try again.`);
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  const handleAcceptRequest = async (requesterUid) => {
    await acceptFriendRequest(myUid, requesterUid);
    setActionFeedback('Friend request accepted!');
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleDeclineRequest = async (requesterUid) => {
    await declineFriendRequest(myUid, requesterUid);
  };

  const handleCancelRequest = async (targetUid) => {
    await cancelFriendRequest(myUid, targetUid);
  };

  const handleRemoveFriend = async (friendUid, friendName) => {
    if (window.confirm(`Are you sure you want to remove ${friendName} from your friends?`)) {
      await removeFriend(myUid, friendUid);
    }
  };

  const handleChallengeFriend = (friendUid) => {
    sendFriendInvite(friendUid, 'fruit-ninja');
    navigate('/fruit-ninja?mode=multiplayer');
  };

  const pendingCount = incomingFriendRequests.length;

  return (
    <div className="w-full min-h-screen bg-neo-dots text-black font-sans pb-24 md:pb-12">
      
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 w-full bg-neo-yellow border-b-3 border-black shadow-neo-sm flex items-center justify-between px-4 py-2.5 select-none">
        <Link to="/" className="flex items-center gap-2 font-mono font-black text-xs uppercase hover:underline">
          <img src="/gesturestudio.png" alt="Gesture Studio" className="w-5 h-5 object-contain" />
          <span>← HOME</span>
        </Link>
        <h1 className="font-display font-black text-base uppercase tracking-tight flex items-center gap-1.5">
          <span>👥</span>
          <span>FRIENDS & SOCIAL</span>
        </h1>
        <div className="flex items-center gap-1.5 bg-white border border-black px-2 py-0.5 text-xs font-mono font-black shadow-xs">
          <span>🪙</span>
          <span>{coins.toLocaleString()}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        
        {/* ── Personal ID Card ───────────────────────────────────────────── */}
        <div className="bg-white border-3 border-black shadow-neo-lg p-5 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center gap-3.5 text-center sm:text-left">
              <div className="w-16 h-16 bg-neo-yellow border-3 border-black shadow-neo text-4xl flex items-center justify-center shrink-0">
                {myAvatar}
              </div>
              <div>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h2 className="font-display font-black text-2xl uppercase tracking-tight text-black leading-none">
                    {myUsername}
                  </h2>
                  <span className="bg-neo-lime border border-black text-[9px] font-mono font-black px-1.5 py-0.2">
                    YOU
                  </span>
                </div>
                <p className="font-mono text-xs text-zinc-500 mt-0.5">
                  Level {playerData?.level || 1} Player
                </p>
              </div>
            </div>

            {/* Special Player ID Badge & Copy Button */}
            <div className="bg-[#FFFDF5] border-2 border-black p-3 flex flex-col sm:items-end items-center gap-1.5 shadow-neo-sm w-full sm:w-auto">
              <span className="font-mono text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                YOUR SPECIAL PLAYER ID
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-base tracking-widest bg-neo-pink border border-black px-2.5 py-1 select-all shadow-xs">
                  #{playerTag}
                </span>
                <button
                  onClick={copyPlayerTag}
                  className={`px-3 py-1 font-mono font-black text-xs uppercase border-2 border-black shadow-neo-sm transition-all cursor-pointer ${
                    copiedId
                      ? 'bg-neo-lime text-black'
                      : 'bg-white hover:bg-zinc-100 active:translate-y-0.5'
                  }`}
                  title="Copy Special ID to Clipboard"
                >
                  {copiedId ? '✓ COPIED!' : '📋 COPY ID'}
                </button>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                Share this ID with anyone to add you instantly!
              </span>
            </div>

          </div>
        </div>

        {/* ── Feedback Banner ────────────────────────────────────────────── */}
        {actionFeedback && (
          <div className="mb-4 p-3 bg-neo-lime border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm animate-bounce text-center">
            ✓ {actionFeedback}
          </div>
        )}

        {/* ── Tab Switcher ───────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 bg-white border-2 border-black shadow-neo-sm p-1 w-full select-none">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 text-xs font-mono font-black uppercase transition-colors px-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'friends'
                ? 'bg-neo-yellow border-2 border-black shadow-neo-sm'
                : 'hover:bg-zinc-100'
            }`}
          >
            <span>👥 MY FRIENDS</span>
            <span className="bg-black text-white px-1.5 py-0.2 rounded-full text-[10px]">
              {friendsList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-2 text-xs font-mono font-black uppercase transition-colors px-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'add'
                ? 'bg-neo-yellow border-2 border-black shadow-neo-sm'
                : 'hover:bg-zinc-100'
            }`}
          >
            <span>🔍 ADD FRIEND</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 text-xs font-mono font-black uppercase transition-colors px-2 flex items-center justify-center gap-1.5 cursor-pointer relative ${
              activeTab === 'requests'
                ? 'bg-neo-yellow border-2 border-black shadow-neo-sm'
                : 'hover:bg-zinc-100'
            }`}
          >
            <span>✉️ REQUESTS</span>
            {pendingCount > 0 && (
              <span className="bg-neo-red text-white border border-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-mono font-black text-[9px] shadow-sm animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: MY FRIENDS LIST                                             */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'friends' && (
          <div className="space-y-3">
            {loadingFriends ? (
              <div className="bg-white border-3 border-black shadow-neo-sm p-8 text-center font-mono text-xs text-zinc-500">
                Loading friends list...
              </div>
            ) : friendsList.length === 0 ? (
              <div className="bg-white border-3 border-black shadow-neo p-8 text-center">
                <span className="text-4xl block mb-2">🤝</span>
                <h3 className="font-display font-black text-xl uppercase mb-1">No Friends Yet</h3>
                <p className="font-mono text-xs text-zinc-600 max-w-sm mx-auto mb-4">
                  Search players by their special Player ID or Nickname to send them a friend request!
                </p>
                <button
                  onClick={() => setActiveTab('add')}
                  className="px-5 py-2.5 bg-neo-yellow hover:bg-yellow-300 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                >
                  + SEARCH & ADD FRIENDS
                </button>
              </div>
            ) : (
              friendsList.map((friend) => {
                const isOnline = Boolean(friendsStatus[friend.uid]?.online);

                return (
                  <div
                    key={friend.uid}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white border-2 sm:border-3 border-black shadow-neo-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className="text-3xl sm:text-4xl">{friend.avatar}</span>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black ${
                            isOnline ? 'bg-emerald-500' : 'bg-zinc-400'
                          }`}
                          title={isOnline ? 'Online now' : 'Offline'}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-display font-black text-base text-black uppercase">
                            {friend.username}
                          </h4>
                          <span className="font-mono text-[10px] font-bold bg-zinc-100 border border-black px-1.5 text-zinc-700">
                            #{friend.playerTag}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                          <span>{isOnline ? '🟢 Online' : '⚫ Offline'}</span>
                          <span>·</span>
                          <span>Lv {friend.level}</span>
                          <span>·</span>
                          <span>🪙 {friend.coins?.toLocaleString()} coins</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-200">
                      <button
                        onClick={() => handleChallengeFriend(friend.uid)}
                        disabled={!isOnline}
                        className={`flex-1 sm:flex-none px-3.5 py-1.5 font-mono font-black text-xs uppercase border-2 border-black shadow-neo-sm transition-all flex items-center justify-center gap-1.5 ${
                          isOnline
                            ? 'bg-neo-red text-white hover:bg-rose-600 cursor-pointer active:translate-y-0.5'
                            : 'bg-zinc-200 text-zinc-400 border-zinc-400 cursor-not-allowed'
                        }`}
                        title={isOnline ? 'Challenge friend to 1v1 match' : 'Friend is currently offline'}
                      >
                        <span>⚔️</span>
                        <span>1v1 CHALLENGE</span>
                      </button>

                      <button
                        onClick={() => handleRemoveFriend(friend.uid, friend.username)}
                        className="px-2.5 py-1.5 bg-zinc-100 hover:bg-red-50 text-zinc-500 hover:text-red-700 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                        title="Remove Friend"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: ADD FRIEND (Search by Name or ID)                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'add' && (
          <div className="space-y-4">
            
            <div className="bg-white border-3 border-black shadow-neo p-5">
              <h3 className="font-display font-black text-lg uppercase mb-1">
                Find & Add Players
              </h3>
              <p className="font-mono text-xs text-zinc-600 mb-4">
                Enter another player's <strong>Special Player ID</strong> (e.g. <span className="bg-neo-pink px-1 border border-black font-bold">GS-4891</span>) or their <strong>Nickname</strong>.
              </p>

              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter Player ID (#GS-XXXX) or Nickname..."
                  className="flex-1 bg-[#FFFDF5] border-2 border-black px-3.5 py-2.5 font-mono text-xs uppercase tracking-wide focus:outline-none focus:bg-neo-yellow/20 font-bold"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="bg-black hover:bg-zinc-800 text-white border-2 border-black px-6 py-2.5 font-mono font-black text-xs uppercase tracking-wider shadow-neo-sm cursor-pointer"
                >
                  {isSearching ? 'SEARCHING...' : '🔍 SEARCH'}
                </button>
              </form>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                <span className="font-mono text-[10px] font-black uppercase text-zinc-600 block px-1">
                  Found Players ({searchResults.length})
                </span>

                {searchResults.map((user) => {
                  const isFriend = friendUids.includes(user.uid);
                  const isOutgoingPending = outgoingFriendRequests.some((r) => r.uid === user.uid) || optimisticOutgoing.includes(user.uid);
                  const isIncomingPending = incomingFriendRequests.some((r) => r.uid === user.uid);
                  const isSending = sendingRequestTo === user.uid;

                  return (
                    <div
                      key={user.uid}
                      className="flex items-center justify-between p-3.5 bg-white border-2 sm:border-3 border-black shadow-neo-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{user.avatar}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-display font-black text-sm uppercase text-black">
                              {user.username}
                            </h4>
                            <span className="font-mono text-[10px] font-bold bg-zinc-100 border border-black px-1.5 text-zinc-700">
                              #{user.playerTag}
                            </span>
                          </div>
                          <p className="font-mono text-[10px] text-zinc-500">
                            Level {user.level || 1}
                          </p>
                        </div>
                      </div>

                      {/* Request Action Button */}
                      <div>
                        {isFriend ? (
                          <span className="px-3 py-1 bg-neo-lime border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm">
                            ✓ FRIENDS
                          </span>
                        ) : isIncomingPending ? (
                          <button
                            onClick={() => handleAcceptRequest(user.uid)}
                            className="px-3.5 py-1.5 bg-neo-lime hover:bg-lime-300 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                          >
                            ✓ ACCEPT REQUEST
                          </button>
                        ) : isOutgoingPending ? (
                          <span className="px-3 py-1 bg-amber-100 border-2 border-black font-mono font-black text-xs uppercase text-zinc-700 shadow-neo-sm">
                            ⏳ PENDING
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(user)}
                            disabled={isSending}
                            className="px-4 py-1.5 bg-neo-yellow hover:bg-yellow-300 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm active:translate-y-0.5 cursor-pointer disabled:opacity-50"
                          >
                            {isSending ? 'SENDING...' : '+ ADD FRIEND'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !isSearching && (
              <div className="bg-white border-2 border-dashed border-zinc-300 p-6 text-center">
                <p className="font-mono font-bold text-xs text-zinc-600">
                  No player found matching "{searchQuery}"
                </p>
                <p className="font-mono text-[10px] text-zinc-400 mt-1">
                  Double check the Player ID or Nickname and try again!
                </p>
              </div>
            )}

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: REQUESTS (Incoming & Outgoing)                               */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            
            {/* Incoming Requests */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
                  <span>📥 INCOMING REQUESTS</span>
                  <span className="bg-neo-red text-white px-1.5 py-0.2 rounded-full text-[10px]">
                    {incomingFriendRequests.length}
                  </span>
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  Accept to become friends
                </span>
              </div>

              {incomingFriendRequests.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-zinc-300 p-6 text-center font-mono text-xs text-zinc-500">
                  No pending incoming requests
                </div>
              ) : (
                <div className="space-y-2">
                  {incomingFriendRequests.map((req) => (
                    <div
                      key={req.uid}
                      className="flex items-center justify-between p-3.5 bg-white border-2 sm:border-3 border-black shadow-neo-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{req.avatar || '🎮'}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-display font-black text-sm uppercase text-black">
                              {req.username}
                            </h4>
                            <span className="font-mono text-[10px] font-bold bg-zinc-100 border border-black px-1.5 text-zinc-700">
                              #{req.playerTag || 'GS-0000'}
                            </span>
                          </div>
                          <p className="font-mono text-[10px] text-zinc-500">
                            Sent you a friend request
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAcceptRequest(req.uid)}
                          className="px-3.5 py-1.5 bg-neo-lime hover:bg-lime-300 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                        >
                          ✓ ACCEPT
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(req.uid)}
                          className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
                  <span>📤 SENT REQUESTS</span>
                  <span className="bg-zinc-200 text-black px-1.5 py-0.2 rounded-full text-[10px]">
                    {outgoingFriendRequests.length}
                  </span>
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  Waiting for response
                </span>
              </div>

              {outgoingFriendRequests.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-zinc-300 p-4 text-center font-mono text-xs text-zinc-500">
                  No outgoing requests pending
                </div>
              ) : (
                <div className="space-y-2">
                  {outgoingFriendRequests.map((req) => (
                    <div
                      key={req.uid}
                      className="flex items-center justify-between p-3 bg-zinc-50 border-2 border-black shadow-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{req.avatar || '🎮'}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs uppercase text-black">
                              {req.username}
                            </span>
                            <span className="font-mono text-[9px] bg-white border border-black px-1 text-zinc-600">
                              #{req.playerTag || 'GS-0000'}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-zinc-500">
                            Request pending...
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCancelRequest(req.uid)}
                        className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-black font-mono font-bold text-[10px] uppercase cursor-pointer"
                      >
                        CANCEL
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
