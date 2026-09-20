import { useEffect, useRef, useState, useCallback } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';
import { GESTURES } from '../utils/gestureDetector';

const SKELETON_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initAnimeGL(canvas) {
  if (!canvas) return null;
  const gl = canvas.getContext('webgl', { alpha: false, preserveDrawingBuffer: false }) ||
             canvas.getContext('experimental-webgl', { alpha: false });
  if (!gl) return null;

  const vsSource = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      // Mirror X horizontally so it feels natural like looking in a mirror
      v_uv = vec2(0.5 - a_pos.x * 0.5, 0.5 - a_pos.y * 0.5);
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision mediump float;
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    varying vec2 v_uv;

    float getLuma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec2 d = vec2(1.0) / u_resolution;

      // Sobel Edge Detection for Cartoon Outlines
      float c00 = getLuma(texture2D(u_image, v_uv + vec2(-d.x, -d.y)).rgb);
      float c10 = getLuma(texture2D(u_image, v_uv + vec2(0.0, -d.y)).rgb);
      float c20 = getLuma(texture2D(u_image, v_uv + vec2(d.x, -d.y)).rgb);
      float c01 = getLuma(texture2D(u_image, v_uv + vec2(-d.x, 0.0)).rgb);
      float c21 = getLuma(texture2D(u_image, v_uv + vec2(d.x, 0.0)).rgb);
      float c02 = getLuma(texture2D(u_image, v_uv + vec2(-d.x, d.y)).rgb);
      float c12 = getLuma(texture2D(u_image, v_uv + vec2(0.0, d.y)).rgb);
      float c22 = getLuma(texture2D(u_image, v_uv + vec2(d.x, d.y)).rgb);

      float sx = -c00 - 2.0 * c01 - c02 + c20 + 2.0 * c21 + c22;
      float sy = -c00 - 2.0 * c10 - c20 + c02 + 2.0 * c12 + c22;
      float edge = sqrt(sx * sx + sy * sy);

      vec3 rgb = texture2D(u_image, v_uv).rgb;

      // Anime Saturation & Vibrancy Boost
      float l = getLuma(rgb);
      rgb = mix(vec3(l), rgb, 1.45);

      // Cel-Shading: Quantize into 4 clean anime tone levels
      rgb = floor(rgb * 4.0 + 0.5) / 4.0;

      // Overlay bold black ink outlines on detected edges
      if (edge > 0.16) {
        rgb = vec3(0.06, 0.06, 0.08);
      }

      gl_FragColor = vec4(rgb, 1.0);
    }
  `;

  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW
  );

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const aPos = gl.getAttribLocation(prog, 'a_pos');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uImg = gl.getUniformLocation(prog, 'u_image');

  return {
    gl,
    render(video) {
      if (!video || video.readyState < 2) return;
      gl.useProgram(prog);

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.uniform1i(uImg, 0);

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    destroy() {
      try {
        gl.deleteProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteBuffer(posBuf);
        gl.deleteTexture(texture);
      } catch (e) {}
    }
  };
}

/**
 * GestureCursor
 * A floating cursor controlled by hand on non-game pages.
 * Features a real-time Anime Cel-Shaded Live Camera Preview box.
 */
export default function GestureCursor() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  const [isCamHidden, setIsCamHidden] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const videoRef = useRef(null);
  const glCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const latestLandmarksRef = useRef(null);
  const isPinchingRef = useRef(false);

  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isPinching, setIsPinching] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollDir, setScrollDir] = useState(0); // -1 up, 0 none, 1 down
  const [ready, setReady] = useState(false);

  const lastPinchRef = useRef(0);
  const pinchTimeoutRef = useRef(null);
  const scrollAnchorRef = useRef(null);
  const lastGestureRef = useRef(GESTURES.NONE);

  const handleGesture = useCallback((gesture, tip, _dims, landmarks) => {
    latestLandmarksRef.current = landmarks || null;

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
        scrollAnchorRef.current = y;
        setIsScrolling(true);
        setScrollDir(0);
      } else if (scrollAnchorRef.current !== null) {
        const delta = y - scrollAnchorRef.current;
        const deadzone = 20;

        if (Math.abs(delta) > deadzone) {
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
        isPinchingRef.current = true;
        lastPinchRef.current = now;

        const el = document.elementFromPoint(x, y);
        if (el) {
          el.click();
          el.style.transition = 'transform 0.1s';
          el.style.transform = 'scale(0.95)';
          setTimeout(() => { el.style.transform = ''; }, 100);
        }

        clearTimeout(pinchTimeoutRef.current);
        pinchTimeoutRef.current = setTimeout(() => {
          setIsPinching(false);
          isPinchingRef.current = false;
        }, 200);
      }
    }

    lastGestureRef.current = gesture;
  }, [ready, isScrolling]);

  useHandTracking({
    videoRef,
    onGesture: handleGesture,
    enabled: true,
  });

  // ── Live Anime Cel-Shaded Video & Landmark Rendering Loop ──────────────────
  useEffect(() => {
    let animId;
    let glHelper = null;

    if (glCanvasRef.current) {
      glHelper = initAnimeGL(glCanvasRef.current);
    }

    const renderLoop = () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        // Render Anime Cel-Shaded Frame
        if (glHelper) {
          glHelper.render(video);
        } else if (glCanvasRef.current) {
          // Graceful 2D canvas fallback if WebGL unavailable
          const ctx = glCanvasRef.current.getContext('2d');
          if (ctx) {
            ctx.save();
            ctx.translate(glCanvasRef.current.width, 0);
            ctx.scale(-1, 1);
            ctx.filter = 'contrast(160%) saturate(160%)';
            ctx.drawImage(video, 0, 0, glCanvasRef.current.width, glCanvasRef.current.height);
            ctx.restore();
          }
        }

        // Render Anime Cyber Hand Skeleton Overlay
        const overlay = overlayCanvasRef.current;
        if (overlay) {
          const ctx = overlay.getContext('2d');
          ctx.clearRect(0, 0, overlay.width, overlay.height);

          const lms = latestLandmarksRef.current;
          if (lms && lms.length > 0) {
            const w = overlay.width;
            const h = overlay.height;

            // Glowing Bones
            ctx.strokeStyle = '#A3E635';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#A3E635';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            for (const [a, b] of SKELETON_CONNECTIONS) {
              ctx.moveTo((1 - lms[a].x) * w, lms[a].y * h);
              ctx.lineTo((1 - lms[b].x) * w, lms[b].y * h);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Joint Nodes
            for (let i = 0; i < lms.length; i++) {
              const x = (1 - lms[i].x) * w;
              const y = lms[i].y * h;
              const isTip = [4, 8, 12, 16, 20].includes(i);

              ctx.beginPath();
              ctx.arc(x, y, isTip ? 3.5 : 2, 0, Math.PI * 2);
              ctx.fillStyle = isTip ? '#FFE600' : '#FFFFFF';
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 1;
              ctx.fill();
              ctx.stroke();
            }

            // Pinch / Click Spark Effect
            if (isPinchingRef.current && lms[8]) {
              const tip = lms[8];
              const px = (1 - tip.x) * w;
              const py = tip.y * h;

              ctx.beginPath();
              ctx.arc(px, py, 8, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
              ctx.strokeStyle = '#FFE600';
              ctx.lineWidth = 2;
              ctx.fill();
              ctx.stroke();
            }
          }
        }
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
      glHelper?.destroy();
    };
  }, []);

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
      {/* Hidden hardware video element powering MediaPipe & the Anime canvas */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          opacity: 0,
          pointerEvents: 'none',
          width: 1,
          height: 1,
          zIndex: -10,
        }}
      />

      {/* Unhide Pill for Mobile when user clicked Hide */}
      {isMobile && isCamHidden && (
        <button
          type="button"
          onClick={() => setIsCamHidden(false)}
          style={{
            position: 'fixed',
            bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
            right: 12,
            zIndex: 9999,
            background: 'rgba(255, 230, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            color: '#000000',
            border: '2px solid rgba(0,0,0,0.8)',
            boxShadow: '2px 2px 0px rgba(0,0,0,0.4)',
            padding: '3px 8px',
            fontSize: '10px',
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: 0.85,
            transition: 'all 0.2s',
          }}
          title="Show Anime Cam"
        >
          <span>📷</span>
          <span>ANIME CAM</span>
        </button>
      )}

      {/* Real-time Anime Cel-Shaded Live Camera Preview Box */}
      {!isCamHidden && (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? 'calc(70px + env(safe-area-inset-bottom, 0px))' : 16,
            right: isMobile ? 12 : 16,
            width: isMobile ? 104 : 140,
            height: isMobile ? 78 : 105,
            border: isMobile ? '2px solid rgba(0,0,0,0.6)' : '3px solid #000000',
            boxShadow: isMobile ? '2px 2px 0px 0px rgba(0,0,0,0.3)' : '4px 4px 0px 0px #000000',
            zIndex: 9999,
            background: isMobile ? 'rgba(24, 24, 27, 0.35)' : '#18181B',
            opacity: isMobile ? 0.5 : (ready ? 0.95 : 0.4),
            backdropFilter: isMobile ? 'blur(3px)' : 'none',
            pointerEvents: isMobile ? 'auto' : 'none',
            transition: 'opacity 0.3s',
            overflow: 'hidden',
          }}
        >
          {/* Hardware-accelerated Anime WebGL Canvas */}
          <canvas
            ref={glCanvasRef}
            width={200}
            height={150}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'cover',
            }}
          />

          {/* Live Cyber Anime Landmark Skeleton Overlay */}
          <canvas
            ref={overlayCanvasRef}
            width={200}
            height={150}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
            }}
          />

          {/* Top Neo-Brutalist Badge: ANIME CAM */}
          <div
            style={{
              position: 'absolute',
              top: isMobile ? 3 : 4,
              left: isMobile ? 3 : 4,
              background: '#FFE600',
              color: '#000000',
              border: '1.5px solid #000000',
              boxShadow: '1.5px 1.5px 0px #000000',
              padding: isMobile ? '1px 3px' : '1px 5px',
              fontSize: isMobile ? '8px' : '9px',
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '2px' : '4px',
              pointerEvents: 'none',
            }}
          >
            <span style={{
              width: isMobile ? '4px' : '5px',
              height: isMobile ? '4px' : '5px',
              borderRadius: '50%',
              background: ready ? '#22C55E' : '#9CA3AF',
            }} />
            <span>ANIME CAM</span>
          </div>

          {/* Hide Button on Mobile / Desktop */}
          {isMobile && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCamHidden(true);
              }}
              style={{
                position: 'absolute',
                top: 3,
                right: 3,
                background: 'rgba(0, 0, 0, 0.65)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                padding: '1px 4px',
                fontSize: '8px',
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 900,
                cursor: 'pointer',
                lineHeight: 1,
                pointerEvents: 'auto',
                borderRadius: '2px',
              }}
              title="Hide Anime Cam"
            >
              ✕ HIDE
            </button>
          )}
        </div>
      )}

      {/* Gesture hints badge — Neo-Brutalist sticky notes (desktop only) */}
      {ready && !isMobile && (
        <div
          style={{
            position: 'fixed',
            bottom: 132,
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
