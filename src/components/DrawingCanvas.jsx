import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { GESTURES } from '../utils/gestureDetector';
import { mapHandToScreen } from '../utils/resolution';

/**
 * DrawingCanvas
 * Transparent canvas overlay that handles all drawing operations.
 * Exposed methods via ref: clearCanvas, saveCanvas
 */
const DrawingCanvas = forwardRef(function DrawingCanvas(
  { gesture, indexTip, strokeColor, strokeWidth, drawingEnabled, glowEnabled, videoDims },
  ref
) {
  const canvasRef = useRef(null);
  const prevPointRef = useRef(null);
  const isDrawingRef = useRef(false);
  const rafRef = useRef(null);
  const pendingRef = useRef(null); // buffered point to draw
  const pinchStartRef = useRef(null);
  const fractionalPan = useRef({ x: 0, y: 0 });
  const tmpCanvasRef = useRef(null); // reusable offscreen buffer

  // Expose clear and save to parent
  useImperativeHandle(ref, () => ({
    clearCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      prevPointRef.current = null;
    },
    saveCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `air-draw-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    },
  }));

  // Keep canvas sized to its container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      // Preserve existing drawing
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = canvas.width;
      tmpCanvas.height = canvas.height;
      tmpCanvas.getContext('2d').drawImage(canvas, 0, 0);

      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // Restore
      canvas.getContext('2d').drawImage(tmpCanvas, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Drawing engine — RAF loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const loop = () => {
      if (pendingRef.current) {
        const { x, y, color, width, shouldDraw, shouldErase, isPanning, pinchDelta } = pendingRef.current;
        pendingRef.current = null;

        const ctx = canvas.getContext('2d');

        // Handle canvas grab (pan)
        if (isPanning && pinchDelta && (pinchDelta.dx !== 0 || pinchDelta.dy !== 0)) {
          if (!tmpCanvasRef.current) {
            tmpCanvasRef.current = document.createElement('canvas');
          }
          const tmp = tmpCanvasRef.current;
          if (tmp.width !== canvas.width || tmp.height !== canvas.height) {
            tmp.width = canvas.width;
            tmp.height = canvas.height;
          }
          const tCtx = tmp.getContext('2d');
          tCtx.clearRect(0, 0, tmp.width, tmp.height);
          tCtx.drawImage(canvas, 0, 0);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(tmp, pinchDelta.dx, pinchDelta.dy);
          prevPointRef.current = null; // break stroke
        }

        // Handle draw/erase
        if ((shouldDraw || shouldErase) && prevPointRef.current && !isPanning) {
          ctx.beginPath();
          ctx.globalCompositeOperation = shouldErase ? 'destination-out' : 'source-over';
          ctx.moveTo(prevPointRef.current.x, prevPointRef.current.y);
          ctx.lineTo(x, y);
          ctx.strokeStyle = shouldErase ? '#000000' : color;
          // Eraser should be slightly thicker for usability
          ctx.lineWidth = shouldErase ? Math.max(width * 3, 20) : width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowBlur = shouldErase ? 0 : (glowEnabled ? 18 : 0);
          ctx.shadowColor = shouldErase ? 'transparent' : color;
          ctx.stroke();

          // Reset context just in case
          ctx.shadowBlur = 0;
          ctx.globalCompositeOperation = 'source-over';
        }

        if (shouldDraw || shouldErase) {
          prevPointRef.current = { x, y };
        } else {
          prevPointRef.current = null;
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // React to gesture / indexTip changes
  useEffect(() => {
    if (!indexTip || !canvasRef.current) {
      prevPointRef.current = null;
      return;
    }

    const canvas = canvasRef.current;

    // Convert normalized coords (0-1) to canvas pixels using the object-cover aware utility
    const { x, y } = mapHandToScreen(
      indexTip,
      canvas.width,
      canvas.height,
      videoDims.width,
      videoDims.height,
      true // mirrored
    );

    const shouldDraw = gesture === GESTURES.DRAW && drawingEnabled;
    const shouldErase = gesture === GESTURES.ERASE;
    const isPanning = gesture === GESTURES.PAN;
    let pinchDelta = null;

    if (isPanning) {
      if (!pinchStartRef.current) {
        pinchStartRef.current = { x: indexTip.x, y: indexTip.y };
        fractionalPan.current = { x: 0, y: 0 };
      } else {
        // Calculate delta based on normalized coordinates to ensure resolution-independent speed
        // Horizontal: (Start - Current) * width. In mirrored view, moving hand left (x inc) moves canvas left.
        const dx = (pinchStartRef.current.x - indexTip.x) * canvas.width;
        // Vertical: (Current - Start) * height. Moving hand down (y inc) moves canvas down.
        const dy = (indexTip.y - pinchStartRef.current.y) * canvas.height;
        
        pinchDelta = { dx: Math.round(dx), dy: Math.round(dy) };
        pinchStartRef.current = { x: indexTip.x, y: indexTip.y };
      }
    } else {
      pinchStartRef.current = null;
    }

    if (!shouldDraw && !shouldErase) {
      prevPointRef.current = null;
    }

    pendingRef.current = {
      x,
      y,
      color: strokeColor,
      width: strokeWidth,
      shouldDraw,
      shouldErase,
      isPanning,
      pinchDelta,
    };
  }, [gesture, indexTip, strokeColor, strokeWidth, drawingEnabled, glowEnabled]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
});

export default DrawingCanvas;
