// app/context/UserContext.tsx
"use client";

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useCallback, 
  useMemo 
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { userService } from '../services/userService';
import type { UserProfile } from '../models/User';

/**
 * Interface for API Error objects to avoid 'any' and satisfy the linter
 */
interface ApiError {
  status: number;
  message?: string;
}

/**
 * Context Type Definition
 */
interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * UserProvider Component
 * To be placed in app/(reserved)/layout.tsx
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Centralized Logout Logic
   * Cleans up local storage and resets the state
   */
  const logout = useCallback((): void => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_profile");
    setUser(null);
    setLoading(false);
    
    // Redirect to login with a reason parameter for UX
    router.replace('/homepage');
  }, [router]);

  /**
   * Profile Fetcher
   * Attempts to retrieve the user profile from the backend
   */
  const fetchProfile = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const profile: UserProfile = await userService.getUserProfile();
      setUser(profile);
      
      // Cache the profile for performance
      localStorage.setItem("user_profile", JSON.stringify(profile));
    } catch (error: unknown) {
      // Type-safe error handling for the linter
      const apiError = error as ApiError;
      
      if (apiError && apiError.status === 404) {
        // User is authenticated but profile doesn't exist yet
        setUser(null);
        if (!pathname.includes('/onboarding')) {
          router.replace('/onboarding');
        }
      }
      // Note: 401 errors are handled globally by the 'auth-unauthorized' event
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  /**
   * Initial effect to handle event listeners and startup logic
   */
  useEffect(() => {
    // Listen for the custom event dispatched by apiClient on 401 responses
    window.addEventListener("auth-unauthorized", logout);
    
    const token: string | null = localStorage.getItem("auth_token");

    // 1. Mandatory check: if no token is found within (reserved) group, boot to login
    if (!token) {
      logout();
      return;
    }

    // 2. Load user data if not already present in state
    if (!user) {
      const cachedProfile: string | null = localStorage.getItem("user_profile");
      
      if (cachedProfile) {
        try {
          setUser(JSON.parse(cachedProfile));
          setLoading(false);
          // Refresh data in background to keep it in sync
          fetchProfile();
        } catch {
          // If JSON is corrupted, fallback to full fetch
          fetchProfile();
        }
      } else {
        fetchProfile();
      }
    }

    return () => {
      window.removeEventListener("auth-unauthorized", logout);
    };
  }, [logout, fetchProfile, user]);

  /**
   * Memoize context value to prevent unnecessary re-renders of consuming components
   */
  const contextValue: UserContextType = useMemo(() => ({ 
    user, 
    loading, 
    refreshUser: fetchProfile, 
    logout 
  }), [user, loading, fetchProfile, logout]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * Custom hook to consume the UserContext
 */
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider inside the (reserved) group");
  }
  return context;
};