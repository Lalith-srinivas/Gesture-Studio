import React, { useState, useEffect } from 'react';

/**
 * RewardedAdModal — Opt-in Neo-Brutalist Rewarded Ad Flow
 *
 * AdSense & H5 Game Ads Policy Compliance:
 * 1. User MUST explicitly opt-in.
 * 2. Reward is disclosed prior to viewing.
 * 3. Reward is granted ONLY after the ad is successfully watched/completed.
 * 4. User can decline or close with "No Thanks".
 */

export default function RewardedAdModal({
  isOpen,
  rewardTitle = 'Bonus Reward',
  rewardDescription = 'Watch a short video ad to earn bonus XP!',
  rewardAmount = '+50 XP',
  onRewarded,
  onDismiss,
}) {
  const [adPlaying, setAdPlaying] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    let timer;
    if (adPlaying && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (adPlaying && countdown === 0) {
      // Ad finished successfully — grant reward!
      setAdPlaying(false);
      setCountdown(3);
      if (typeof onRewarded === 'function') {
        onRewarded();
      }
    }
    return () => clearTimeout(timer);
  }, [adPlaying, countdown, onRewarded]);

  if (!isOpen) return null;

  const handleStartAd = () => {
    setAdPlaying(true);
    setCountdown(3);
    /* 
      ========================================================================
      FUTURE GOOGLE H5 / REWARDED ADS SDK INTEGRATION POINT:
      ========================================================================
      window.adBreak({
        type: 'reward',
        name: 'bonus_xp',
        beforeReward: (showAdFn) => { showAdFn(); },
        adDismissed: () => { handleClose(); },
        adViewed: () => { onRewarded(); },
      });
      ========================================================================
    */
  };

  const handleClose = () => {
    if (adPlaying) return; // Prevent dismissing while watching
    if (typeof onDismiss === 'function') {
      onDismiss();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div
        className="relative w-full max-w-sm bg-[#FFFDF5] border-3 md:border-4 border-black p-6 shadow-neo-xl text-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rewarded-modal-title"
      >
        {/* Top Header Badge */}
        <div className="inline-block px-3 py-1 bg-neo-yellow border-2 border-black font-mono font-black text-xs uppercase mb-3 shadow-neo-xs">
          🎁 REWARDED OFFER
        </div>

        <h3 id="rewarded-modal-title" className="font-display font-black text-2xl uppercase tracking-tight text-black mb-2">
          {rewardTitle}
        </h3>

        <p className="font-mono text-xs font-bold text-zinc-700 mb-4 leading-relaxed">
          {rewardDescription}
        </p>

        {/* Reward Showcase Box */}
        <div className="bg-neo-lime/30 border-3 border-black p-4 mb-5 rounded-lg">
          <span className="block font-mono text-[10px] font-black uppercase text-zinc-600">
            YOU WILL RECEIVE
          </span>
          <span className="font-display font-black text-3xl text-black tracking-tight">
            {rewardAmount}
          </span>
        </div>

        {adPlaying ? (
          <div className="bg-zinc-900 text-white p-4 border-2 border-black mb-3">
            <div className="text-xs font-mono font-bold uppercase text-neo-yellow mb-1">
              📺 SIMULATING SPONSORED MESSAGE...
            </div>
            <div className="font-mono text-2xl font-black">{countdown}s</div>
            <div className="text-[10px] text-zinc-400 font-mono mt-1">
              Reward will be granted upon completion
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleStartAd}
              className="neo-btn-primary w-full py-3 text-sm font-display uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <span>▶</span>
              <span>WATCH SHORT AD</span>
            </button>
            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-white hover:bg-zinc-100 text-black border-2 border-black font-mono font-bold text-xs uppercase shadow-neo-xs active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              NO THANKS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

