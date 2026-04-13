import { useEffect, useRef, useState, useCallback } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';
import { GESTURES } from '../utils/gestureDetector';

/**
 * GestureCursor
 * A floating cursor controlled by hand on non-game pages.
 * Gestures:
 *   ☝️ DRAW  = move cursor
 *   🤏 PINCH = click element
 *   ✊ PAN   = scroll page (move hand up/down to scroll)
 *   ✋ STOP  = idle / show cursor
 */
export default function GestureCursor() {
  const videoRef = useRef(null);
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isPinching, setIsPinching] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollDir, setScrollDir] = useState(0); // -1 up, 0 none, 1 down
  const [ready, setReady] = useState(false);

  const lastPinchRef = useRef(0);
  const pinchTimeoutRef = useRef(null);
  const scrollAnchorRef = useRef(null); // Y position when scroll gesture starts
  const lastGestureRef = useRef(GESTURES.NONE);

  const handleGesture = useCallback((gesture, tip) => {
    if (!tip) {
      setPosition({ x: -100, y: -100 });
      setIsScrolling(false);
      setScrollDir(0);
      scrollAnchorRef.current = null;
      lastGestureRef.current = GESTURES.NONE;
      return;
    }

    if (!ready) setReady(true);

    // Map normalized [0,1] to viewport – mirrored
    const x = (1 - tip.x) * window.innerWidth;
    const y = tip.y * window.innerHeight;
    setPosition({ x, y });

    // ── STOP (Open Hand) = Scroll ─────────────────────────────────────────────
    if (gesture === GESTURES.STOP) {
      if (lastGestureRef.current !== GESTURES.STOP) {
        // Just started open hand — set anchor point
        scrollAnchorRef.current = y;
        setIsScrolling(true);
        setScrollDir(0);
      } else if (scrollAnchorRef.current !== null) {
        const delta = y - scrollAnchorRef.current;
        const deadzone = 20; // px — ignore tiny movements

        if (Math.abs(delta) > deadzone) {
          // Scroll speed proportional to distance from anchor
          const speed = Math.sign(delta) * Math.min(Math.abs(delta) * 0.15, 18);
          
          window.scrollBy({ top: speed, behavior: 'auto' });
          
          const rootEl = document.getElementById('root');
          if (rootEl) rootEl.scrollBy({ top: speed, behavior: 'auto' });
          
          // Also target the specific Home page wrapper that uses overflow-y-auto
          const scrollableWrappers = document.querySelectorAll('.overflow-y-auto');
          scrollableWrappers.forEach(el => el.scrollBy({ top: speed, behavior: 'auto' }));

          setScrollDir(delta > 0 ? 1 : -1);
        } else {
          setScrollDir(0);
        }
      }
    } else {
      // Reset scroll state when gesture changes away from STOP
      if (isScrolling) {
        setIsScrolling(false);
        setScrollDir(0);
        scrollAnchorRef.current = null;
      }
    }

    // ── PINCH = Click ───────────────────────────────────────────────────
    if (gesture === GESTURES.PINCH) {
      const now = Date.now();
      if (now - lastPinchRef.current > 400) {
        setIsPinching(true);
        lastPinchRef.current = now;

        const el = document.elementFromPoint(x, y);
        if (el) {
          el.click();
          el.style.transition = 'transform 0.1s';
          el.style.transform = 'scale(0.95)';
          setTimeout(() => { el.style.transform = ''; }, 100);
        }

        clearTimeout(pinchTimeoutRef.current);
        pinchTimeoutRef.current = setTimeout(() => setIsPinching(false), 200);
      }
    }

    lastGestureRef.current = gesture;
  }, [ready, isScrolling]);

  useHandTracking({
    videoRef,
    onGesture: handleGesture,
  });

  // Cursor appearance based on state
  const getCursorStyle = () => {
    if (isScrolling) {
      return {
        bg: 'rgba(245, 158, 11, 0.6)',
        border: 'rgba(245, 158, 11, 0.9)',
        emoji: scrollDir > 0 ? '👇' : scrollDir < 0 ? '👆' : '🖐️',
        scale: 'scale(1.2)',
      };
    }
    if (isPinching) {
      return {
        bg: '#10b981',
        border: '#fff',
        emoji: '🤏',
        scale: 'scale(0.7)',
      };
    }
    return {
      bg: 'rgba(255, 255, 255, 0.5)',
      border: 'rgba(255, 255, 255, 0.8)',
      emoji: '☝️',
      scale: 'scale(1)',
    };
  };

  const cursor = getCursorStyle();

  return (
    <>
      {/* Small pip camera for global tracking */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          width: 120,
          height: 90,
          borderRadius: 8,
          border: '2px solid rgba(255,255,255,0.15)',
          zIndex: 9999,
          transform: 'scaleX(-1)',
          opacity: ready ? 0.5 : 0.2,
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          background: '#000',
          transition: 'opacity 0.3s',
        }}
      />

      {/* Gesture hints badge — mobile only */}
      {ready && (
        <div
          style={{
            position: 'fixed',
            bottom: 110,
            right: 10,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            pointerEvents: 'none',
          }}
        >
          {[
            { emoji: '☝️', label: 'Move', active: !isScrolling && !isPinching },
            { emoji: '🤏', label: 'Click', active: isPinching },
            { emoji: '🖐️', label: 'Scroll', active: isScrolling },
          ].map((h) => (
            <div
              key={h.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 10,
                background: h.active ? 'rgba(139, 92, 246, 0.3)' : 'rgba(0,0,0,0.4)',
                color: h.active ? '#e9d5ff' : '#71717a',
                backdropFilter: 'blur(4px)',
                border: `1px solid ${h.active ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.05)'}`,
                transition: 'all 0.2s',
                transform: h.active ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <span style={{ fontSize: 12 }}>{h.emoji}</span>
              <span style={{ fontWeight: h.active ? 600 : 400 }}>{h.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Scroll direction indicator */}
      {isScrolling && scrollDir !== 0 && (
        <div
          style={{
            position: 'fixed',
            right: 20,
            top: scrollDir > 0 ? 'auto' : 20,
            bottom: scrollDir > 0 ? 140 : 'auto',
            zIndex: 10001,
            pointerEvents: 'none',
            animation: 'pulse 1s infinite',
          }}
        >
          <div style={{
            fontSize: 28,
            opacity: 0.7,
            filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.5))',
          }}>
            {scrollDir > 0 ? '⬇️' : '⬆️'}
          </div>
        </div>
      )}

      {/* Floating cursor */}
      {position.x >= 0 && (
        <div
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            width: isScrolling ? 30 : 24,
            height: isScrolling ? 30 : 24,
            background: cursor.bg,
            border: `2px solid ${cursor.border}`,
            borderRadius: '50%',
            transform: `translate(-50%, -50%) ${cursor.scale}`,
            pointerEvents: 'none',
            zIndex: 10000,
            boxShadow: isScrolling
              ? '0 0 20px rgba(245, 158, 11, 0.5)'
              : '0 0 15px rgba(255, 255, 255, 0.4)',
            transition: 'transform 0.08s, background 0.08s, width 0.15s, height 0.15s, box-shadow 0.15s',
          }}
        >
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 12,
          }}>
            {cursor.emoji}
          </div>
        </div>
      )}
    </>
  );
}
