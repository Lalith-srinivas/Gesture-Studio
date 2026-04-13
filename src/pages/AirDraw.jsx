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
  const [strokeColor,    setStrokeColor]    = useState('#a78bfa');
  const [strokeWidth,    setStrokeWidth]    = useState(4);
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
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] text-white overflow-hidden absolute inset-0">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5 flex-shrink-0 relative z-10 bg-[#0a0a0f]/80 backdrop-blur-md">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
            title="Back to Home"
          >
            ←
          </button>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500
                            flex items-center justify-center text-sm shadow-lg shadow-violet-500/30">
              ✋
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent">
                Air Draw
              </h1>
              <p className="text-[10px] text-zinc-500 leading-none hidden sm:block">Draw in the air with your hand</p>
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
      <main className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">

        {/* Camera error overlay */}
        {cameraError && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 gap-4 p-8 text-center">
            <div className="text-5xl">📷</div>
            <p className="text-lg font-semibold text-rose-400">Camera Not Available</p>
            <p className="text-sm text-zinc-400 max-w-xs">{cameraError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors mt-2 text-sm font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading spinner (visible until camera is ready) */}
        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
            <div className="flex flex-col items-center gap-3 text-zinc-600">
              <div className="w-10 h-10 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
              <p className="text-xs">Starting camera…</p>
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
          onError={() => setCameraError('Could not access camera. Please allow camera permissions and refresh.')}
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

        {/* Gesture hint chips – bottom-left */}
        <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-1 pointer-events-none">
          {GESTURE_HINTS.map((g) => {
            const { emoji, label, color } = getGestureLabel(g);
            const active = gesture === g;
            return (
              <div
                key={g}
                className={`
                  flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs
                  transition-all duration-200
                  ${active
                    ? `bg-white/15 backdrop-blur-sm ${color}`
                    : 'text-zinc-600'}
                `}
              >
                <span>{emoji}</span>
                <span className="font-medium">{label}</span>
              </div>
            );
          })}
        </div>

      </main>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <footer className="flex-shrink-0 px-4 pb-3 sm:pb-4 pt-2 border-t border-white/5 relative z-10 bg-[#0a0a0f]/80 backdrop-blur-md">
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
