import { getGestureLabel, GESTURES } from '../utils/gestureDetector';

const GESTURE_NEO_COLOR = {
  [GESTURES.DRAW]:  'bg-neo-purple text-black',
  [GESTURES.ERASE]: 'bg-neo-cyan text-black',
  [GESTURES.PAN]:   'bg-neo-yellow text-black',
  [GESTURES.STOP]:  'bg-neo-red text-white',
  [GESTURES.PINCH]: 'bg-neo-lime text-black',
  [GESTURES.NONE]:  'bg-white text-black',
};

/**
 * ModeIndicator
 * Shows the current gesture/mode with a tactile Neo-Brutalist badge.
 */
export default function ModeIndicator({ gesture, handDetected, drawingEnabled }) {
  const { emoji, label } = getGestureLabel(gesture);
  const colorClass = GESTURE_NEO_COLOR[gesture] ?? GESTURE_NEO_COLOR[GESTURES.NONE];

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Animated mode badge */}
      <div
        className={`
          flex items-center gap-2 px-3.5 py-1.5 border-2 sm:border-3 border-black shadow-neo-sm
          font-display font-black tracking-wide text-xs sm:text-sm uppercase transition-all duration-150
          ${colorClass}
        `}
      >
        <span className="text-base leading-none">{emoji}</span>
        <span>{label}</span>

        {gesture === GESTURES.DRAW && (
          <span
            className={`
              w-2.5 h-2.5 rounded-full border border-black ml-1
              ${drawingEnabled ? 'bg-black animate-pulse' : 'bg-zinc-400'}
            `}
          />
        )}
      </div>

      {/* Hand detection indicator */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-black shadow-neo-sm font-mono text-[11px] font-bold">
        <span
          className={`
            w-2.5 h-2.5 rounded-full border border-black transition-colors duration-200
            ${handDetected ? 'bg-neo-lime animate-pulse-slow' : 'bg-zinc-300'}
          `}
        />
        <span className="text-black hidden sm:inline-block">
          {handDetected ? 'TRACKING' : 'NO HAND'}
        </span>
      </div>
    </div>
  );
}
