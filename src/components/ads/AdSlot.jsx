import React, { useEffect, useRef } from 'react';

const GOOGLE_ADSENSE_CLIENT = 'ca-pub-8062123304198916';

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
  adUnitId = null,
  collapseIfEmpty = false,
}) {
  const adRef = useRef(null);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    // Only push when adRef exists and hasn't already been populated by AdSense
    try {
      if (typeof window !== 'undefined' && adRef.current) {
        const alreadyFilled = adRef.current.getAttribute('data-adsbygoogle-status');
        if (!alreadyFilled) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      }
    } catch (e) {
      console.warn('[AdSlot] AdSense push note:', e?.message || e);
    }
  }, [placement]);

  if (!isDev && collapseIfEmpty) {
    return null;
  }

  const formatClass = FORMAT_STYLES[format] || FORMAT_STYLES.responsive;

  return (
    <div
      data-ad-placement={placement}
      data-ad-slot-id={adUnitId || `ad-slot-${placement}`}
      className={`ad-slot-container relative flex items-center justify-center overflow-hidden transition-all duration-200 ${formatClass} ${className}`}
      style={{
        contain: 'layout paint',
      }}
      aria-label="Advertisement Space"
    >
      {/* Real Google AdSense Unit */}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '100%', minHeight: '50px' }}
        data-ad-client={GOOGLE_ADSENSE_CLIENT}
        data-ad-slot={adUnitId || undefined}
        data-ad-format={format === 'responsive' ? 'auto' : 'horizontal'}
        data-full-width-responsive="true"
      />

      {/* Visual background placeholder for dev or when ad is loading */}
      {isDev && (
        <div className="absolute inset-0 border border-dashed border-zinc-400/50 bg-zinc-100/60 dark:bg-zinc-800/40 rounded-lg flex flex-col items-center justify-center p-2 text-center pointer-events-none -z-10">
          <span className="font-mono text-[10px] sm:text-xs font-bold tracking-wider uppercase text-zinc-500 flex items-center gap-1.5">
            <span>📢</span>
            <span>SPONSORED SPACE [{placement}]</span>
          </span>
          <span className="font-mono text-[9px] text-zinc-400 mt-0.5">
            Google AdSense: {GOOGLE_ADSENSE_CLIENT}
          </span>
        </div>
      )}
    </div>
  );
}
