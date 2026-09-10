/**
 * Route Guard Component
 * - Allows guests and authenticated users to access game routes
 * - Blocks unauthenticated users if requireAuth is true (redirecting to fallback)
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children, allowGuest = true, redirectTo = '/' }) {
  const { currentUser, loading, isGuest } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm uppercase tracking-widest text-zinc-400">Loading Gesture Studio...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (!allowGuest && isGuest) {
    return <Navigate to={redirectTo} state={{ from: location, message: 'Please sign in to access this feature' }} replace />;
  }

  return children;
}
