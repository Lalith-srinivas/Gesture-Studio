/**
 * DailyRewardModal — Claim daily reward in a Neo-Brutalist modal.
 * Can be opened manually or automatically upon page load after 24 hours.
 */
import React, { useState, useEffect } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { DAILY_REWARDS } from '../services/dailyRewardService';

export default function DailyRewardModal({ isOpen, onClose, isAutoPrompt = false }) {
  const { nextDailyReward, claimDailyReward, dailyRewardClaimed, playerData } = usePlayer();
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState(null);

  // Reset claimResult whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setClaimResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClaim = async () => {
    setClaiming(true);
    const result = await claimDailyReward();
    setClaiming(false);
    if (!result?.error) {
      setClaimResult(result);
    }
  };

  const currentDay = nextDailyReward?.day || 1;
  const isClaimed = nextDailyReward?.claimed || dailyRewardClaimed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-sm bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-neo-yellow border-b-3 border-black p-4 flex items-center justify-between">
          <div>
            <div className="font-mono font-black text-[10px] uppercase tracking-wider text-zinc-800 mb-0.5 flex items-center gap-1.5">
              <span>{isAutoPrompt ? '⚡ DAILY BONUS UNLOCKED ⚡' : 'DAILY REWARD'}</span>
            </div>
            <h2 className="font-display font-black text-xl uppercase">
              {isAutoPrompt ? '🎁 Welcome Back!' : "🎁 Claim Today's Reward"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-mono font-black hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* 7-day calendar */}
        <div className="p-4">
          <p className="text-xs font-mono font-bold text-zinc-600 mb-3 text-center">
            {isAutoPrompt
              ? 'Claim your daily login reward to keep your streak going!'
              : 'Log in each day to unlock bigger XP multipliers!'}
          </p>

          <div className="grid grid-cols-7 gap-1 mb-4">
            {DAILY_REWARDS.map((reward) => {
              const isDone = (playerData?.dailyRewardDay || 0) >= reward.day;
              const isCurrent = reward.day === currentDay;
              return (
                <div
                  key={reward.day}
                  className={`
                    flex flex-col items-center p-1.5 border-2 rounded-lg text-center transition-all
                    ${isCurrent && !isClaimed
                      ? 'border-black bg-neo-yellow shadow-neo-sm scale-105 ring-2 ring-black'
                      : isCurrent && isClaimed
                      ? 'border-neo-lime bg-neo-lime/20'
                      : isDone
                      ? 'border-neo-lime bg-neo-lime/20'
                      : 'border-zinc-300 bg-zinc-50 opacity-60'
                    }
                  `}
                >
                  <span className="text-[10px] font-mono font-black text-zinc-600">D{reward.day}</span>
                  <span className="text-sm leading-none my-0.5">
                    {isDone || (isCurrent && isClaimed) ? '✅' : isCurrent ? '🎁' : '🔒'}
                  </span>
                  <span className="text-[8px] font-mono font-bold text-zinc-700">+{reward.xp}</span>
                </div>
              );
            })}
          </div>

          {/* Reward Display */}
          {claimResult ? (
            <div className="text-center py-3">
              <div className="text-4xl mb-1 animate-bounce">🎉</div>
              <div className="font-display font-black text-xl text-black">REWARD CLAIMED!</div>
              <div className="mt-2 inline-block bg-neo-lime border-3 border-black px-4 py-2 font-display font-black text-xl shadow-neo-sm">
                +{claimResult.xpEarned} XP
              </div>
              {claimResult.badge && (
                <div className="mt-2 font-mono font-bold text-xs text-zinc-800 bg-neo-yellow/30 border border-black p-1 rounded">
                  {claimResult.badge}
                </div>
              )}
            </div>
          ) : isClaimed ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-1">✅</div>
              <p className="font-mono font-black text-sm uppercase text-zinc-700">Already claimed today</p>
              <p className="font-mono text-xs text-zinc-500 mt-1">
                Come back tomorrow for Day {((currentDay % 7) + 1)} (+{DAILY_REWARDS.find(r => r.day === ((currentDay % 7) + 1))?.xp || 50} XP)!
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="bg-zinc-100 border-2 border-black p-4 rounded-xl mb-4 shadow-neo-xs">
                <div className="text-3xl mb-1">🎁</div>
                <div className="font-mono font-black text-sm uppercase text-zinc-700 mb-0.5">
                  {DAILY_REWARDS.find(r => r.day === currentDay)?.label}
                </div>
                <div className="font-display font-black text-3xl text-black">
                  +{DAILY_REWARDS.find(r => r.day === currentDay)?.xp} XP
                </div>
                {DAILY_REWARDS.find(r => r.day === currentDay)?.badge && (
                  <div className="mt-1 font-mono font-bold text-xs text-zinc-700">
                    {DAILY_REWARDS.find(r => r.day === currentDay)?.badge}
                  </div>
                )}
              </div>
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="w-full py-3.5 bg-neo-yellow hover:bg-yellow-400 text-black border-3 border-black font-display font-black text-base uppercase shadow-neo hover:shadow-neo-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <span>{claiming ? 'CLAIMING...' : 'CLAIM REWARD 🎁'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className={`w-full py-2.5 border-3 border-black font-display font-black text-xs sm:text-sm uppercase shadow-neo-xs active:translate-x-0.5 active:translate-y-0.5 transition-all ${
              claimResult
                ? 'bg-neo-lime hover:bg-green-400 text-black shadow-neo'
                : 'bg-zinc-100 hover:bg-zinc-200 text-black'
            }`}
          >
            {claimResult ? "AWESOME — LET'S PLAY! ➔" : 'CLOSE'}
          </button>
        </div>
      </div>
    </div>
  );
}
