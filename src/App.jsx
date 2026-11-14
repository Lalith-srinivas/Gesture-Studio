import React, { Suspense, lazy, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import FruitNinja from './pages/FruitNinja';
import HillClimbGame from './pages/crazyroad';
import FlappyBird from './pages/FlappyBird';
import ArcheryChallenge from './pages/ArcheryChallenge';
import BirdHunterChallenge from './pages/BirdHunterChallenge';
import SpaceShooter from './pages/SpaceShooter';
import StickmanShowdown from './pages/StickmanShowdown';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import AchievementsPage from './pages/AchievementsPage';
import FriendsPage from './pages/FriendsPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import NotFoundPage from './pages/NotFoundPage';
import GestureCursor from './components/GestureCursor';
import TutorialGate from './components/TutorialGate';
import BottomNav from './components/BottomNav';
import CanonicalManager from './components/CanonicalManager';
import ErrorBoundary from './components/ErrorBoundary';
import AchievementToastContainer from './components/AchievementToast';
import LevelUpModal from './components/LevelUpModal';
import WelcomeModal from './components/WelcomeModal';
import AutoDailyRewardModal from './components/AutoDailyRewardModal';
import { AuthProvider } from './context/AuthContext';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { AdProvider } from './context/AdContext';
import { MultiplayerProvider } from './context/MultiplayerContext';
import { MusicProvider } from './context/MusicContext';
import MatchInviteNotification from './components/multiplayer/MatchInviteNotification';

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
    '/stickman-showdown',
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
    '/stickman-showdown',
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
      <AutoDailyRewardModal />
      <AchievementToastContainer />
      <LevelUpModal levelUpData={pendingLevelUp} onClose={clearPendingLevelUp} />
    </>
  );
}

/**
 * Ensures navigation to any page immediately scrolls to the beginning.
 * Uses native instant scroll without main-thread locking or DOM thrashing.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    // 1. Immediately reset window and document scroll
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    // 2. Clear root scroll if present
    const root = document.getElementById('root');
    if (root && root.scrollTop > 0) root.scrollTop = 0;

    // 3. Fallback on next animation frame
    const rafId = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      if (root && root.scrollTop > 0) root.scrollTop = 0;
    });

    return () => cancelAnimationFrame(rafId);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <AdProvider>
          <Router>
            <MultiplayerProvider>
              <MusicProvider>
                <ScrollToTop />
                <CanonicalManager />
                <ConditionalCursor />
                <GlobalProgressionModals />
                <MatchInviteNotification />
                <ErrorBoundary>
                <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/achievements" element={<AchievementsPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
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
              <Route
                path="/stickman-showdown"
                element={<StickmanShowdown />}
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </ErrorBoundary>
              <ConditionalBottomNav />
              </MusicProvider>
            </MultiplayerProvider>
          </Router>
        </AdProvider>
      </PlayerProvider>
    </AuthProvider>
  );
}
