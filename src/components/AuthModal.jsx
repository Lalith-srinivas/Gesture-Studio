/**
 * AuthModal Component
 * Neo-brutalist authentication dialog matching Gesture Studio design language.
 * Supports:
 * - One-click Google Sign-In
 * - Instant Guest Mode (play immediately)
 * - Email & Password Sign In / Sign Up
 * - Seamless Guest-to-Permanent Account upgrade
 */
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function AuthModal({ isOpen, onClose }) {
  const {
    currentUser,
    isGuest,
    userProfile,
    loginAsGuest,
    loginWithGoogle,
    loginWithEmail,
    registerUser,
    linkGoogleAccount,
    logout,
    authError,
    isOffline
  } = useAuth();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [localMsg, setLocalMsg] = useState(null);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setLoadingAction(true);
    setLocalMsg(null);
    try {
      if (isGuest) {
        // Link existing guest account so progress is preserved
        const res = await linkGoogleAccount();
        if (!res.error) {
          setLocalMsg('Account successfully linked with Google! All progress preserved.');
          setTimeout(onClose, 1200);
        }
      } else {
        const res = await loginWithGoogle();
        if (!res.error) onClose();
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleGuest = async () => {
    setLoadingAction(true);
    setLocalMsg(null);
    try {
      const res = await loginAsGuest();
      if (!res.error) onClose();
    } finally {
      setLoadingAction(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoadingAction(true);
    setLocalMsg(null);
    try {
      if (mode === 'signup') {
        const res = await registerUser(email, password, displayName);
        if (!res.error) onClose();
      } else {
        const res = await loginWithEmail(email, password);
        if (!res.error) onClose();
      }
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-2xl p-6 font-sans">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-9 h-9 bg-neo-pink border-3 border-black rounded-full flex items-center justify-center font-mono font-black text-black hover:bg-rose-400 active:translate-x-0.5 active:translate-y-0.5 shadow-neo-sm"
        >
          ?
        </button>

        {/* Offline Badge if applicable */}
        {isOffline && (
          <div className="mb-4 bg-amber-200 border-2 border-black px-3 py-1.5 rounded-lg text-xs font-mono font-black flex items-center gap-2">
            <span>??</span>
            <span>OFFLINE MODE: Scores & progress saved locally</span>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-block px-3 py-1 bg-neo-yellow border-2 border-black font-mono font-black text-xs uppercase -rotate-2 mb-2">
            {currentUser && isGuest ? 'UPGRADE GUEST ACCOUNT' : currentUser ? 'PLAYER PROFILE' : 'JOIN THE CHALLENGE'}
          </div>
          <h2 className="font-display font-black text-2xl uppercase tracking-tight text-black">
            {currentUser && !isGuest ? `Welcome, ${userProfile?.username || 'Player'}!` : 'Gesture Studio Account'}
          </h2>
          <p className="text-xs font-mono text-zinc-600 mt-1">
            {currentUser && isGuest
              ? 'Connect Google to sync your high scores across all devices.'
              : currentUser
              ? 'Your stats, streaks, and achievements are synced with Cloud Firestore.'
              : 'Sign in to save scores to global leaderboards & track your streaks.'}
          </p>
        </div>

        {/* User Stats Card (If already logged in) */}
        {currentUser && !isGuest ? (
          <div className="space-y-4">
            <div className="bg-zinc-100 border-3 border-black p-4 rounded-xl flex items-center gap-4">
              <img
                src={userProfile?.avatar || currentUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.uid}`}
                alt="Avatar"
                className="w-14 h-14 rounded-full border-2 border-black bg-white"
              />
              <div className="flex-1 min-w-0">
                <div className="font-black text-sm uppercase truncate">{userProfile?.username || 'Player'}</div>
                <div className="text-xs font-mono text-zinc-600 truncate">{currentUser.email}</div>
                <div className="flex items-center gap-2 mt-1 text-xs font-mono font-bold">
                  <span className="bg-neo-yellow px-1.5 border border-black">?? {userProfile?.currentStreak || 1} Day Streak</span>
                  <span className="bg-neo-cyan px-1.5 border border-black">? {userProfile?.totalScore || 0} pts</span>
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                await logout();
                onClose();
              }}
              className="w-full py-2.5 bg-zinc-200 border-3 border-black font-mono font-black text-xs uppercase hover:bg-rose-200 active:translate-x-0.5 active:translate-y-0.5 shadow-neo-sm"
            >
              Sign Out
            </button>
          </div>
        ) : (
          /* Sign In / Sign Up View */
          <div className="space-y-4">
            
            {/* Google Sign In */}
            <button
              onClick={handleGoogle}
              disabled={loadingAction}
              className="w-full py-3 bg-white hover:bg-zinc-50 border-3 border-black font-mono font-black text-xs uppercase flex items-center justify-center gap-3 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{isGuest ? 'Connect Google to Save Progress' : 'Continue with Google'}</span>
            </button>

            {/* Quick Guest Mode (If not already a guest) */}
            {!isGuest && (
              <button
                onClick={handleGuest}
                disabled={loadingAction}
                className="w-full py-2.5 bg-neo-lime hover:bg-lime-400 border-3 border-black font-mono font-black text-xs uppercase flex items-center justify-center gap-2 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60"
              >
                <span>??</span>
                <span>Play as Guest (Instant Play)</span>
              </button>
            )}

            <div className="flex items-center my-3">
              <div className="flex-1 border-t-2 border-black" />
              <span className="px-3 text-[10px] font-mono font-black uppercase text-zinc-500">OR WITH EMAIL</span>
              <div className="flex-1 border-t-2 border-black" />
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {mode === 'signup' && (
                <div>
                  <label className="block text-[10px] font-mono font-black uppercase mb-1">Player Handle</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. CyberNinja"
                    className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none focus:bg-yellow-50"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-mono font-black uppercase mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@example.com"
                  className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none focus:bg-yellow-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-black uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 border-2 border-black font-mono text-xs focus:outline-none focus:bg-yellow-50"
                />
              </div>

              <button
                type="submit"
                disabled={loadingAction}
                className="w-full py-2.5 bg-neo-yellow hover:bg-yellow-400 border-3 border-black font-mono font-black text-xs uppercase shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60"
              >
                {loadingAction ? 'Processing...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            {/* Toggle Sign In / Sign Up */}
            <div className="text-center pt-2">
              <button
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-xs font-mono font-bold underline hover:text-orange-600"
              >
                {mode === 'signin' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            </div>
          </div>
        )}

        {/* Feedback / Error notifications */}
        {(authError || localMsg) && (
          <div className="mt-4 p-2.5 bg-rose-100 border-2 border-black text-xs font-mono font-bold text-rose-800 rounded">
            {authError || localMsg}
          </div>
        )}
      </div>
    </div>
  );
}
