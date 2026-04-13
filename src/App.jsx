import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import AirDraw from './pages/AirDraw';
import FruitNinja from './pages/FruitNinja';
import HillClimbGame from './pages/HillClimbGame';
import FlappyBird from './pages/FlappyBird';
import GestureCursor from './components/GestureCursor';

/**
 * Renders GestureCursor only on pages that don't have their own camera/tracking.
 * AirDraw, FruitNinja, and HillClimb manage their own camera, so skip cursor there.
 */
function ConditionalCursor() {
  const location = useLocation();
  const pagesWithOwnCamera = ['/air-draw', '/fruit-ninja', '/hill-climb', '/flappy-bird'];
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
      </Routes>
    </Router>
  );
}
