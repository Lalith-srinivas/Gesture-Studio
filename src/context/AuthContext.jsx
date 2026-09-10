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
    const unsubscribe = subscribeToAuthState(async (user) => {
      setCurrentUser(user);
      if (user) {
        await syncProfile(user);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [syncProfile]);

  // Guest login
  const loginAsGuest = async () => {
    setAuthError(null);
    const result = await signInAsGuest();
    if (result.error) {
      setAuthError(result.error);
    }
    return result;
  };

  // Google login
  const loginWithGoogle = async () => {
    setAuthError(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setAuthError(result.error);
    }
    return result;
  };

  // Email & Password login
  const loginWithEmail = async (email, password) => {
    setAuthError(null);
    const result = await signInWithEmail(email, password);
    if (result.error) {
      setAuthError(result.error);
    }
    return result;
  };

  // Email registration
  const registerUser = async (email, password, displayName) => {
    setAuthError(null);
    const result = await registerWithEmail(email, password, displayName);
    if (result.error) {
      setAuthError(result.error);
    }
    return result;
  };

  // Upgrade guest to Google without losing high scores or progress
  const linkGoogleAccount = async () => {
    setAuthError(null);
    const result = await linkGuestToGoogle();
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
