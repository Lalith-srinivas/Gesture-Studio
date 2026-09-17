import React, { createContext, useContext, useState, useCallback } from 'react';
import RewardedAdModal from '../components/ads/RewardedAdModal';

/**
 * AdContext — Global controller for AdSense, H5 Game Ads & Rewarded flows
 * Provides non-intrusive ad hooks for game lifecycles.
 */
const AdContext = createContext(null);

export function AdProvider({ children }) {
  const [rewardedConfig, setRewardedConfig] = useState(null);
  const [isTransitionActive, setIsTransitionActive] = useState(false);

  /**
   * Request an opt-in Rewarded Ad.
   * Reward callback is ONLY executed when ad is completely watched.
   */
  const showRewardedAd = useCallback(
    ({
      rewardTitle = 'Bonus Reward',
      rewardDescription = 'Watch a short ad to earn a reward!',
      rewardAmount = '+50 XP',
      onRewarded,
      onDismiss,
    } = {}) => {
      setRewardedConfig({
        rewardTitle,
        rewardDescription,
        rewardAmount,
        onRewarded: () => {
          setRewardedConfig(null);
          if (typeof onRewarded === 'function') onRewarded();
        },
        onDismiss: () => {
          setRewardedConfig(null);
          if (typeof onDismiss === 'function') onDismiss();
        },
      });
    },
    []
  );

  /**
   * Request a between-game or post-game transition ad (interstitial).
   * Executes onComplete when finished or immediately if skipped.
   */
  const triggerTransitionAd = useCallback((onComplete) => {
    /*
      ========================================================================
      FUTURE GOOGLE H5 ADS INTERSTITIAL INTEGRATION POINT:
      ========================================================================
      window.adBreak({
        type: 'next',
        name: 'next_game_or_retry',
        beforeAd: () => { setIsTransitionActive(true); },
        afterAd: () => {
          setIsTransitionActive(false);
          if (typeof onComplete === 'function') onComplete();
        },
      });
      ========================================================================
    */
    // For now, in placeholder mode, transition finishes cleanly
    if (typeof onComplete === 'function') {
      onComplete();
    }
  }, []);

  return (
    <AdContext.Provider
      value={{
        showRewardedAd,
        triggerTransitionAd,
        isTransitionActive,
      }}
    >
      {children}

      {/* Opt-in Rewarded Ad Modal */}
      {rewardedConfig && (
        <RewardedAdModal
          isOpen={Boolean(rewardedConfig)}
          rewardTitle={rewardedConfig.rewardTitle}
          rewardDescription={rewardedConfig.rewardDescription}
          rewardAmount={rewardedConfig.rewardAmount}
          onRewarded={rewardedConfig.onRewarded}
          onDismiss={rewardedConfig.onDismiss}
        />
      )}
    </AdContext.Provider>
  );
}

export function useAd() {
  const context = useContext(AdContext);
  if (!context) {
    throw new Error('useAd must be used within an AdProvider');
  }
  return context;
}

