// app/hooks/useProtectedRoute.ts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";

/**
 * Defines the level of protection required for a specific route.
 * - 'full': Requires both a valid auth token AND a complete user profile (e.g., Dashboard).
 * - 'token-only': Requires a valid token, but expects the user profile to be missing (e.g., Onboarding).
 */
export type ProtectionLevel = 'full' | 'token-only';

/**
 * Interface for the hook's return value
 */
interface ProtectedRouteReturn {
  isAuthorized: boolean;
  loading: boolean;
  handleLogout: () => void;
}

/**
 * Custom hook to protect routes based on the global UserContext state.
 * @param {ProtectionLevel} level - The required authorization level (defaults to 'full').
 * @returns {ProtectedRouteReturn} Authorization state, loading flag, and logout handler.
 */
export function useProtectedRoute(level: ProtectionLevel = 'full'): ProtectedRouteReturn {
  const router = useRouter();
  
  // Consumes global state. Must be used within a component wrapped by UserProvider.
  const { user, loading, logout } = useUser();

  useEffect(() => {
    // Wait until the context finishes evaluating the user's state
    if (loading) return;

    // Safely check for the token in the browser environment
    const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;

    // Rule 1: No token present at all -> send to login immediately
    if (!token) {
      router.replace("/login");
      return;
    }

    // Rule 2: 'full' protection required, but no user profile exists -> send to onboarding
    if (level === 'full' && !user) {
      router.replace("/onboarding");
      return;
    }

    // Rule 3: 'token-only' protection (onboarding), but profile already exists -> send to dashboard
    if (level === 'token-only' && user) {
      router.replace("/dashboard");
      return;
    }
    
  }, [user, loading, router, level]);

  return { 
    isAuthorized: !!user, 
    loading, 
    handleLogout: logout 
  };
}