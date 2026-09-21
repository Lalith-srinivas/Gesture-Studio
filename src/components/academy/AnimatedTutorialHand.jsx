import React from 'react';

/**
 * AnimatedTutorialHand
 * Renders an animated Subway-Surfers-style lane arrow across the road,
 * paired with a crystal-clear, high-definition semi-transparent white hand
 * demonstrating the exact hand gesture (1 Finger ☝️, 2 Fingers ✌️, Rock Sign 🤟, Fist ✊).
 */
export default function AnimatedTutorialHand({
  stepIndex = 1,
  isMatched = false,
  targetLane = 0,
}) {
  // Lane coordinate centers on 420x560 canvas:
  // Lane 0 = ~105px (25%), Lane 1 = ~210px (50%), Lane 2 = ~315px (75%)
  const lanePercents = { 0: '25%', 1: '50%', 2: '75%' };
  const targetX = lanePercents[targetLane] || '50%';

  // Hand colors
  const handFill = isMatched ? 'rgba(74, 222, 128, 0.45)' : 'rgba(255, 255, 255, 0.38)';
  const handStroke = isMatched ? '#4ade80' : '#FFFFFF';
  const handGlow = isMatched ? 'rgba(74, 222, 128, 0.9)' : 'rgba(255, 255, 255, 0.85)';
  const arrowColor = isMatched ? '#4ade80' : '#EF4444'; // Vibrant red like Subway Surfers, turns green on match!

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      <style>{`
        @keyframes arrowFlowLeft {
          0% { stroke-dashoffset: 60; opacity: 0.6; }
          50% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0.6; }
        }
        @keyframes arrowFlowRight {
          0% { stroke-dashoffset: -60; opacity: 0.6; }
          50% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0.6; }
        }
        @keyframes handFloatSway {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px) scale(1); }
          50% { transform: translate(-50%, -50%) translateY(-12px) scale(1.04); }
        }
        @keyframes chevronPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes boostRays {
          0% { transform: translateY(0px); opacity: 0.3; }
          50% { opacity: 1; }
          100% { transform: translateY(-30px); opacity: 0; }
        }
      `}</style>

      {/* ── 1. SUBWAY-SURFERS STYLE TRACK DIRECTIONAL ARROWS ─────────────── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none select-none" viewBox="0 0 420 560">
        <defs>
          {/* Arrow Glow Filter */}
          <filter id="arrowGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={arrowColor} floodOpacity="0.8" />
          </filter>
          <filter id="handShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={handGlow} floodOpacity="0.9" />
          </filter>

          {/* Gradients */}
          <linearGradient id="arrowGradRed" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#DC2626" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="arrowGradGreen" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4ADE80" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="handGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* STEP 1: Big Subway-Surfers Arrow Sweeping from Lane 2 to Lane 1 (Left) */}
        {stepIndex === 1 && (
          <g filter="url(#arrowGlow)">
            {/* Thick Curved Track Arrow */}
            <path
              d="M 210 430 Q 170 360 115 310"
              fill="none"
              stroke={isMatched ? 'url(#arrowGradGreen)' : 'url(#arrowGradRed)'}
              strokeWidth="18"
              strokeLinecap="round"
            />
            {/* Arrowhead in Lane 1 */}
            <polygon
              points="105,275 80,325 135,320"
              fill={isMatched ? '#4ADE80' : '#EF4444'}
              stroke="#000000"
              strokeWidth="2.5"
            />
            {/* Animated dashed line running along arrow */}
            <path
              d="M 210 430 Q 170 360 115 310"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="4"
              strokeDasharray="10 8"
              style={{ animation: 'arrowFlowLeft 0.8s linear infinite' }}
            />
          </g>
        )}

        {/* STEP 2: Big Subway-Surfers Arrow Sweeping from Lane 1 to Lane 2 (Center) */}
        {stepIndex === 2 && (
          <g filter="url(#arrowGlow)">
            {/* Thick Curved Track Arrow */}
            <path
              d="M 105 430 Q 150 360 205 310"
              fill="none"
              stroke={isMatched ? 'url(#arrowGradGreen)' : 'url(#arrowGradRed)'}
              strokeWidth="18"
              strokeLinecap="round"
            />
            {/* Arrowhead in Lane 2 */}
            <polygon
              points="210,275 180,320 235,325"
              fill={isMatched ? '#4ADE80' : '#EF4444'}
              stroke="#000000"
              strokeWidth="2.5"
            />
            {/* Animated dashed line running along arrow */}
            <path
              d="M 105 430 Q 150 360 205 310"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="4"
              strokeDasharray="10 8"
              style={{ animation: 'arrowFlowRight 0.8s linear infinite' }}
            />
          </g>
        )}

        {/* STEP 3: Big Subway-Surfers Arrow Sweeping from Lane 2 to Lane 3 (Right) */}
        {stepIndex === 3 && (
          <g filter="url(#arrowGlow)">
            {/* Thick Curved Track Arrow */}
            <path
              d="M 210 430 Q 255 360 310 310"
              fill="none"
              stroke={isMatched ? 'url(#arrowGradGreen)' : 'url(#arrowGradRed)'}
              strokeWidth="18"
              strokeLinecap="round"
            />
            {/* Arrowhead in Lane 3 */}
            <polygon
              points="315,275 285,320 340,325"
              fill={isMatched ? '#4ADE80' : '#EF4444'}
              stroke="#000000"
              strokeWidth="2.5"
            />
            {/* Animated dashed line running along arrow */}
            <path
              d="M 210 430 Q 255 360 310 310"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="4"
              strokeDasharray="10 8"
              style={{ animation: 'arrowFlowRight 0.8s linear infinite' }}
            />
          </g>
        )}

        {/* STEP 4: Double Forward Turbo Boost Chevrons */}
        {stepIndex === 4 && (
          <g filter="url(#arrowGlow)">
            <path
              d="M 210 440 L 210 300"
              fill="none"
              stroke={isMatched ? '#4ADE80' : '#FBBF24'}
              strokeWidth="18"
              strokeLinecap="round"
            />
            <polygon
              points="210,260 175,310 245,310"
              fill={isMatched ? '#4ADE80' : '#FBBF24'}
              stroke="#000000"
              strokeWidth="2.5"
            />
            {/* Turbo speed lines */}
            <line x1="185" y1="360" x2="185" y2="300" stroke="#FFFFFF" strokeWidth="4" strokeDasharray="8 6" style={{ animation: 'boostRays 0.6s linear infinite' }} />
            <line x1="235" y1="360" x2="235" y2="300" stroke="#FFFFFF" strokeWidth="4" strokeDasharray="8 6" style={{ animation: 'boostRays 0.6s linear infinite' }} />
          </g>
        )}
      </svg>

      {/* ── 2. CRYSTAL-CLEAR HIGH-DEFINITION WHITE TRANSLUCENT HAND ───────── */}
      <div
        className="absolute transition-all duration-300 flex flex-col items-center select-none"
        style={{
          left: stepIndex === 4 ? '50%' : targetX,
          top: stepIndex === 4 ? '52%' : '44%',
          animation: 'handFloatSway 2.2s ease-in-out infinite',
        }}
      >
        <div className="relative flex flex-col items-center">
          
          {/* STEP 1: ONE FINGER (INDEX POINT) ☝️ */}
          {stepIndex === 1 && (
            <svg width="105" height="135" viewBox="0 0 100 130" className="overflow-visible" style={{ filter: `drop-shadow(0 0 12px ${handGlow})` }}>
              {/* Palm and Base */}
              <path
                d="M 36 68 
                   C 36 56, 46 54, 52 56
                   C 56 54, 66 54, 70 58
                   C 74 56, 84 58, 84 68
                   L 84 94
                   C 84 112, 70 124, 50 124
                   C 32 124, 24 112, 24 94
                   L 24 76
                   C 24 66, 30 64, 36 68 Z"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3.5"
                strokeLinejoin="round"
              />

              {/* Extended Index Finger - Long, distinct & straight */}
              <path
                d="M 34 70
                   L 34 18
                   C 34 8, 50 8, 50 18
                   L 50 62"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Index Fingernail */}
              <path d="M 37 18 C 37 12, 47 12, 47 18" fill="none" stroke={handStroke} strokeWidth="2" />
              {/* Index Joint Creases */}
              <line x1="36" y1="36" x2="48" y2="36" stroke={handStroke} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
              <line x1="36" y1="52" x2="48" y2="52" stroke={handStroke} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />

              {/* Folded Middle Finger Knuckle */}
              <path d="M 50 62 C 50 54, 66 54, 66 62 L 66 78 C 66 84, 50 84, 50 78 Z" fill={isMatched ? handFill : 'url(#handGlass)'} stroke={handStroke} strokeWidth="2.5" />
              {/* Folded Ring Finger Knuckle */}
              <path d="M 66 64 C 66 56, 78 56, 78 64 L 78 80 C 78 86, 66 86, 66 80 Z" fill={isMatched ? handFill : 'url(#handGlass)'} stroke={handStroke} strokeWidth="2.5" />
              {/* Folded Pinky Knuckle */}
              <path d="M 78 68 C 78 60, 86 60, 86 68 L 86 84 C 86 90, 78 90, 78 84 Z" fill={isMatched ? handFill : 'url(#handGlass)'} stroke={handStroke} strokeWidth="2.5" />

              {/* Thumb wrapping over fingers */}
              <path
                d="M 24 82
                   C 18 78, 20 68, 30 70
                   C 38 72, 48 76, 54 82
                   C 58 86, 52 90, 46 88
                   C 36 84, 28 86, 24 82 Z"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {/* Thumb nail */}
              <path d="M 46 82 C 48 80, 52 82, 51 86" fill="none" stroke={handStroke} strokeWidth="1.8" />
            </svg>
          )}

          {/* STEP 2: TWO FINGERS (PEACE SIGN) ✌️ */}
          {stepIndex === 2 && (
            <svg width="115" height="140" viewBox="0 0 100 130" className="overflow-visible" style={{ filter: `drop-shadow(0 0 12px ${handGlow})` }}>
              {/* Palm Silhouette */}
              <path
                d="M 30 72 
                   C 30 62, 42 60, 50 64
                   C 54 60, 64 62, 68 66
                   C 72 64, 80 66, 80 76
                   L 80 94
                   C 80 112, 66 124, 48 124
                   C 30 124, 22 112, 22 94
                   L 22 80
                   C 22 72, 26 70, 30 72 Z"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3.5"
                strokeLinejoin="round"
              />

              {/* Index Finger (Angled Left) */}
              <path
                d="M 32 72
                   L 22 18
                   C 20 8, 36 4, 40 14
                   L 46 64"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Index Nail & Creases */}
              <path d="M 23 18 C 24 12, 34 10, 37 14" fill="none" stroke={handStroke} strokeWidth="2" />
              <line x1="26" y1="36" x2="40" y2="34" stroke={handStroke} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />

              {/* Middle Finger (Angled Right, Wide V Notch!) */}
              <path
                d="M 48 64
                   L 62 16
                   C 66 6, 80 12, 76 22
                   L 66 68"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Middle Nail & Creases */}
              <path d="M 64 16 C 68 10, 77 14, 74 20" fill="none" stroke={handStroke} strokeWidth="2" />
              <line x1="56" y1="36" x2="70" y2="40" stroke={handStroke} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />

              {/* Folded Ring Finger */}
              <path d="M 64 72 C 64 64, 76 64, 76 72 L 76 84 C 76 90, 64 90, 64 84 Z" fill={isMatched ? handFill : 'url(#handGlass)'} stroke={handStroke} strokeWidth="2.5" />
              {/* Folded Pinky Finger */}
              <path d="M 76 76 C 76 68, 84 68, 84 76 L 84 88 C 84 94, 76 94, 76 88 Z" fill={isMatched ? handFill : 'url(#handGlass)'} stroke={handStroke} strokeWidth="2.5" />

              {/* Thumb wrapped horizontally over folded ring */}
              <path
                d="M 22 84
                   C 16 80, 20 70, 30 72
                   C 38 74, 48 78, 54 84
                   C 58 88, 52 92, 46 90
                   C 34 86, 26 88, 22 84 Z"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {/* STEP 3: ROCK SIGN (INDEX & PINKY UP, CENTER FOLDED DOWN) 🤟 */}
          {stepIndex === 3 && (
            <svg width="115" height="140" viewBox="0 0 100 130" className="overflow-visible" style={{ filter: `drop-shadow(0 0 12px ${handGlow})` }}>
              {/* Palm Silhouette */}
              <path
                d="M 30 72 
                   C 30 62, 42 60, 48 64
                   L 60 64
                   C 66 60, 76 62, 78 72
                   L 78 94
                   C 78 112, 66 124, 48 124
                   C 30 124, 22 112, 22 94
                   L 22 80
                   C 22 72, 26 70, 30 72 Z"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3.5"
                strokeLinejoin="round"
              />

              {/* INDEX FINGER (Straight Up on Left) */}
              <path
                d="M 32 72
                   L 28 18
                   C 26 8, 42 6, 44 16
                   L 46 64"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M 29 18 C 30 12, 40 10, 42 16" fill="none" stroke={handStroke} strokeWidth="2" />
              <line x1="30" y1="36" x2="44" y2="36" stroke={handStroke} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />

              {/* PINKY FINGER (Straight Up on Right) */}
              <path
                d="M 68 70
                   L 76 28
                   C 78 18, 92 20, 88 32
                   L 80 80"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M 77 28 C 78 22, 88 24, 86 30" fill="none" stroke={handStroke} strokeWidth="2" />
              <line x1="74" y1="46" x2="84" y2="48" stroke={handStroke} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />

              {/* MIDDLE & RING FINGERS FOLDED DOWN TIGHTLY (Huge visible center gap!) */}
              <path
                d="M 46 64 C 46 54, 58 54, 58 64 L 58 80 C 58 86, 46 86, 46 80 Z"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="2.8"
              />
              <path
                d="M 58 64 C 58 54, 68 54, 68 64 L 68 80 C 68 86, 58 86, 58 80 Z"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="2.8"
              />

              {/* Thumb firmly folded over the middle and ring fingers */}
              <path
                d="M 22 84
                   C 16 80, 20 70, 32 72
                   C 42 74, 54 78, 62 84
                   C 66 88, 60 92, 52 90
                   C 36 86, 26 88, 22 84 Z"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3.2"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {/* STEP 4: CLOSED FIST (NITRO BOOST) ✊ */}
          {stepIndex === 4 && (
            <svg width="105" height="130" viewBox="0 0 100 120" className="overflow-visible" style={{ filter: `drop-shadow(0 0 14px ${handGlow})` }}>
              {/* Clenched Fist Silhouette */}
              <path
                d="M 24 60
                   C 24 40, 38 36, 50 36
                   C 62 36, 76 40, 76 60
                   L 76 86
                   C 76 104, 64 114, 50 114
                   C 34 114, 24 104, 24 86 Z"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3.8"
                strokeLinejoin="round"
              />

              {/* 4 Knuckle Creases side by side */}
              <line x1="33" y1="38" x2="33" y2="62" stroke={handStroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
              <line x1="46" y1="36" x2="46" y2="60" stroke={handStroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
              <line x1="59" y1="38" x2="59" y2="62" stroke={handStroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />

              {/* Horizontal Thumb locked tightly across fingers */}
              <path
                d="M 22 72
                   C 22 62, 32 58, 46 60
                   C 60 62, 70 64, 74 72
                   C 76 78, 70 84, 60 84
                   L 34 84
                   C 26 84, 22 80, 22 72 Z"
                fill={isMatched ? handFill : 'url(#handGlass)'}
                stroke={handStroke}
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <path d="M 64 70 C 68 68, 72 72, 70 76" fill="none" stroke={handStroke} strokeWidth="2" />

              {/* Turbo fire bursts */}
              <path d="M 12 48 L 4 40" stroke="#FFE600" strokeWidth="3" strokeLinecap="round" />
              <path d="M 88 48 L 96 40" stroke="#FFE600" strokeWidth="3" strokeLinecap="round" />
              <path d="M 50 24 L 50 12" stroke="#FFE600" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          )}

          {/* ── BOLD NEO-BRUTALIST INSTRUCTION BADGE ─────────────────────── */}
          <div className={`mt-2 px-3.5 py-1.5 font-display font-black text-xs uppercase tracking-wider border-3 border-black shadow-neo transition-all duration-200 text-center whitespace-nowrap ${
            isMatched
              ? 'bg-neo-lime text-black scale-110 shadow-neo-lg'
              : 'bg-white text-black'
          }`}>
            {isMatched ? (
              <span className="flex items-center gap-1.5">
                <span className="text-sm">✓</span>
                <span>MATCH DETECTED!</span>
              </span>
            ) : (
              <div className="flex flex-col items-center leading-tight">
                <span className="text-xs">
                  {stepIndex === 1 && '☝️ SHOW 1 FINGER'}
                  {stepIndex === 2 && '✌️ SHOW 2 FINGERS'}
                  {stepIndex === 3 && '🤟 SHOW ROCK SIGN'}
                  {stepIndex === 4 && '✊ MAKE CLOSED FIST'}
                </span>
                <span className="font-mono text-[9px] text-zinc-600 font-bold">
                  {stepIndex === 1 && 'DODGE TO LANE 1'}
                  {stepIndex === 2 && 'RETURN TO CENTER'}
                  {stepIndex === 3 && 'DODGE TO LANE 3'}
                  {stepIndex === 4 && 'TURBO NITRO BOOST'}
                </span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
