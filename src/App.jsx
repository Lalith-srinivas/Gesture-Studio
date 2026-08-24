import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import AirDraw from './pages/AirDraw';
import FruitNinja from './pages/FruitNinja';
import HillClimbGame from './pages/crazyroad';
import FlappyBird from './pages/FlappyBird';
import MobControlGame from './pages/MobControlGame';
import ArcheryChallenge from './pages/ArcheryChallenge';
import GestureCursor from './components/GestureCursor';

/**
 * Renders GestureCursor only on pages that don't have their own camera/tracking.
 * AirDraw, FruitNinja, HillClimb, etc. manage their own camera/canvas, so skip cursor there.
 */
function ConditionalCursor() {
  const location = useLocation();
  const pagesWithOwnCamera = [
    '/air-draw',
    '/fruit-ninja',
    '/hill-climb',
    '/flappy-bird',
    '/mob-control',
    '/archery',
  ];
  const hasOwnCamera = pagesWithOwnCamera.some(p => location.pathname.startsWith(p));

  if (hasOwnCamera) return null;
  return <GestureCursor />;
}

export default function App() {
  return (
    <Router>
      <ConditionalCursor />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/air-draw" element={<AirDraw />} />
        <Route path="/fruit-ninja" element={<FruitNinja />} />
        <Route path="/hill-climb" element={<HillClimbGame />} />
        <Route path="/flappy-bird" element={<FlappyBird />} />
        <Route path="/mob-control" element={<MobControlGame />} />
        <Route path="/archery" element={<ArcheryChallenge />} />
      </Routes>
    </Router>
  );
}
