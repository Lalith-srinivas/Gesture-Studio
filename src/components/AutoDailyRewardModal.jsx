import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import { useAuth } from '../hooks/useAuth';
import { getTodayDateString } from '../services/dailyRewardService';
import DailyRewardModal from './DailyRewardModal';

/**
 * AutoDailyRewardModal
 * Automatically pops up the daily reward modal when a player opens the app
 * after 24 hours / on a new day, eliminating the need to manually navigate
 * to the profile menu to claim it.
 */
export default function AutoDailyRewardModal() {
  const location = useLocation();
  const { dailyRewardClaimed, playerData, loading } = usePlayer();
  const { currentUser, loading: authLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Wait until auth and player data are ready
    if (loading || authLoading) return;

    // If already claimed today, do not auto-open
    if (dailyRewardClaimed) {
      setIsOpen(false);
      return;
    }

    // Do NOT interrupt active gameplay canvases
    const activeGames = [
      '/fruit-ninja',
      '/hill-climb',
      '/flappy-bird',
      '/archery',
      '/bird-hunter',
      '/space-shooter',
    ];
    const isInGame = activeGames.some((p) => location.pathname.startsWith(p));
    if (isInGame) {
      setIsOpen(false);
      return;
    }

    // If new visitor is seeing the WelcomeModal, don't stack modals on top
    const welcomeDismissed = localStorage.getItem('gesture_studio_welcome_dismissed') === 'true';
    const isPermanent = currentUser && !currentUser.isAnonymous;
    if (!welcomeDismissed && !isPermanent) {
      return;
    }

    const today = getTodayDateString();
    const sessionDismissed = sessionStorage.getItem(`gs_auto_daily_dismissed_${today}`) === 'true';
    if (sessionDismissed) {
      return;
    }

    // Gentle delay for smooth page entry before presenting the daily reward
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 700);

    return () => clearTimeout(timer);
  }, [loading, authLoading, dailyRewardClaimed, location.pathname, currentUser]);

  const handleClose = () => {
    const today = getTodayDateString();
    try {
      sessionStorage.setItem(`gs_auto_daily_dismissed_${today}`, 'true');
    } catch { /* silent */ }
    setIsOpen(false);
  };

  return (
    <DailyRewardModal
      isOpen={isOpen}
      onClose={handleClose}
      isAutoPrompt={true}
    />
  );
}

