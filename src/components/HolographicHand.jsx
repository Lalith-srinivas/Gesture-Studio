/**
 * HolographicHand Component
 * Renders an animated, futuristic, semi-transparent holographic AR hand model
 * with visible joints, cybernetic glowing circuitry, and smooth gesture transitions.
 * NOT cartoon. NOT emoji. Professional AR visual demo.
 */
import React, { useMemo } from 'react';

// Anatomical coordinates (normalized 0..100) for canonical 21 hand landmarks
const DEFAULT_OPEN_PALM = [
  // 0: Wrist
  { x: 50, y: 88, z: 0 },
  // 1-4: Thumb
  { x: 38, y: 76, z: 2 },
  { x: 28, y: 66, z: 4 },
  { x: 20, y: 56, z: 6 },
  { x: 14, y: 48, z: 8 },
  // 5-8: Index finger
  { x: 38, y: 52, z: 2 },
  { x: 34, y: 38, z: 3 },
  { x: 31, y: 26, z: 4 },
  { x: 29, y: 14, z: 5 },
  // 9-12: Middle finger
  { x: 50, y: 50, z: 2 },
  { x: 50, y: 34, z: 3 },
  { x: 50, y: 22, z: 4 },
  { x: 50, y: 10, z: 5 },
  // 13-16: Ring finger
  { x: 62, y: 53, z: 2 },
  { x: 65, y: 38, z: 3 },
  { x: 67, y: 27, z: 4 },
  { x: 69, y: 16, z: 5 },
  // 17-20: Pinky finger
  { x: 74, y: 60, z: 2 },
  { x: 80, y: 49, z: 3 },
  { x: 84, y: 40, z: 4 },
  { x: 87, y: 31, z: 5 }
];

// Skeletal bone connections (MediaPipe standard)
const BONE_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm knuckles
  [5, 9], [9, 13], [13, 17]
];

