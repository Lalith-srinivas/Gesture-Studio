/**
 * AuthContext & Provider
 * Manages user authentication state, guest mode, profile synchronization,
 * and seamless linking of anonymous accounts to permanent Google accounts.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  subscribeToAuthState,
  signInAsGuest,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  linkGuestToGoogle,
  linkGuestToEmail,
  checkRedirectResult,
  logOut
} from '../firebase/auth';
import { getOrCreateUserProfile, updateUserProfile } from '../firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Monitor network connectivity for graceful offline transitions
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch or sync user profile whenever Firebase auth state updates
  const syncProfile = useCallback(async (user) => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    try {
      const profile = await getOrCreateUserProfile(user);
      setUserProfile(profile);
    } catch (err) {
      console.warn('[AuthProvider] Profile load issue:', err);
    }
  }, []);

  useEffect(() => {
    // Check if returning from a Google redirect sign-in
    checkRedirectResult().then(async (res) => {
      if (res?.error) {
        setAuthError(res.error);
      } else if (res?.user) {
        setCurrentUser(res.user);
        try {
          localStorage.setItem('gesture_studio_last_uid', res.user.uid);
          localStorage.removeItem('gesture_explicit_logout');
        } catch { /* silent */ }
        if (res.user.email || res.user.displayName) {
          try {
            await updateUserProfile(res.user.uid, {
              isAnonymous: res.user.isAnonymous ?? false,
              email: res.user.email || '',
              username: res.user.displayName || 'Player',
              avatar: res.user.photoURL || undefined
            });
          } catch (e) {
            console.warn('[AuthProvider] Failed to sync redirect profile info:', e);
          }
        }
        await syncProfile(res.user);
      }
    }).catch((err) => {
      setAuthError(err?.message || 'Redirect sign-in error');
    });

    const unsubscribe = subscribeToAuthState(async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          localStorage.setItem('gesture_studio_last_uid', user.uid);
          localStorage.removeItem('gesture_explicit_logout');
        } catch { /* silent */ }
        await syncProfile(user);
        setLoading(false);
      } else {
        // No active user session: do NOT auto-create anonymous accounts
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [syncProfile]);

  // Guest login
  const loginAsGuest = async (customUsername = '') => {
    setAuthError(null);
    try { localStorage.removeItem('gesture_explicit_logout'); } catch {}
    const result = await signInAsGuest();
    if (result.error) {
      setAuthError(result.error);
    } else if (result.user) {
      let finalName = (customUsername || '').trim();
      if (!finalName) {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        finalName = `Guest_${randomSuffix}`;
      }
      await updateUserProfile(result.user.uid, {
        username: finalName,
        isAnonymous: true,
      });
      setCurrentUser(result.user);
      try {
        localStorage.setItem('gesture_studio_last_uid', result.user.uid);
      } catch { /* silent */ }
      await syncProfile(result.user);
    }
    return result;
  };

  // Google login
  const loginWithGoogle = async (forceRedirect = false) => {
    setAuthError(null);
    try { localStorage.removeItem('gesture_explicit_logout'); } catch {}
    const result = await signInWithGoogle(forceRedirect);
    if (result.error) {
      setAuthError(result.error);
    }
    return result;
  };

  // Email & Password login
  const loginWithEmail = async (email, password) => {
    setAuthError(null);
    try { localStorage.removeItem('gesture_explicit_logout'); } catch {}
    const result = await signInWithEmail(email, password);
    if (result.error) {
      setAuthError(result.error);
    }
    return result;
  };

  // Email registration
  const registerUser = async (email, password, displayName) => {
    setAuthError(null);
    try { localStorage.removeItem('gesture_explicit_logout'); } catch {}
    const result = await registerWithEmail(email, password, displayName);
    if (result.error) {
      setAuthError(result.error);
    } else if (result.user) {
      const cleanName = (displayName || '').trim() || 'Player';
      await updateUserProfile(result.user.uid, {
        username: cleanName,
        isAnonymous: false,
        email: email.trim()
      });
      await syncProfile(result.user);
    }
    return result;
  };

  // Upgrade guest to Google without losing high scores or progress
  const linkGoogleAccount = async (forceRedirect = false) => {
    setAuthError(null);
    const result = await linkGuestToGoogle(forceRedirect);
    if (result.error) {
      setAuthError(result.error);
    } else if (result.user) {
      // Update profile with Google metadata
      await updateUserProfile(result.user.uid, {
        isAnonymous: false,
        email: result.user.email || '',
        username: result.user.displayName || userProfile?.username || 'Player',
        avatar: result.user.photoURL || userProfile?.avatar
      });
      await syncProfile(result.user);
    }
    return result;
  };

  // Upgrade guest to Email/Password
  const linkEmailAccount = async (email, password) => {
    setAuthError(null);
    const result = await linkGuestToEmail(email, password);
    if (result.error) {
      setAuthError(result.error);
    } else if (result.user) {
      await updateUserProfile(result.user.uid, {
        isAnonymous: false,
        email: email.trim()
      });
      await syncProfile(result.user);
    }
    return result;
  };

  // Sign out
  const handleLogout = async () => {
    setAuthError(null);
    try {
      localStorage.setItem('gesture_explicit_logout', 'true');
    } catch { /* silent */ }
    await logOut();
    setCurrentUser(null);
    setUserProfile(null);
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    authError,
    isOffline,
    isGuest: Boolean(currentUser?.isAnonymous),
    isAuthenticated: Boolean(currentUser),
    loginAsGuest,
    loginWithGoogle,
    loginWithEmail,
    registerUser,
    linkGoogleAccount,
    linkEmailAccount,
    logout: handleLogout,
    refreshProfile: () => syncProfile(currentUser)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
