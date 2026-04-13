import { useEffect, useRef, useCallback } from 'react';
import { detectGesture, GESTURES } from '../utils/gestureDetector';

/**
 * useHandTracking
 * Sets up MediaPipe Hands (loaded from CDN as window.Hands / window.Camera)
 * and connects it to a video element.
 *
 * @param {Object} params
 * @param {React.RefObject} params.videoRef         - ref to the <video> element
 * @param {React.RefObject} [params.overlayCanvasRef] - ref to landmark overlay <canvas> (optional)
 * @param {Function} params.onGesture              - called with (gesture, indexTip, videoDims, landmarks)
 */
export function useHandTracking({ videoRef, overlayCanvasRef, onGesture }) {
  const handsRef  = useRef(null);
  const cameraRef = useRef(null);
  const activeRef = useRef(true);

  // Draw landmark dots on overlay canvas
  const drawLandmarks = useCallback((canvas, landmarks, video) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks || !video) return;

    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const getCoord = (lm) => ({ x: lm.x * vW, y: lm.y * vH });

    // Skeleton connections
    const connections = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],
      [0,17],
    ];

    ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [a, b] of connections) {
      const { x: xa, y: ya } = getCoord(landmarks[a]);
      const { x: xb, y: yb } = getCoord(landmarks[b]);
      ctx.moveTo(xa, ya);
      ctx.lineTo(xb, yb);
    }
    ctx.stroke();

    // Landmark dots
    for (let i = 0; i < landmarks.length; i++) {
      const { x, y } = getCoord(landmarks[i]);
      const isFingerTip = [4, 8, 12, 16, 20].includes(i);
      ctx.beginPath();
      ctx.arc(x, y, isFingerTip ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isFingerTip
        ? 'rgba(167, 243, 208, 0.9)'
        : 'rgba(196, 181, 253, 0.7)';
      ctx.fill();
    }

    // Index tip ring
    const { x: tx, y: ty } = getCoord(landmarks[8]);
    ctx.beginPath();
    ctx.arc(tx, ty, 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(167, 243, 208, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    // Guard: check that CDN scripts loaded
    if (typeof window.Hands !== 'function' || typeof window.Camera !== 'function') {
      console.error('[useHandTracking] MediaPipe Hands/Camera not loaded from CDN. Check index.html script tags.');
      return;
    }

    activeRef.current = true;

    const hands = new window.Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults((results) => {
      if (!activeRef.current) return;

      const canvas = overlayCanvasRef?.current;
      const video  = videoRef.current;

      // Sync overlay canvas size
      if (canvas && video && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
      }

      const multiHandLandmarks = results.multiHandLandmarks;

      if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        onGesture(GESTURES.NONE, null);
        return;
      }

      const landmarks = multiHandLandmarks[0];

      if (canvas) drawLandmarks(canvas, landmarks, video);

      const gesture  = detectGesture(landmarks);
      const indexTip = landmarks[8];
      const dims     = video ? { width: video.videoWidth, height: video.videoHeight } : null;
      onGesture(gesture, indexTip, dims, landmarks);
    });

    handsRef.current = hands;

    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        if (!activeRef.current || !videoRef.current || !handsRef.current) return;
        try {
          await handsRef.current.send({ image: videoRef.current });
        } catch (e) {
          // Silently handle frame send errors (tab switch, etc.)
        }
      },
      width: 1280,
      height: 720,
    });

    camera.start().catch((err) => {
      console.error('[useHandTracking] Camera start failed:', err);
    });
    cameraRef.current = camera;

    return () => {
      activeRef.current = false;
      try { cameraRef.current?.stop(); } catch(e) {}
      try { handsRef.current?.close(); } catch(e) {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