export default function HolographicHand({
  gesture = 'OPEN_PALM',
  width = 320,
  height = 360,
  glowColor = '#38BDF8',
  secondaryColor = '#818CF8'
}) {
  // Transform landmarks dynamically based on gesture
  const landmarks = useMemo(() => {
    // Clone default
    const pts = DEFAULT_OPEN_PALM.map(p => ({ ...p }));

    switch (gesture) {
      case 'INDEX_POINT':
      case 'DRAW':
        // Index straight up (default), Middle, Ring, Pinky curled tightly into palm
        // Thumb folded over curled fingers
        pts[4] = { x: 38, y: 54, z: 8 }; // thumb tip
        // Middle curled
        pts[10] = { x: 50, y: 56, z: 5 };
        pts[11] = { x: 50, y: 64, z: 7 };
        pts[12] = { x: 48, y: 68, z: 9 };
        // Ring curled
        pts[14] = { x: 63, y: 58, z: 5 };
        pts[15] = { x: 63, y: 65, z: 7 };
        pts[16] = { x: 61, y: 70, z: 9 };
        // Pinky curled
        pts[18] = { x: 74, y: 63, z: 5 };
        pts[19] = { x: 74, y: 69, z: 7 };
        pts[20] = { x: 72, y: 73, z: 9 };
        break;

      case 'TWO_FINGERS':
      case 'ERASE':
      case 'PEACE':
        // Index and Middle extended in V-shape
        pts[8] = { x: 26, y: 15, z: 5 };
        pts[12] = { x: 56, y: 13, z: 5 };
        // Thumb folded
        pts[4] = { x: 42, y: 58, z: 8 };
        // Ring curled
        pts[14] = { x: 63, y: 58, z: 5 };
        pts[15] = { x: 63, y: 65, z: 7 };
        pts[16] = { x: 61, y: 70, z: 9 };
        // Pinky curled
        pts[18] = { x: 74, y: 63, z: 5 };
        pts[19] = { x: 74, y: 69, z: 7 };
        pts[20] = { x: 72, y: 73, z: 9 };
        break;

      case 'PINCH':
        // Thumb tip and Index tip touching closely together
        pts[4] = { x: 38, y: 36, z: 8 };
        pts[8] = { x: 40, y: 35, z: 8 };
        pts[7] = { x: 37, y: 44, z: 6 };
        // Middle, Ring, Pinky naturally curved backward/relaxed
        pts[10] = { x: 56, y: 40, z: 3 };
        pts[11] = { x: 62, y: 32, z: 4 };
        pts[12] = { x: 66, y: 25, z: 5 };
        pts[14] = { x: 68, y: 43, z: 3 };
        pts[15] = { x: 73, y: 36, z: 4 };
        pts[16] = { x: 77, y: 30, z: 5 };
        pts[18] = { x: 80, y: 50, z: 3 };
        pts[19] = { x: 84, y: 45, z: 4 };
        pts[20] = { x: 88, y: 40, z: 5 };
        break;

      case 'FIST':
      case 'PAN':
        // All fingers curled firmly into palm
        pts[4] = { x: 40, y: 56, z: 10 }; // Thumb wrapping index/middle
        // Index curled
        pts[6] = { x: 38, y: 50, z: 4 };
        pts[7] = { x: 37, y: 58, z: 7 };
        pts[8] = { x: 36, y: 64, z: 9 };
        // Middle curled
        pts[10] = { x: 50, y: 48, z: 4 };
        pts[11] = { x: 50, y: 57, z: 7 };
        pts[12] = { x: 49, y: 65, z: 9 };
        // Ring curled
        pts[14] = { x: 62, y: 51, z: 4 };
        pts[15] = { x: 62, y: 59, z: 7 };
        pts[16] = { x: 61, y: 66, z: 9 };
        // Pinky curled
        pts[18] = { x: 73, y: 56, z: 4 };
        pts[19] = { x: 73, y: 63, z: 7 };
        pts[20] = { x: 71, y: 69, z: 9 };
        break;

      case 'MOVE_LEFT':
        // Whole hand tilted leftward (-22deg) with arrows
        return DEFAULT_OPEN_PALM.map(p => {
          const rad = -0.38;
          const cx = 50, cy = 60;
          const nx = cx + (p.x - cx) * Math.cos(rad) - (p.y - cy) * Math.sin(rad) - 8;
          const ny = cy + (p.x - cx) * Math.sin(rad) + (p.y - cy) * Math.cos(rad);
          return { x: nx, y: ny, z: p.z };
        });

      case 'MOVE_RIGHT':
        // Whole hand tilted rightward (+22deg) with arrows
        return DEFAULT_OPEN_PALM.map(p => {
          const rad = 0.38;
          const cx = 50, cy = 60;
          const nx = cx + (p.x - cx) * Math.cos(rad) - (p.y - cy) * Math.sin(rad) + 8;
          const ny = cy + (p.x - cx) * Math.sin(rad) + (p.y - cy) * Math.cos(rad);
          return { x: nx, y: ny, z: p.z };
        });

      case 'SCROLL_UP':
        return DEFAULT_OPEN_PALM.map(p => ({ x: p.x, y: p.y - 10, z: p.z }));

      case 'SCROLL_DOWN':
        return DEFAULT_OPEN_PALM.map(p => ({ x: p.x, y: p.y + 8, z: p.z }));

      case 'ROCK':
        // Index and Pinky extended, Middle and Ring curled
        pts[8] = { x: 28, y: 15, z: 5 };
        pts[20] = { x: 86, y: 22, z: 5 };
        pts[4] = { x: 48, y: 56, z: 8 }; // thumb over middle/ring
        pts[11] = { x: 50, y: 58, z: 7 };
        pts[12] = { x: 49, y: 66, z: 9 };
        pts[15] = { x: 63, y: 60, z: 7 };
        pts[16] = { x: 62, y: 67, z: 9 };
        break;

      default:
        // OPEN_PALM
        break;
    }

    return pts;
  }, [gesture]);

  return (
    <div
      className="relative flex items-center justify-center select-none overflow-hidden"
      style={{ width, height }}
    >
      {/* Ambient Holographic Glow Aura */}
      <div
        className="absolute w-56 h-56 rounded-full blur-2xl opacity-40 pointer-events-none animate-pulse"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, ${secondaryColor} 60%, transparent 80%)`
        }}
      />

      {/* Cybernetic Scanline Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.06)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none" />

      {/* SVG Holographic Hand Skeleton */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full filter drop-shadow-[0_0_12px_rgba(56,189,248,0.7)] animate-float-gentle"
      >
        <defs>
          {/* Hologram gradient */}
          <linearGradient id="holoBoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#818CF8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#C084FC" stopOpacity="0.75" />
          </linearGradient>

          {/* Palm glass mesh gradient */}
          <radialGradient id="palmGlass" cx="50%" cy="65%" r="40%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
            <stop offset="70%" stopColor="#6366F1" stopOpacity="0.12" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Semi-transparent Glass Palm Fill */}
        <polygon
          points={`
            ${landmarks[0].x},${landmarks[0].y}
            ${landmarks[1].x},${landmarks[1].y}
            ${landmarks[5].x},${landmarks[5].y}
            ${landmarks[9].x},${landmarks[9].y}
            ${landmarks[13].x},${landmarks[13].y}
            ${landmarks[17].x},${landmarks[17].y}
          `}
          fill="url(#palmGlass)"
          stroke="#38BDF8"
          strokeWidth="0.6"
          strokeDasharray="2,2"
          opacity="0.7"
        />

        {/* Skeletal Connections (Bones) */}
        {BONE_CONNECTIONS.map(([a, b], idx) => {
          const p1 = landmarks[a];
          const p2 = landmarks[b];
          return (
            <g key={`bone-${idx}`}>
              {/* Outer soft glow line */}
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#38BDF8"
                strokeWidth="2.8"
                strokeOpacity="0.3"
                strokeLinecap="round"
              />
              {/* Inner core holographic beam */}
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="url(#holoBoneGrad)"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* Joint Nodes (21 landmarks) */}
        {landmarks.map((pt, i) => {
          const isTip = [4, 8, 12, 16, 20].includes(i);
          const isWrist = i === 0;

          return (
            <g key={`joint-${i}`}>
              {/* Outer pulse ring for finger tips */}
              {isTip && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="3.2"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="0.5"
                  opacity="0.8"
                  className="animate-ping"
                  style={{ animationDuration: '2.5s' }}
                />
              )}

              {/* Joint node body */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isTip ? 2.2 : isWrist ? 2.4 : 1.6}
                fill={isTip ? '#FFFFFF' : '#E0F2FE'}
                stroke="#0284C7"
                strokeWidth="0.8"
              />

              {/* Inner cyan core dot */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isTip ? 1.0 : 0.8}
                fill="#38BDF8"
              />
            </g>
          );
        })}

        {/* Directional Motion Wave indicator for Lateral Moves */}
        {gesture === 'MOVE_LEFT' && (
          <g opacity="0.9">
            <path
              d="M 28 50 L 16 50 M 16 50 L 21 45 M 16 50 L 21 55"
              stroke="#38BDF8"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x="12" y="63" fill="#38BDF8" fontSize="4.5" fontFamily="monospace" fontWeight="bold">
              TILT LEFT
            </text>
          </g>
        )}

        {gesture === 'MOVE_RIGHT' && (
          <g opacity="0.9">
            <path
              d="M 72 50 L 84 50 M 84 50 L 79 45 M 84 50 L 79 55"
              stroke="#38BDF8"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x="60" y="63" fill="#38BDF8" fontSize="4.5" fontFamily="monospace" fontWeight="bold">
              TILT RIGHT
            </text>
          </g>
        )}

        {gesture === 'SCROLL_UP' && (
          <g opacity="0.95">
            <path
              d="M 50 28 L 50 12 M 50 12 L 44 18 M 50 12 L 56 18"
              stroke="#38BDF8"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x="32" y="8" fill="#38BDF8" fontSize="4.5" fontFamily="monospace" fontWeight="bold">
              SWIPE UP
            </text>
          </g>
        )}

        {gesture === 'SCROLL_DOWN' && (
          <g opacity="0.95">
            <path
              d="M 50 72 L 50 88 M 50 88 L 44 82 M 50 88 L 56 82"
              stroke="#38BDF8"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x="28" y="96" fill="#38BDF8" fontSize="4.5" fontFamily="monospace" fontWeight="bold">
              SWIPE DOWN
            </text>
          </g>
        )}

        {/* Pinch Focus Ring */}
        {gesture === 'PINCH' && (
          <circle
            cx="39"
            cy="35.5"
            r="4.5"
            fill="none"
            stroke="#FDE047"
            strokeWidth="1"
            strokeDasharray="1.5,1.5"
            className="animate-spin-slow"
          />
        )}
      </svg>

      {/* Floating Hologram Grid Base Platform */}
      <div className="absolute bottom-1 w-44 h-8 border border-sky-400/40 rounded-[100%] bg-sky-500/10 transform rotate-x-60 pointer-events-none flex items-center justify-center">
        <div className="w-24 h-4 rounded-[100%] border border-cyan-300/60" />
      </div>
    </div>
  );
}
