import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const MusicContext = createContext(null);

const STORAGE_KEY = 'gs_bg_music_enabled';
const TRACK_SRC = '/the_mountain-future-technologies-153632.mp3';

const GAME_ROUTES = [
  '/fruit-ninja',
  '/hill-climb',
  '/flappy-bird',
  '/archery',
  '/bird-hunter',
  '/space-shooter',
];

// Atmospheric volume in menus / homepage, reduced volume in games so SFX remain clear
const MENU_VOLUME = 0.28;
const GAME_VOLUME = 0.08;

export function MusicProvider({ children }) {
  const location = useLocation();

  const [musicEnabled, setMusicEnabledState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const setMusicEnabled = useCallback((enabled) => {
    const val = Boolean(enabled);
    setMusicEnabledState(val);
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
    } catch {}

    if (!val && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (val && audioRef.current) {
      const p = audioRef.current.play();
      if (p !== undefined) {
        p.then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  }, []);

  const toggleMusic = useCallback(() => {
    setMusicEnabled(!musicEnabled);
  }, [musicEnabled, setMusicEnabled]);

  // Initialize and persist single global audio instance
  useEffect(() => {
    const audio = new Audio(TRACK_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = MENU_VOLUME;
    audioRef.current = audio;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    const tryPlay = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      const isEnabled = saved === null ? true : saved === 'true';
      if (audioRef.current && isEnabled) {
        const p = audioRef.current.play();
        if (p !== undefined) {
          p.then(() => setIsPlaying(true)).catch(() => {
            // Autoplay blocked until user interaction
          });
        }
      }
    };

    tryPlay();

    const handleFirstInteraction = () => {
      tryPlay();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
    window.addEventListener('keydown', handleFirstInteraction, { passive: true });
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  // Dynamically balance volume: softer in-game (0.08) so game SFX stay loud and clear, normal (0.28) in menus
  useEffect(() => {
    if (!audioRef.current) return;

    const isInGame = GAME_ROUTES.some((route) => location.pathname.startsWith(route));
    const targetVolume = isInGame ? GAME_VOLUME : MENU_VOLUME;

    audioRef.current.volume = targetVolume;

    if (musicEnabled && audioRef.current.paused) {
      const p = audioRef.current.play();
      if (p !== undefined) {
        p.then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  }, [location.pathname, musicEnabled]);

  const value = {
    musicEnabled,
    setMusicEnabled,
    toggleMusic,
    isPlaying,
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return ctx;
}

