/**
 * Firebase Authentication Service
 * - Google Sign-In with popup
 * - Email & Password (Sign up / Sign in)
 * - Anonymous Guest Login
 * - Guest-to-Permanent Account Linking (never lose progress)
 * - Safe error message mapper
 */
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Format raw Firebase errors into human-friendly messages
 */
export const formatAuthError = (error) => {
  if (!error) return 'An unexpected error occurred.';
  const code = error.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'The email address is invalid.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'This email is already associated with another account.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'Sign in popup was closed before completing.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/credential-already-in-use':
      return 'This account is already linked to another user.';
    default:
      return error.message || 'Authentication error. Please try again.';
  }
};

/**
 * Sign in as Guest (Anonymous)
 */
export const signInAsGuest = async () => {
  try {
    const result = await signInAnonymously(auth);
    return { user: result.user, isNewUser: true, error: null };
  } catch (error) {
    return { user: null, error: formatAuthError(error) };
  }
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: formatAuthError(error) };
  }
};

/**
 * Sign in with Email & Password
 */
export const signInWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: formatAuthError(error) };
  }
};

/**
 * Register with Email & Password
 */
export const registerWithEmail = async (email, password, displayName = '') => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName && result.user) {
      await updateProfile(result.user, { displayName });
    }
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: formatAuthError(error) };
  }
};

/**
 * Convert an Anonymous Guest account into a Google account without losing progress
 */
export const linkGuestToGoogle = async () => {
  if (!auth.currentUser) throw new Error('No user is currently signed in.');
  try {
    const result = await linkWithPopup(auth.currentUser, googleProvider);
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: formatAuthError(error) };
  }
};

/**
 * Convert an Anonymous Guest account into Email & Password without losing progress
 */
export const linkGuestToEmail = async (email, password) => {
  if (!auth.currentUser) throw new Error('No user is currently signed in.');
  try {
    const credential = EmailAuthProvider.credential(email.trim(), password);
    const result = await linkWithCredential(auth.currentUser, credential);
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: formatAuthError(error) };
  }
};

/**
 * Sign Out
 */
export const logOut = async () => {
  try {
    await fbSignOut(auth);
    return { error: null };
  } catch (error) {
    return { error: formatAuthError(error) };
  }
};

/**
 * Listen to Auth State
 */
export const subscribeToAuthState = (callback) => {
  return onAuthStateChanged(auth, callback);
};
