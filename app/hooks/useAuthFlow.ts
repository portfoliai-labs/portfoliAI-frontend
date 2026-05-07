// app/hooks/useAuthFlow.ts
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGoogleLogin, TokenResponse } from '@react-oauth/google';
import { userService } from '../services/userService';

/**
 * Interface for API Errors to satisfy the linter without using 'any'
 */
interface ApiErrorResponse {
  status: number;
  message?: string;
}

export function useAuthFlow() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('Ready to authenticate');
  const [isError, setIsError] = useState<boolean>(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse: TokenResponse) => {
      setStatus('Authenticating...');
      setIsError(false);
      
      try {
        const token: string = tokenResponse.access_token;
        localStorage.setItem("auth_token", token);
        
        try {
          // Attempt to fetch the profile to decide the routing
          const userProfile = await userService.getUserProfile();
          localStorage.setItem("user_profile", JSON.stringify(userProfile));
          router.push('/dashboard');
          
        } catch (error: unknown) {
          // Type-safe error handling for the linter
          const apiError = error as ApiErrorResponse;
          
          if (apiError && apiError.status === 404) {
            // Profile missing: expected for new users
            router.push('/onboarding');
          } else {
            // Other errors (500, etc.)
            throw error;
          }
        }
      } catch (error: unknown) {
        console.error("Auth Flow Error:", error);
        setIsError(true);
        setStatus('Authentication failed.');
      }
    },
    onError: () => {
      setIsError(true);
      setStatus('Google Login failed.');
    },
  });

  return { 
    login, 
    status, 
    isError 
  };
}