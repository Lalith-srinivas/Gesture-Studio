import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGestureAcademy } from '../hooks/useGestureAcademy';
import InGameGestureGuide from './InGameGestureGuide';

/**
 * TutorialGate
 * Wraps a game component.
 * Allows indexable DOM content to render immediately so search crawlers,
 * bots, and first-time players can access the game canvas directly without
 * an aggressive client-side HTTP redirect.
 * If the user hasn't tried this game before, displays an unobtrusive
 * suggestion modal offering a 30-second walkthrough or instant play.
 */
export default function TutorialGate({ gameName, children }) {
  const { isGameDone, settings, completeGame } = useGestureAcademy(gameName);
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const showSuggestion = !settings.dontShow && !isGameDone && !dismissed;

  const handleGoToAcademy = () => {
    navigate(`/gesture-academy?game=${encodeURIComponent(gameName)}`, {
      state: { from: location.pathname },
    });
  };

  const handleDismiss = () => {
    setDismissed(true);
    completeGame(gameName);
  };

  return (
    <>
      {children}
      <InGameGestureGuide gameName={gameName} />

      {showSuggestion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-suggestion-title"
        >
          <div className="relative w-full max-w-md bg-white border-4 border-black p-6 sm:p-7 shadow-neo-xl text-center space-y-4">
            <div className="inline-block px-3 py-1 bg-neo-yellow border-2 border-black font-mono font-black text-xs uppercase shadow-neo-xs rotate-[-1deg]">
              🎓 GESTURE RECOMMENDED
            </div>

            <h3
              id="tutorial-suggestion-title"
              className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-black"
            >
              First Time Playing?
            </h3>

            <p className="font-mono text-xs sm:text-sm text-zinc-700 leading-relaxed font-semibold">
              Master the hand motions in the Gesture Academy (30 seconds) or dive right into the game!
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleGoToAcademy}
                className="flex-1 py-3 px-4 bg-[#818CF8] hover:bg-[#6366F1] text-white border-3 border-black font-mono font-black text-xs sm:text-sm uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer"
              >
                🎓 Learn Gestures
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="flex-1 py-3 px-4 bg-neo-lime hover:bg-lime-400 text-black border-3 border-black font-mono font-black text-xs sm:text-sm uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer"
              >
                🎮 Play Now
              </button>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="text-[11px] font-mono font-bold text-zinc-500 hover:text-black uppercase underline cursor-pointer mt-1"
            >
              Don't ask again for this game
            </button>
          </div>
        </div>
      )}
    </>
  );
}
