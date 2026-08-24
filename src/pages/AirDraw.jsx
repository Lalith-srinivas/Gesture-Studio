import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHandTracking } from '../hooks/useHandTracking';
import DrawingCanvas from '../components/DrawingCanvas';
import Toolbar from '../components/Toolbar';
import ModeIndicator from '../components/ModeIndicator';
import { GESTURES, getGestureLabel } from '../utils/gestureDetector';

const GESTURE_HINTS = [
  GESTURES.DRAW,
  GESTURES.ERASE,
  GESTURES.PAN,
  GESTURES.STOP,
];

export default function AirDraw() {
  const navigate = useNavigate();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const videoRef      = useRef(null);
  const overlayRef    = useRef(null);
  const drawCanvasRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [gesture,        setGesture]        = useState(GESTURES.NONE);
  const [indexTip,       setIndexTip]       = useState(null);
  const [handDetected,   setHandDetected]   = useState(false);
  const [strokeColor,    setStrokeColor]    = useState('#A855F7');
  const [strokeWidth,    setStrokeWidth]    = useState(6);
  const [drawingEnabled, setDrawingEnabled] = useState(true);
  const [glowEnabled,    setGlowEnabled]    = useState(true);
  const [cameraError,    setCameraError]    = useState(null);
  const [cameraReady,    setCameraReady]    = useState(false);
  const [videoDims,      setVideoDims]      = useState({ width: 0, height: 0 });

  // ── Gesture callback ──────────────────────────────────────────────────────
  const handleGesture = useCallback((detectedGesture, tip, dims) => {
    setHandDetected(tip !== null);
    setGesture(detectedGesture);
    setIndexTip(tip);
    if (dims) setVideoDims(dims);
  }, []);

  // ── Hand tracking hook ────────────────────────────────────────────────────
  useHandTracking({
    videoRef,
    overlayCanvasRef: overlayRef,
    onGesture: handleGesture,
  });

  // ── Action handlers ───────────────────────────────────────────────────────
  const handleClearCanvas = () => drawCanvasRef.current?.clearCanvas();
  const handleSaveCanvas  = () => drawCanvasRef.current?.saveCanvas();

  return (
    <div className="w-full h-full flex flex-col bg-[#FFFDF5] text-black overflow-hidden absolute inset-0 font-sans selection:bg-neo-yellow">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-[#FFFDF5] border-b-3 border-black shadow-neo-sm flex-shrink-0 relative z-20">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/')}
            className="neo-btn-white px-2.5 py-1.5 text-xs font-mono font-black uppercase flex items-center gap-1.5"
            title="Back to Home"
          >
            <span>←</span>
            <span className="hidden sm:inline">HOME</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neo-purple border-2 border-black shadow-neo-sm flex items-center justify-center text-sm">
              🎨
            </div>
            <div>
              <h1 className="font-display font-black text-base sm:text-lg tracking-tight uppercase leading-none text-black">
                Air Draw Studio
              </h1>
              <p className="text-[10px] font-mono font-bold text-zinc-600 leading-tight hidden sm:block">
                AI COMPUTER VISION CANVAS
              </p>
            </div>
          </div>
        </div>

        <ModeIndicator
          gesture={gesture}
          handDetected={handDetected}
          drawingEnabled={drawingEnabled}
        />
      </header>

      {/* ── Main: Video + Canvas Stack ────────────────────────────────── */}
      <main className="flex-1 relative flex items-center justify-center bg-black overflow-hidden border-b-3 border-black">

        {/* Camera error overlay */}
        {cameraError && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 gap-4 p-8 text-center">
            <div className="neo-box-lg bg-white p-6 max-w-sm flex flex-col items-center">
              <div className="text-4xl mb-2">📷</div>
              <p className="font-display font-black text-lg text-neo-red uppercase">Camera Not Available</p>
              <p className="text-xs font-mono text-zinc-700 my-2">{cameraError}</p>
              <button
                onClick={() => window.location.reload()}
                className="neo-btn-primary px-4 py-2 text-xs uppercase mt-2"
              >
                ↻ Retry Camera
              </button>
            </div>
          </div>
        )}

        {/* Loading spinner (visible until camera is ready) */}
        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
            <div className="neo-box bg-white px-5 py-3 flex items-center gap-3">
              <div className="w-5 h-5 border-3 border-black border-t-neo-yellow rounded-full animate-spin" />
              <p className="font-mono text-xs font-bold text-black uppercase">INITIALIZING CAMERA…</p>
            </div>
          </div>
        )}

        {/* Webcam feed – mirrored */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)', zIndex: 1 }}
          onPlay={() => setCameraReady(true)}
          onError={() => setCameraError('Could not access camera. Please allow permissions and refresh.')}
        />

        {/* Landmark overlay canvas (mirrored to match video feed) */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: 'scaleX(-1)', zIndex: 5 }}
        />

        {/* Drawing canvas */}
        <DrawingCanvas
          ref={drawCanvasRef}
          gesture={gesture}
          indexTip={indexTip}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          drawingEnabled={drawingEnabled}
          glowEnabled={glowEnabled}
          videoDims={videoDims}
        />

        {/* Gesture hint chips – bottom-left styled like retro sticky notes */}
        <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-1.5 pointer-events-none">
          {GESTURE_HINTS.map((g) => {
            const { emoji, label } = getGestureLabel(g);
            const active = gesture === g;
            return (
              <div
                key={g}
                className={`
                  flex items-center gap-2 px-2.5 py-1 text-xs font-mono font-bold uppercase
                  border-2 border-black transition-all duration-150
                  ${active
                    ? 'bg-neo-yellow text-black shadow-neo-sm translate-x-1 scale-105'
                    : 'bg-white/80 text-zinc-700 shadow-[2px_2px_0px_#000000]'}
                `}
              >
                <span className="text-sm">{emoji}</span>
                <span>{label}</span>
              </div>
            );
          })}
        </div>

      </main>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <footer className="flex-shrink-0 px-3 sm:px-6 py-2.5 bg-[#FFFDF5] relative z-20">
        <Toolbar
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          onClear={handleClearCanvas}
          onSave={handleSaveCanvas}
          drawingEnabled={drawingEnabled}
          onToggleDrawing={() => setDrawingEnabled((p) => !p)}
          glowEnabled={glowEnabled}
          setGlowEnabled={setGlowEnabled}
        />
      </footer>
    </div>
  );
}
