/**
 * Calculates the exact screen coordinates for a landmark given the container and video dimensions.
 * Handles 'object-cover' scaling and cropping logic.
 * 
 * @param {Object} lm - Normalized landmark from MediaPipe {x, y}
 * @param {number} containerW - Width of the display container (canvas/screen)
 * @param {number} containerH - Height of the display container (canvas/screen)
 * @param {number} videoW - Native width of the camera feed
 * @param {number} videoH - Native height of the camera feed
 * @param {boolean} mirrored - Whether to mirror the X axis (defaults to true for webcams)
 * @returns {Object} {x, y} in screen pixels
 */
export function mapHandToScreen(lm, containerW, containerH, videoW, videoH, mirrored = true) {
  // Fallback if dimensions are missing
  if (!videoW || !videoH || !containerW || !containerH) {
    const x = mirrored ? (1 - lm.x) * containerW : lm.x * containerW;
    return { x, y: lm.y * containerH };
  }

  const containerRatio = containerW / containerH;
  const videoRatio = videoW / videoH;

  let scale, xOffset = 0, yOffset = 0;

  if (containerRatio > videoRatio) {
    // Container is wider than video -> top/bottom cropped
    scale = containerW / videoW;
    yOffset = (videoH * scale - containerH) / 2;
  } else {
    // Container is taller than video -> left/right cropped
    scale = containerH / videoH;
    xOffset = (videoW * scale - containerW) / 2;
  }

  // Calculate mirrored or raw x
  const targetX = mirrored ? (1 - lm.x) : lm.x;
  
  return {
    x: (targetX * videoW * scale) - xOffset,
    y: (lm.y * videoH * scale) - yOffset
  };
}
