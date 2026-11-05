/**
 * MultiplayerContext
 * ──────────────────
 * Manages WebSocket connection, matchmaking queues, invitations,
 * room states, synchronized seeds, and real-time score exchanges.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePlayer } from '../hooks/usePlayer';
import NeoAlertModal from '../components/NeoAlertModal';
import { playCountdownSound } from '../utils/soundEffects';

const MultiplayerContext = createContext(null);

const WS_URL = import.meta.env.VITE_WS_BACKEND_URL || (
  window.location.protocol === 'https:'
    ? `wss://${window.location.host}/ws`
    : `ws://127.0.0.1:8000/ws`
);

export function MultiplayerProvider({ children }) {
  const { currentUser, isGuest } = useAuth();
  const { playerData, coins } = usePlayer();

  const [wsConnected, setWsConnected] = useState(false);
  const [matchState, setMatchState] = useState('IDLE'); // IDLE, SEARCHING, MATCH_FOUND, TIER_SELECTION, COUNTDOWN, PLAYING, FINISHED
  const [currentRoom, setCurrentRoom] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [seed, setSeed] = useState(null);
  const [tier, setTier] = useState(null);
  const [entryFee, setEntryFee] = useState(0);
  const [totalPool, setTotalPool] = useState(0);
  const [p1Tier, setP1Tier] = useState(null);
  const [p2Tier, setP2Tier] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentExtra, setOpponentExtra] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [friendsStatus, setFriendsStatus] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);
  const [opponentGraceTimer, setOpponentGraceTimer] = useState(null); // { active: boolean, secondsRemaining: number, message: string }
  const [popup, setPopup] = useState(null);

  const showPopup = useCallback((opts) => {
    if (typeof opts === 'string') {
      setPopup({ message: opts, title: 'Notice', type: 'info' });
    } else {
      setPopup(opts);
    }
  }, []);

  const closePopup = useCallback(() => {
    setPopup(null);
  }, []);

  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const uid = currentUser?.uid || localStorage.getItem('gesture_studio_last_uid') || 'guest_temp';
  const username = playerData?.username || currentUser?.displayName || (isGuest ? 'Guest Player' : 'Player');
  const avatar = playerData?.avatar || '🎮';

  // ── Establish & Maintain WebSocket Connection ─────────────────────────────
  const connectWs = useCallback(() => {
    if (!uid) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const cleanWsUrl = `${WS_URL}?uid=${encodeURIComponent(uid)}&username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}`;
    
    try {
      const ws = new WebSocket(cleanWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setErrorMessage(null);

        // Heartbeat ping every 15s to prevent cloud proxy disconnects
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleServerMessage(msg);
        } catch (e) {
          console.warn('[Multiplayer WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Reconnect after 3s
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWs();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn('[Multiplayer WS] Connection error:', err);
      };
    } catch (e) {
      console.warn('[Multiplayer WS] Could not connect:', e);
    }
  }, [uid, username, avatar]);

  useEffect(() => {
    connectWs();
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  // ── Server Message Dispatcher ─────────────────────────────────────────────
  const handleServerMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'CONNECTED':
        break;

      case 'MATCH_FOUND': {
        const { roomId, player1, player2 } = msg;
        const opp = player1.uid === uid ? player2 : player1;
        setCurrentRoom(roomId);
        setOpponent(opp);
        setMatchState('MATCH_FOUND');
        setMyScore(0);
        setOpponentScore(0);
        setRematchRequested(false);
        setOpponentWantsRematch(false);
        setMatchResult(null);
        break;
      }

      case 'MOVE_TO_TIER_SELECTION': {
        setMatchState('TIER_SELECTION');
        setP1Tier(null);
        setP2Tier(null);
        setRematchRequested(false);
        setOpponentWantsRematch(false);
        setMatchResult(null);
        break;
      }

      case 'TIER_SELECTION_UPDATE': {
        setP1Tier(msg.p1Tier);
        setP2Tier(msg.p2Tier);
        break;
      }

      case 'START_COUNTDOWN': {
        playCountdownSound();
        setMatchState('COUNTDOWN');
        setSeed(msg.seed);
        setTier(msg.tier);
        setEntryFee(msg.entryFee);
        setTotalPool(msg.totalPool);
        setRematchRequested(false);
        setOpponentWantsRematch(false);
        setMatchResult(null);
        break;
      }

      case 'GAME_START': {
        setMatchState('PLAYING');
        setMyScore(0);
        setOpponentScore(0);
        setRematchRequested(false);
        setOpponentWantsRematch(false);
        setMatchResult(null);
        break;
      }

      case 'SCORE_UPDATE': {
        if (msg.uid !== uid) {
          setOpponentScore(msg.score);
          if (msg.extra) setOpponentExtra(msg.extra);
        }
        break;
      }

      case 'OPPONENT_DISCONNECTED_GRACE': {
        setOpponentGraceTimer({
          active: true,
          secondsRemaining: msg.secondsRemaining ?? 5,
          message: msg.message || 'Opponent disconnected. Waiting 5s for return...'
        });
        break;
      }

      case 'OPPONENT_DISCONNECTED_TICK': {
        setOpponentGraceTimer((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            secondsRemaining: msg.secondsRemaining ?? 0
          };
        });
        break;
      }

      case 'OPPONENT_RECONNECTED': {
        setOpponentGraceTimer(null);
        showPopup({
          title: 'Opponent Reconnected',
          message: msg.message || 'Opponent reconnected! Match continues!',
          type: 'info'
        });
        break;
      }

      case 'MATCH_REJOINED': {
        setCurrentRoom(msg.roomId);
        if (msg.seed) setSeed(msg.seed);
        if (msg.tier) setTier(msg.tier);
        if (msg.pool) setTotalPool(msg.pool);
        if (msg.opponent) setOpponent(msg.opponent);
        setMatchState('PLAYING');
        break;
      }

      case 'MATCH_RESULT': {
        setOpponentGraceTimer(null);
        setMatchState('FINISHED');
        setMatchResult(msg);
        break;
      }

      case 'OPPONENT_DISCONNECTED': {
        setOpponentGraceTimer(null);
        showPopup({
          title: 'Opponent Disconnected',
          message: msg.message || 'Your opponent disconnected. Any entry coins have been refunded.',
          type: 'warning'
        });
        resetState();
        break;
      }

      case 'OPPONENT_LEFT': {
        setOpponentWantsRematch(false);
        setRematchRequested(false);
        // Only reset immediately if we are not in an active match
        // (mid-match exits are handled by grace timer / forfeit)
        setMatchState((currentMatchState) => {
          if (currentMatchState !== 'PLAYING') {
            showPopup({
              title: 'Opponent Left',
              message: msg.message || 'Opponent returned to lobby.',
              type: 'info'
            });
            resetState();
            return 'IDLE';
          }
          return currentMatchState;
        });
        break;
      }

      case 'OPPONENT_WANTS_PLAY_AGAIN': {
        setOpponentWantsRematch(true);
        break;
      }

      case 'RECEIVE_MATCH_INVITE': {
        setIncomingInvite(msg);
        break;
      }

      case 'INVITE_REJECTED': {
        showPopup({
          title: 'Invitation Declined',
          message: msg.message || 'Invitation was rejected.',
          type: 'info'
        });
        setMatchState('IDLE');
        break;
      }

      case 'INVITE_FAILED': {
        showPopup({
          title: 'Invite Failed',
          message: msg.message || 'Could not send invitation. Friend may be offline.',
          type: 'warning'
        });
        break;
      }

      case 'FRIENDS_STATUS': {
        setFriendsStatus(msg.friends || {});
        break;
      }

      case 'ERROR': {
        setErrorMessage(msg.message);
        showPopup({
          title: 'Match Notice',
          message: msg.message || 'An error occurred during the match.',
          type: 'error'
        });
        break;
      }

      default:
        break;
    }
  }, [uid]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const sendWs = useCallback((payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const joinQueue = useCallback((gameId = 'fruit-ninja') => {
    setMatchState('SEARCHING');
    sendWs({ type: 'JOIN_QUEUE', gameId });
  }, [sendWs]);

  const leaveQueue = useCallback(() => {
    sendWs({ type: 'LEAVE_QUEUE' });
    setMatchState('IDLE');
  }, [sendWs]);

  const confirmMatch = useCallback(() => {
    if (currentRoom) {
      sendWs({ type: 'CONFIRM_MATCH', roomId: currentRoom });
    }
  }, [currentRoom, sendWs]);

  const selectTier = useCallback((chosenTier) => {
    if (currentRoom) {
      sendWs({ type: 'SELECT_TIER', roomId: currentRoom, tier: chosenTier });
    }
  }, [currentRoom, sendWs]);

  const sendScore = useCallback((score, extra = null) => {
    setMyScore(score);
    if (currentRoom) {
      sendWs({ type: 'UPDATE_SCORE', roomId: currentRoom, score, extra });
    }
  }, [currentRoom, sendWs]);

  const submitFinalScore = useCallback((finalScore, reason = 'game_over') => {
    setMyScore(finalScore);
    if (currentRoom) {
      sendWs({ type: 'SUBMIT_FINAL_SCORE', roomId: currentRoom, score: finalScore, reason });
    }
  }, [currentRoom, sendWs]);

  const playAgain = useCallback(() => {
    setRematchRequested(true);
    if (currentRoom) {
      sendWs({ type: 'PLAY_AGAIN', roomId: currentRoom });
    }
  }, [currentRoom, sendWs]);

  const sendFriendInvite = useCallback((toUid, gameId = 'fruit-ninja') => {
    sendWs({ type: 'SEND_INVITE', toUid, gameId });
  }, [sendWs]);

  const respondToInvite = useCallback((inviteId, accept) => {
    sendWs({ type: 'RESPOND_INVITE', inviteId, accept });
    setIncomingInvite(null);
  }, [sendWs]);

  const checkFriendsStatus = useCallback((friendUids = []) => {
    if (friendUids.length > 0) {
      sendWs({ type: 'CHECK_FRIENDS_STATUS', friendUids });
    }
  }, [sendWs]);

  const setPlayerActivity = useCallback((status, gameName = '') => {
    sendWs({ type: 'SET_STATUS', status, gameName });
  }, [sendWs]);

  const dismissInvite = useCallback(() => {
    setIncomingInvite(null);
  }, []);

  const leaveRoom = useCallback((explicitRoomId = null) => {
    const targetRoomId = explicitRoomId || currentRoom;
    if (targetRoomId) {
      sendWs({
        type: 'LEAVE_ROOM',
        roomId: targetRoomId
      });
    }
  }, [currentRoom, sendWs]);

  const resetState = useCallback(() => {
    setMatchState('IDLE');
    setCurrentRoom(null);
    setOpponent(null);
    setSeed(null);
    setTier(null);
    setMyScore(0);
    setOpponentScore(0);
    setMatchResult(null);
    setRematchRequested(false);
    setOpponentWantsRematch(false);
    setOpponentGraceTimer(null);
  }, []);

  const value = {
    wsConnected,
    matchState,
    setMatchState,
    currentRoom,
    opponent,
    seed,
    tier,
    entryFee,
    totalPool,
    p1Tier,
    p2Tier,
    myScore,
    opponentScore,
    opponentExtra,
    matchResult,
    incomingInvite,
    friendsStatus,
    errorMessage,
    rematchRequested,
    opponentWantsRematch,
    opponentGraceTimer,
    coins,
    popup,

    showPopup,
    closePopup,
    joinQueue,
    leaveQueue,
    leaveRoom,
    confirmMatch,
    selectTier,
    sendScore,
    submitFinalScore,
    playAgain,
    sendFriendInvite,
    respondToInvite,
    checkFriendsStatus,
    setPlayerActivity,
    dismissInvite,
    resetState,
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
      <NeoAlertModal popup={popup} onClose={closePopup} />
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer() {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) {
    throw new Error('useMultiplayer must be used within MultiplayerProvider');
  }
  return ctx;
}
