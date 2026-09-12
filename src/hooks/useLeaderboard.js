/**
 * useLeaderboard
 * ─────────────
 * Subscribes to live Firestore leaderboard data.
 * Falls back to local cache when offline.
 * Returns [] when there's genuinely no data yet (not a loading/error state).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  subscribeGlobalLeaderboard,
  subscribeGameLeaderboard,
  getGlobalLeaderboard,
  getGameLeaderboard,
} from '../services/leaderboardService';

/**
 * @param {string} gameId  — 'global' for global leaderboard, or a game ID
 * @param {number} [topN]  — max entries to return (default 50)
 */
export function useLeaderboard(gameId = 'global', topN = 50) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result =
        gameId === 'global'
          ? await getGlobalLeaderboard(topN)
          : await getGameLeaderboard(gameId, topN);
      setData(result);
    } catch (err) {
      setError(err?.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [gameId, topN]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData([]);

    // Subscribe to live updates
    const unsub =
      gameId === 'global'
        ? subscribeGlobalLeaderboard(topN, (entries) => {
            setData(entries);
            setLoading(false);
          })
        : subscribeGameLeaderboard(gameId, topN, (entries) => {
            setData(entries);
            setLoading(false);
          });

    // Also do a one-time fetch immediately so cached data appears instantly
    // while the subscription initializes
    const fetchOnce = async () => {
      try {
        const result =
          gameId === 'global'
            ? await getGlobalLeaderboard(topN)
            : await getGameLeaderboard(gameId, topN);
        // Only use if we haven't received a live snapshot yet
        setData((prev) => (prev.length === 0 ? result : prev));
      } catch { /* silent — subscription will handle it */ }
      setLoading(false);
    };

    fetchOnce();

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [gameId, topN]);

  return { data, loading, error, refetch: load };
}
