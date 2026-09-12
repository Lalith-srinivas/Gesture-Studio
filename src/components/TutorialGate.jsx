import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useGestureAcademy } from '../hooks/useGestureAcademy';
import InGameGestureGuide from './InGameGestureGuide';

/**
 * TutorialGate
 * Wraps a game component. Checks if the user has completed the tutorial
 * for this specific game or has enabled "Don't Show Again".
 * If not completed, redirects them to /gesture-academy?game=<gameName>.
 * Once completed, renders the game immediately along with the floating gesture helper.
 */
export default function TutorialGate({ gameName, children }) {
  const { isGameDone, settings } = useGestureAcademy(gameName);
  const location = useLocation();

  // If user opted out globally via "Don't Show Again", or already completed this game's tutorial
  if (settings.dontShow || isGameDone) {
    return (
      <>
        {children}
        <InGameGestureGuide gameName={gameName} />
      </>
    );
  }

  // Redirect to Gesture Academy with return context
  return (
    <Navigate
      to={`/gesture-academy?game=${encodeURIComponent(gameName)}`}
      state={{ from: location.pathname }}
      replace
    />
  );
}

