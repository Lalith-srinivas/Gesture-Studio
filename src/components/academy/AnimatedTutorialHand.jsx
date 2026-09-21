import React from 'react';

/**
 * AnimatedTutorialHand
 * Renders an animated, semi-transparent white tutorial hand directly on the game canvas.
 * Demonstrates the required gesture (Index Point ☝️, Peace Sign ✌️, Rock Sign 🤟, Fist ✊)
 * with directional cues and smooth floating animation.
 */
export default function AnimatedTutorialHand({
  stepIndex = 1,
  isMatched = false,
  targetLane = 0,
}) {
  // Lane positioning: Lane 0 = 24%, Lane 1 = 50%, Lane 2 = 76%
  const lanePositionStyles = {
    0: { left: '24%', transform: 'translateX(-50%)' },
    1: { left: '50%', transform: 'translateX(-50%)' },
    2: { left: '76%', transform: 'translateX(-50%)' },
  };

  const currentPos = stepIndex === 4
    ? { left: '50%', transform: 'translateX(-50%)', bottom: '26%' }
    : { ...lanePositionStyles[targetLane], top: '46%' };

  // Color scheme: Glowing White by default, Neon Lime when matched
  const fillColor = isMatched ? 'rgba(74, 222, 128, 0.35)' : 'rgba(255, 255, 255, 0.28)';
  const strokeColor = isMatched ? '#4ade80' : 'rgba(255, 255, 255, 0.95)';
  const glowColor = isMatched ? 'rgba(74, 222, 128, 0.85)' : 'rgba(255, 255, 255, 0.85)';

  return (
    <div
      className="absolute pointer-events-none z-20 flex flex-col items-center transition-all duration-300"
      style={currentPos}
    >
      <style>{`
        @keyframes floatHand {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.03); }
        }
        @keyframes nudgeLeft {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(-12px); }
        }
        @keyframes nudgeRight {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(12px); }
        }
        @keyframes pulseTurbo {
          0% { transform: scale(0.95); opacity: 0.85; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.85; }
        }
        @keyframes shockwave {
          0% { transform: scale(0.8); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* Target Lane Arrow Indicator for Step 1, 2, 3 */}
      {stepIndex !== 4 && (
        <div className={`mb-1.5 flex items-center justify-center font-mono font-black text-xs px-2.5 py-0.5 rounded-full border border-black/40 shadow-xs backdrop-blur-xs transition-colors ${
          isMatched ? 'bg-neo-lime text-black scale-105' : 'bg-black/60 text-white'
        }`}>
          {stepIndex === 1 && <span className="animate-pulse">← STEER HERE</span>}
          {stepIndex === 2 && <span className="animate-pulse">↓ CENTER LANE</span>}
          {stepIndex === 3 && <span className="animate-pulse">STEER HERE →</span>}
        </div>
      )}

      {/* Animated Hand Container */}
      <div
        className="relative flex items-center justify-center"
        style={{
          animation: isMatched
            ? 'none'
            : stepIndex === 1
            ? 'floatHand 2.2s ease-in-out infinite, nudgeLeft 1.4s ease-in-out infinite'
            : stepIndex === 3
            ? 'floatHand 2.2s ease-in-out infinite, nudgeRight 1.4s ease-in-out infinite'
            : stepIndex === 4
            ? 'pulseTurbo 1.2s ease-in-out infinite'
            : 'floatHand 2s ease-in-out infinite',
          filter: `drop-shadow(0 0 14px ${glowColor})`,
        }}
      >
        {/* Shockwave expanding ring for Step 4 (Nitro Boost) */}
        {stepIndex === 4 && (
          <div
            className="absolute inset-0 rounded-full border-2 border-neo-lime pointer-events-none"
            style={{ animation: 'shockwave 1.2s ease-out infinite' }}
          />
        )}

        {/* ── STEP 1: INDEX FINGER POINT ☝️ ──────────────────────────────────── */}
        {stepIndex === 1 && (
          <svg width="86" height="110" viewBox="0 0 100 130" className="overflow-visible">
            {/* Palm & Folded Fingers Silhouette */}
            <path
              d="M 38 72 
                 C 38 60, 48 55, 54 58
                 C 58 55, 66 56, 70 60
                 C 74 58, 82 62, 82 72
                 L 82 92
                 C 82 108, 70 120, 52 120
                 C 34 120, 26 108, 26 92
                 L 26 78
                 C 26 70, 32 68, 38 72 Z"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Extended Index Finger */}
            <path
              d="M 36 74
                 L 36 24
                 C 36 14, 52 14, 52 24
                 L 52 64"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Thumb Folded across Palm */}
            <path
              d="M 26 84
                 C 20 80, 22 68, 32 70
                 C 40 72, 46 76, 52 82"
              fill="none"
              stroke={strokeColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Knuckle Creases for curled fingers */}
            <path d="M 52 74 Q 60 76 68 74" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 68 76 Q 74 78 80 76" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* Wrist lines */}
            <path d="M 36 120 Q 52 124 68 120" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          </svg>
        )}

        {/* ── STEP 2: TWO FINGERS / PEACE SIGN ✌️ ─────────────────────────────── */}
        {stepIndex === 2 && (
          <svg width="90" height="116" viewBox="0 0 100 130" className="overflow-visible">
            {/* Palm & Folded Fingers Silhouette */}
            <path
              d="M 32 76 
                 C 32 66, 42 62, 50 66
                 C 54 62, 64 64, 68 68
                 C 72 66, 80 70, 80 80
                 L 80 94
                 C 80 110, 68 120, 52 120
                 C 34 120, 26 110, 26 94
                 L 26 82
                 C 26 74, 30 72, 32 76 Z"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Index Finger (angled slightly left) */}
            <path
              d="M 34 76
                 L 26 24
                 C 24 14, 40 10, 44 20
                 L 48 64"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Middle Finger (angled slightly right) */}
            <path
              d="M 48 64
                 L 58 18
                 C 62 8, 76 14, 72 24
                 L 64 68"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Thumb tucked over folded ring finger */}
            <path
              d="M 26 84
                 C 20 80, 24 70, 34 72
                 C 42 74, 52 78, 56 86"
              fill="none"
              stroke={strokeColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Knuckle Creases */}
            <path d="M 64 80 Q 72 82 78 80" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* Wrist line */}
            <path d="M 36 120 Q 52 124 68 120" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          </svg>
        )}

        {/* ── STEP 3: ROCK SIGN 🤟 ────────────────────────────────────────────── */}
        {stepIndex === 3 && (
          <svg width="90" height="116" viewBox="0 0 100 130" className="overflow-visible">
            {/* Palm & Folded Middle/Ring Silhouette */}
            <path
              d="M 34 74 
                 C 34 64, 44 62, 50 66
                 C 54 62, 62 64, 66 70
                 L 70 82
                 L 70 94
                 C 70 110, 60 120, 48 120
                 C 34 120, 26 110, 26 94
                 L 26 80
                 C 26 72, 30 70, 34 74 Z"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Index Finger (Extended up) */}
            <path
              d="M 34 74
                 L 30 24
                 C 28 14, 44 12, 46 22
                 L 48 66"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Pinky Finger (Extended up) */}
            <path
              d="M 66 72
                 L 76 34
                 C 78 26, 92 30, 88 40
                 L 76 84"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Thumb folded over middle & ring fingers */}
            <path
              d="M 26 84
                 C 20 80, 24 70, 36 74
                 C 46 76, 56 78, 62 82"
              fill="none"
              stroke={strokeColor}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            {/* Curled Middle & Ring Knuckles */}
            <path d="M 48 70 Q 56 72 64 70" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* Wrist line */}
            <path d="M 34 120 Q 48 124 64 120" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          </svg>
        )}

        {/* ── STEP 4: CLOSED FIST ✊ (NITRO BOOST) ────────────────────────────── */}
        {stepIndex === 4 && (
          <svg width="86" height="106" viewBox="0 0 100 120" className="overflow-visible">
            {/* Clenched Fist Silhouette */}
            <path
              d="M 26 62
                 C 26 44, 40 40, 52 40
                 C 64 40, 78 44, 78 62
                 L 78 86
                 C 78 104, 66 114, 52 114
                 C 36 114, 26 104, 26 86 Z"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="3.8"
              strokeLinejoin="round"
            />
            {/* Four Finger Knuckle Segments */}
            <path d="M 34 42 L 34 66" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <path d="M 48 40 L 48 64" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <path d="M 62 42 L 62 66" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            
            {/* Thumb Clenched across Finger Fronts */}
            <path
              d="M 24 74
                 C 24 64, 34 60, 48 62
                 C 62 64, 72 66, 76 74
                 C 78 80, 72 86, 62 86
                 L 38 86
                 C 28 86, 24 82, 24 74 Z"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Turbo Spark / Flare Lines */}
            <path d="M 16 52 L 8 46" stroke="#FFE600" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 88 52 L 96 46" stroke="#FFE600" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 52 28 L 52 18" stroke="#FFE600" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Gesture Name Badge below Animated Hand */}
      <div className={`mt-2 px-3 py-1 font-mono font-black text-xs uppercase tracking-wider border-2 border-black shadow-neo-sm transition-all duration-200 ${
        isMatched ? 'bg-neo-lime text-black scale-105' : 'bg-white/95 text-black'
      }`}>
        {isMatched ? (
          <span className="flex items-center gap-1">
            <span>✓</span>
            <span>MATCH DETECTED!</span>
          </span>
        ) : (
          <span>
            {stepIndex === 1 && '☝️ Show Index Finger'}
            {stepIndex === 2 && '✌️ Show Two Fingers'}
            {stepIndex === 3 && '🤟 Show Rock Sign'}
            {stepIndex === 4 && '✊ Clench Closed Fist'}
          </span>
        )}
      </div>
    </div>
  );
}

