import { useEffect } from 'react';
import { useMultiplayer } from '../context/MultiplayerContext';

/**
 * Automatically synchronizes a player's solo game activity with the multiplayer presence engine.
 * When a player is actively playing a solo game (e.g. Fruit Ninja, Space Shooter, etc.),
 * their status is reported as playing so friends see "Playing [Game]" and cannot interrupt with invites.
 */
export function useTrackSoloGame(gameName, isRunning) {
  const { setPlayerActivity } = useMultiplayer();

  useEffect(() => {
    if (isRunning) {
      setPlayerActivity('playing_solo', gameName);
    } else {
      setPlayerActivity('idle');
    }

    return () => {
      setPlayerActivity('idle');
    };
  }, [isRunning, gameName, setPlayerActivity]);
}

export default useTrackSoloGame;
