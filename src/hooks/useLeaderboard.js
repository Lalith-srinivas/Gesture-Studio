/**
 * useLeaderboard
 * Fetches global or per-game leaderboard data with loading/error state.
 */
import { useState, useEffect } from 'react';
import { getGlobalLeaderboard, getGameLeaderboard } from '../services/leaderboardService';

/**
 * @param {string|'global'} gameId — 'global' for global leaderboard, or a game ID
 * @param {number} [limit=50]
 */
export function useLeaderboard(gameId = 'global', limit = 50) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetch = async () => {
      try {
        const result =
          gameId === 'global'
            ? await getGlobalLeaderboard(limit)
            : await getGameLeaderboard(gameId, limit);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load leaderboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [gameId, limit]);

  return { data, loading, error, refetch: () => setLoading(true) };
}

