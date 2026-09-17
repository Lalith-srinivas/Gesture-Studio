/**
 * WelcomeModal Component
 * Neo-brutalist onboarding dialog shown to new visitors on first launch.
 * Prompts the user to:
 * 1. Log in / Sign in (Google or Email) to access existing cloud scores across devices.
 * 2. OR enter a custom username and play immediately as Guest.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePlayer } from '../hooks/usePlayer';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { updateLeaderboardIdentity } from '../services/leaderboardService';
import AuthModal from './AuthModal';

const RANDOM_NAMES = [
  'CyberNinja',
  'SkyFalcon',
  'PixelMaster',
  'WaveRider',
  'AeroStrike',
  'NeonKnight',
  'ShadowBlade',
  'LaserFox',
  'TurboPilot',
  'Zenith',
];

export default function WelcomeModal() {
  const { currentUser, isGuest, loading: authLoading, loginWithGoogle, linkGoogleAccount, loginAsGuest } = useAuth();
  const { playerData } = usePlayer();

  const [isOpen, setIsOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [guestUsername, setGuestUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Check if first-time visitor
  useEffect(() => {
    if (authLoading) return;

    const dismissed = localStorage.getItem('gesture_studio_welcome_dismissed') === 'true';
    const isPermanent = currentUser && !currentUser.isAnonymous;

    // Show popup if not dismissed and user is not an established permanent account
    if (!dismissed && !isPermanent) {
      setIsOpen(true);
      // Prepopulate with an exciting random gamer tag
      const pick = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
      setGuestUsername(pick);
    } else {
      setIsOpen(false);
    }
  }, [authLoading, currentUser]);

  const handleDismiss = () => {
    try {
      localStorage.setItem('gesture_studio_welcome_dismissed', 'true');
    } catch {}
    setIsOpen(false);
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (isGuest) {
        const res = await linkGoogleAccount();
        if (!res.error) {
          handleDismiss();
          return;
        }
        // Account exists on another device: sign into it directly!
        const loginRes = await loginWithGoogle();
        if (!loginRes.error) {
          handleDismiss();
        } else {
          setErrorMsg(loginRes.error);
        }
      } else {
        const res = await loginWithGoogle();
        if (!res.error) {
          handleDismiss();
        } else {
          setErrorMsg(res.error);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlayAsGuest = async (e) => {
    e.preventDefault();
    const chosenName = guestUsername.trim() || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // If not yet authenticated as guest, authenticate first
      let currentUid = currentUser?.uid;
      if (!currentUid) {
        const res = await loginAsGuest(chosenName);
        currentUid = res?.user?.uid;
      }

      if (currentUid) {
        // Persist the chosen nickname
        const userRef = doc(db, 'users', currentUid);
        await setDoc(userRef, { username: chosenName, isAnonymous: true }, { merge: true });
        await updateLeaderboardIdentity(currentUid, { username: chosenName });
      }

      handleDismiss();
    } catch (err) {
      console.warn('[WelcomeModal] Guest username error:', err);
      handleDismiss();
    } finally {
      setIsSubmitting(false);
    }
  };

  const randomizeName = () => {
    const pick = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setGuestUsername(pick);
  };

  if (showAuthModal) {
    return (
      <AuthModal
        isOpen={true}
        onClose={() => {
          setShowAuthModal(false);
          if (currentUser && !currentUser.isAnonymous) {
            handleDismiss();
          }
        }}
      />
    );
  }

  if (!isOpen) return null;

  return (
    <>

      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none animate-fadeIn font-sans">
        <div className="relative w-full max-w-lg bg-white border-4 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rounded-2xl p-6 sm:p-8">
          
          {/* Header Badge & Logo */}
          <div className="text-center mb-6 flex flex-col items-center">
            <img
              src="/gesturestudio.png"
              alt="Gesture Studio Logo"
              className="w-16 h-16 object-contain filter drop-shadow-[3px_3px_0px_rgba(0,0,0,1)] mb-2"
            />
            <div className="inline-block px-3 py-1 bg-neo-yellow border-2 border-black font-mono font-black text-xs uppercase -rotate-2 mb-2 shadow-neo-sm">
              ✨ WELCOME TO GESTURE STUDIO ✨
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-black mt-1">
              CHOOSE HOW TO PLAY
            </h2>
            <p className="text-xs sm:text-sm font-mono text-zinc-600 mt-2 max-w-md mx-auto">
              Sign in to keep your high scores, ranks, and streaks synced across all your devices, or enter a username to play as a guest!
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-100 border-2 border-black text-xs font-mono font-bold text-rose-800 rounded">
              {errorMsg}
            </div>
          )}

          {/* OPTION 1: SIGN IN / LOG IN */}
          <div className="space-y-2.5 mb-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full py-3 bg-white hover:bg-yellow-50 border-3 border-black font-mono font-black text-xs sm:text-sm uppercase flex items-center justify-center gap-3 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>CONTINUE WITH GOOGLE</span>
            </button>

            <button
              onClick={() => setShowAuthModal(true)}
              disabled={isSubmitting}
              className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 border-2 border-black font-mono font-black text-xs uppercase flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-60"
            >
              <span>🔑</span>
              <span>LOG IN WITH EMAIL / PASSWORD</span>
            </button>
          </div>

          {/* DIVIDER */}
          <div className="flex items-center my-5">
            <div className="flex-1 border-t-2 border-black" />
            <span className="px-3 text-[11px] font-mono font-black uppercase text-zinc-500 bg-white">
              OR PLAY AS GUEST
            </span>
            <div className="flex-1 border-t-2 border-black" />
          </div>

          {/* OPTION 2: PLAY AS GUEST WITH USERNAME */}
          <form onSubmit={handlePlayAsGuest} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-mono font-black uppercase text-zinc-800">
                  CHOOSE YOUR GUEST NICKNAME
                </label>
                <button
                  type="button"
                  onClick={randomizeName}
                  className="text-[10px] font-mono font-bold text-indigo-600 hover:underline flex items-center gap-1"
                >
                  <span>🎲</span>
                  <span>Randomize</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength={20}
                  value={guestUsername}
                  onChange={(e) => setGuestUsername(e.target.value)}
                  placeholder="Enter username (e.g. CyberNinja)"
                  className="w-full px-3 py-2.5 border-3 border-black font-mono text-sm font-bold focus:outline-none focus:bg-yellow-50 shadow-neo-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-neo-lime hover:bg-lime-400 border-3 border-black font-mono font-black text-xs sm:text-sm uppercase flex items-center justify-center gap-2 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-60"
            >
              <span>🎮</span>
              <span>START PLAYING AS GUEST →</span>
            </button>
          </form>

          {/* Footer note */}
          <p className="text-[10px] font-mono text-zinc-400 text-center mt-4">
            You can always upgrade your guest account later in Settings to save your scores permanently.
          </p>
        </div>
      </div>
    </>
  );
}

