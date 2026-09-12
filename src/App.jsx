import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import AirDraw from './pages/AirDraw';
import FruitNinja from './pages/FruitNinja';
import HillClimbGame from './pages/crazyroad';
import FlappyBird from './pages/FlappyBird';
import ArcheryChallenge from './pages/ArcheryChallenge';
import BirdHunterChallenge from './pages/BirdHunterChallenge';
import GestureCursor from './components/GestureCursor';
import TutorialGate from './components/TutorialGate';
import { AuthProvider } from './context/AuthContext';

const GestureAcademy = lazy(() => import('./pages/GestureAcademy'));

/**
 * Renders GestureCursor only on pages that don't have their own camera/tracking.
 * AirDraw, FruitNinja, HillClimb, GestureAcademy, etc. manage their own camera/canvas, so skip cursor there.
 */
function ConditionalCursor() {
  const location = useLocation();
  const pagesWithOwnCamera = [
    '/air-draw',
    '/fruit-ninja',
    '/hill-climb',
    '/flappy-bird',
    '/archery',
    '/bird-hunter',
    '/gesture-academy',
  ];
  const hasOwnCamera = pagesWithOwnCamera.some(p => location.pathname.startsWith(p));

  if (hasOwnCamera) return null;
  return <GestureCursor />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <ConditionalCursor />
        <Routes>
          <Route path="/" element={<Home />} />
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
            path="/air-draw"
            element={
              <TutorialGate gameName="air-draw">
                <AirDraw />
              </TutorialGate>
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
        </Routes>
      </Router>
    </AuthProvider>
  );
}
