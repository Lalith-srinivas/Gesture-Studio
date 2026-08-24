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

  // Cursor appearance based on state (Neo-Brutalist styling)
  const getCursorStyle = () => {
    if (isScrolling) {
      return {
        bg: '#FFE600',
        border: '#000000',
        emoji: scrollDir > 0 ? '👇' : scrollDir < 0 ? '👆' : '🖐️',
        scale: 'scale(1.25)',
      };
    }
    if (isPinching) {
      return {
        bg: '#4ADE80',
        border: '#000000',
        emoji: '🤏',
        scale: 'scale(0.8)',
      };
    }
    return {
      bg: '#00F0FF',
      border: '#000000',
      emoji: '☝️',
      scale: 'scale(1)',
    };
  };

  const cursor = getCursorStyle();

  return (
    <>
      {/* Small pip camera with Neo-Brutalism thick border & shadow */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          width: 130,
          height: 98,
          border: '3px solid #000000',
          boxShadow: '4px 4px 0px 0px #000000',
          zIndex: 9999,
          transform: 'scaleX(-1)',
          opacity: ready ? 0.8 : 0.3,
          pointerEvents: 'none',
          background: '#000',
          transition: 'opacity 0.3s',
        }}
      />

      {/* Gesture hints badge — Neo-Brutalist sticky notes */}
      {ready && (
        <div
          style={{
            position: 'fixed',
            bottom: 126,
            right: 16,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
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
                padding: '4px 10px',
                fontSize: 11,
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 800,
                textTransform: 'uppercase',
                background: h.active ? '#FFE600' : '#FFFDF5',
                color: '#000000',
                border: '2px solid #000000',
                boxShadow: h.active ? '3px 3px 0px 0px #000000' : '2px 2px 0px 0px #000000',
                transition: 'all 0.15s',
                transform: h.active ? 'scale(1.05) translateX(-2px)' : 'scale(1)',
              }}
            >
              <span style={{ fontSize: 13 }}>{h.emoji}</span>
              <span>{h.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Scroll direction indicator */}
      {isScrolling && scrollDir !== 0 && (
        <div
          style={{
            position: 'fixed',
            right: 24,
            top: scrollDir > 0 ? 'auto' : 24,
            bottom: scrollDir > 0 ? 150 : 'auto',
            zIndex: 10001,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            fontSize: 24,
            background: '#FFE600',
            border: '2px solid #000',
            boxShadow: '4px 4px 0px #000',
            padding: '6px 10px',
          }}>
            {scrollDir > 0 ? '⬇️ SCROLLING DOWN' : '⬆️ SCROLLING UP'}
          </div>
        </div>
      )}

      {/* Floating neo-brutalist cursor */}
      {position.x >= 0 && (
        <div
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            width: isScrolling ? 34 : 28,
            height: isScrolling ? 34 : 28,
            background: cursor.bg,
            border: `3px solid ${cursor.border}`,
            boxShadow: '3px 3px 0px 0px #000000',
            transform: `translate(-50%, -50%) ${cursor.scale}`,
            pointerEvents: 'none',
            zIndex: 10000,
            transition: 'transform 0.08s, background 0.08s, width 0.15s, height 0.15s',
          }}
        >
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 13,
          }}>
            {cursor.emoji}
          </div>
        </div>
      )}
    </>
  );
}
