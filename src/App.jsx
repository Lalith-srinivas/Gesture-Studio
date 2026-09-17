import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import FruitNinja from './pages/FruitNinja';
import HillClimbGame from './pages/crazyroad';
import FlappyBird from './pages/FlappyBird';
import ArcheryChallenge from './pages/ArcheryChallenge';
import BirdHunterChallenge from './pages/BirdHunterChallenge';
import SpaceShooter from './pages/SpaceShooter';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import AchievementsPage from './pages/AchievementsPage';
import GestureCursor from './components/GestureCursor';
import TutorialGate from './components/TutorialGate';
import BottomNav from './components/BottomNav';
import AchievementToastContainer from './components/AchievementToast';
import LevelUpModal from './components/LevelUpModal';
import WelcomeModal from './components/WelcomeModal';
import { AuthProvider } from './context/AuthContext';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { AdProvider } from './context/AdContext';

const GestureAcademy = lazy(() => import('./pages/GestureAcademy'));

// ── One-time cache reset for clean slate (prevents stale ghosts) ────────────
try {
  if (localStorage.getItem('gs_clean_reset_v4') !== 'true') {
    // Clear all player profile caches, leaderboard caches, and legacy high scores
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith('gesture_studio_player_') ||
        key.startsWith('gesture_studio_stats_') ||
        key.startsWith('gs_lb_') ||
        key.startsWith('gesture_studio_lb_') ||
        key.includes('highscore') ||
        key.includes('HighScore') ||
        key === 'fn_highscore' ||
        key === 'flappy_hs' ||
        key === 'traffic_rider_high_score' ||
        key === 'archery_high_score' ||
        key === 'birdHunterHighScore' ||
        key === 'spaceShooterHighScore'
      ) {
        localStorage.removeItem(key);
      }
    });
    localStorage.setItem('gs_clean_reset_v4', 'true');
  }
} catch { /* silent */ }

/**
 * Renders GestureCursor only on pages that don't have their own camera/tracking.
 * FruitNinja, HillClimb, GestureAcademy, etc. manage their own camera/canvas.
 */
function ConditionalCursor() {
  const location = useLocation();
  const pagesWithOwnCamera = [
    '/fruit-ninja',
    '/hill-climb',
    '/flappy-bird',
    '/archery',
    '/bird-hunter',
    '/space-shooter',
    '/gesture-academy',
  ];
  const hasOwnCamera = pagesWithOwnCamera.some((p) => location.pathname.startsWith(p));
  if (hasOwnCamera) return null;
  return <GestureCursor />;
}

/**
 * Renders fixed BottomNav on hub/navigation pages (Home, Leaderboards, Academy, Profile, Achievements),
 * but hides it during active game sessions so it doesn't overlap canvases or controls.
 */
function ConditionalBottomNav() {
  const location = useLocation();
  const activeGames = [
    '/fruit-ninja',
    '/hill-climb',
    '/flappy-bird',
    '/archery',
    '/bird-hunter',
    '/space-shooter',
  ];
  const isInActiveGame = activeGames.some((p) => location.pathname.startsWith(p));
  if (isInActiveGame) return null;
  return <BottomNav />;
}

/**
 * Global modals (Level Up Celebration, Achievement Toasts)
 */
function GlobalProgressionModals() {
  const { pendingLevelUp, clearPendingLevelUp } = usePlayer();
  return (
    <>
      <WelcomeModal />
      <AchievementToastContainer />
      <LevelUpModal levelUpData={pendingLevelUp} onClose={clearPendingLevelUp} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <AdProvider>
          <Router>
            <ConditionalCursor />
            <GlobalProgressionModals />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/achievements" element={<AchievementsPage />} />
              <Route
                path="/gesture-academy"
                element={
                  <Suspense
                    fallback={
                      <div className="min-h-screen bg-neo-dots flex items-center justify-center font-display font-black text-xl">
                        LOADING GESTURE ACADEMY...
                      </div>
                    }
                  >
                    <GestureAcademy />
                  </Suspense>
                }
              />
              <Route
                path="/fruit-ninja"
                element={
                  <TutorialGate gameName="fruit-ninja">
                    <FruitNinja />
                  </TutorialGate>
                }
              />
              <Route
                path="/hill-climb"
                element={
                  <TutorialGate gameName="hill-climb">
                    <HillClimbGame />
                  </TutorialGate>
                }
              />
              <Route
                path="/flappy-bird"
                element={
                  <TutorialGate gameName="flappy-bird">
                    <FlappyBird />
                  </TutorialGate>
                }
              />
              <Route
                path="/archery"
                element={
                  <TutorialGate gameName="archery">
                    <ArcheryChallenge />
                  </TutorialGate>
                }
              />
              <Route
                path="/bird-hunter"
                element={
                  <TutorialGate gameName="bird-hunter">
                    <BirdHunterChallenge />
                  </TutorialGate>
                }
              />
              <Route
                path="/space-shooter"
                element={
                  <TutorialGate gameName="space-shooter">
                    <SpaceShooter />
                  </TutorialGate>
                }
              />
            </Routes>
            <ConditionalBottomNav />
          </Router>
        </AdProvider>
      </PlayerProvider>
    </AuthProvider>
  );
}
