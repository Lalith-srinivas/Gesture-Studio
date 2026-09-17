import React from 'react';

/**
 * AdSlot — Reusable Google AdSense & HTML5 Game Ads Placeholder Component
 *
 * Placements supported:
 *  - 'home'        : Header/Hero banner slot (controlled height, zero CLS)
 *  - 'game'        : Safe-area non-intrusive container outside game canvas
 *  - 'game-over'   : Post-match screen with guaranteed 16-24px separation from CTA buttons
 *  - 'transition'  : Between-game transition interstitial placeholder
 *  - 'rewarded'    : Optional rewarded ad container
 *
 * NOTE: Real AdSense scripts / publisher IDs are NOT mounted yet.
 * When integrating Google AdSense:
 * 1. Insert <ins className="adsbygoogle" ... /> inside the container.
 * 2. Push to window.adsbygoogle: (window.adsbygoogle = window.adsbygoogle || []).push({});
 */

// Sizing maps to avoid Cumulative Layout Shift (CLS)
const FORMAT_STYLES = {
  responsive: 'w-full min-h-[50px] max-h-[100px]',
  banner: 'w-full max-w-[468px] h-[60px] sm:h-[90px]',
  leaderboard: 'w-full max-w-[728px] h-[90px]',
  rectangle: 'w-full max-w-[300px] h-[100px] sm:h-[120px]',
  compact: 'w-full max-w-[320px] h-[50px]',
};

export default function AdSlot({
  placement = 'home',
  format = 'responsive',
  className = '',
  adUnitId = null, // Placeholder for future Google AdSense data-ad-slot
  collapseIfEmpty = false,
}) {
  const isDev = import.meta.env.DEV;

  // In production, if no active ad provider is loaded and collapseIfEmpty is requested,
  // collapse gracefully without layout shift.
  if (!isDev && collapseIfEmpty) {
    return null;
  }

  const formatClass = FORMAT_STYLES[format] || FORMAT_STYLES.responsive;

  return (
    <div
      data-ad-placement={placement}
      data-ad-slot-id={adUnitId || `placeholder-${placement}`}
      className={`ad-slot-container relative flex items-center justify-center overflow-hidden transition-all duration-200 select-none ${formatClass} ${className}`}
      style={{
        // Safe buffer to prevent accidental click interference with game controls
        contain: 'layout paint',
      }}
      aria-label="Advertisement Space"
    >
      {/* Visual placeholder for development and layout reservation */}
      <div className="w-full h-full border border-dashed border-zinc-400/60 bg-zinc-100/70 dark:bg-zinc-800/40 rounded-lg flex flex-col items-center justify-center p-2 text-center pointer-events-none">
        <span className="font-mono text-[10px] sm:text-xs font-bold tracking-wider uppercase text-zinc-500 flex items-center gap-1.5">
          <span>📢</span>
          <span>SPONSORED SPACE</span>
          {isDev && <span className="text-[9px] bg-zinc-200 dark:bg-zinc-700 px-1 rounded text-zinc-600 dark:text-zinc-300 font-mono">[{placement}]</span>}
        </span>
        {isDev && (
          <span className="font-mono text-[9px] text-zinc-400 mt-0.5">
            Google AdSense / H5 Ads ready
          </span>
        )}
      </div>

      {/* 
        ========================================================================
        FUTURE GOOGLE ADSENSE INTEGRATION POINT:
        ========================================================================
        When ready for real AdSense, replace or append inside this container:
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
          data-ad-slot={adUnitId}
          data-ad-format={format === 'responsive' ? 'auto' : undefined}
          data-full-width-responsive={format === 'responsive' ? 'true' : 'false'}
        />
        ========================================================================
      */}
    </div>
  );
}

