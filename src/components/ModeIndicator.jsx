import { getGestureLabel, GESTURES } from '../utils/gestureDetector';

const GESTURE_RING_COLOR = {
  [GESTURES.DRAW]:  'ring-violet-500 shadow-violet-500/40',
  [GESTURES.ERASE]: 'ring-sky-500 shadow-sky-500/40',
  [GESTURES.PAN]:   'ring-amber-500 shadow-amber-500/40',
  [GESTURES.STOP]:  'ring-rose-500 shadow-rose-500/40',
  [GESTURES.PINCH]: 'ring-emerald-500 shadow-emerald-500/40',
  [GESTURES.NONE]:  'ring-zinc-700 shadow-transparent',
};

/**
 * ModeIndicator
 * Shows the current gesture/mode with an animated badge.
 */
export default function ModeIndicator({ gesture, handDetected, drawingEnabled }) {
  const { emoji, label, color } = getGestureLabel(gesture);
  const ringClass = GESTURE_RING_COLOR[gesture] ?? GESTURE_RING_COLOR[GESTURES.NONE];

  return (
    <div className="flex items-center gap-3">
      {/* Animated mode badge */}
      <div
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full
          ring-2 shadow-lg transition-all duration-300
          bg-black/40 backdrop-blur-sm
          ${ringClass}
        `}
      >
        <span className="text-lg leading-none">{emoji}</span>
        <span className={`text-sm font-semibold tracking-wide ${color}`}>
          {label}
        </span>

        {gesture === GESTURES.DRAW && (
          <span
            className={`
              w-2 h-2 rounded-full ml-1
              ${drawingEnabled ? 'bg-violet-400 animate-pulse' : 'bg-zinc-600'}
            `}
          />
        )}
      </div>

      {/* Hand detection indicator */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm">
        <span
          className={`
            w-2 h-2 rounded-full transition-colors duration-300
            ${handDetected ? 'bg-emerald-400 animate-pulse-slow' : 'bg-zinc-600'}
          `}
        />
        <span className="text-xs text-zinc-400">
          {handDetected ? 'Hand detected' : 'No hand'}
        </span>
      </div>
    </div>
  );
}
