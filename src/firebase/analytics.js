/**
 * Firebase Analytics
 * Gracefully loaded only in supported browser environments
 */
import { app } from './firebase';

let analyticsInstance = null;

export const initAnalytics = async () => {
  if (typeof window === 'undefined') return null;
  if (analyticsInstance) return analyticsInstance;

  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    const supported = await isSupported();
    if (supported) {
      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    }
  } catch (err) {
    console.warn('[Analytics] Firebase analytics not supported in this environment:', err?.message);
  }
  return null;
};

export const logAppEvent = async (eventName, eventParams = {}) => {
  try {
    const { logEvent } = await import('firebase/analytics');
    const instance = await initAnalytics();
    if (instance) {
      logEvent(instance, eventName, eventParams);
    }
  } catch (err) {
    console.debug(`[Analytics] Could not log event "${eventName}":`, err?.message);
  }
};
