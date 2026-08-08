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

export function useAuthFlow(mode: 'default' | 'addon' = 'default', next?: string | null) {
  const router = useRouter();
  const [status, setStatus] = useState<string>('Ready to authenticate');
  const [isError, setIsError] = useState<boolean>(false);
  const [addonToken, setAddonToken] = useState<string | null>(null);

  // Where to send the user once they're actually let into the app. Falls
  // back to the dashboard when there's no specific page they were trying
  // to reach (e.g. a deep link to a report shared from an email).
  const destination = next || '/dashboard';

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse: TokenResponse) => {
      setStatus('Authenticating...');
      setIsError(false);

      try {
        const token: string = tokenResponse.access_token;
        localStorage.setItem("auth_token", token);

        if (mode === 'addon') {
          setAddonToken(token);
          return;
        }

        try {
          // Attempt to fetch the profile to decide the routing
          const userProfile = await userService.getUserProfile();
          localStorage.setItem("user_profile", JSON.stringify(userProfile));
          router.push(destination);

        } catch (error: unknown) {
          const apiError = error as ApiErrorResponse;

          if (apiError && apiError.status === 404) {
            // No account yet — go create one.
            router.push('/onboarding');
          } else if (apiError && apiError.status === 403) {
            // Account exists but the backend won't return it until the
            // currently-required legal documents are accepted. Don't treat
            // this as a failed login — route into the app anyway; the
            // (reserved) layout's UserProvider + LegalGate will hit this
            // same 403, flag it, and show the acceptance screen before
            // anything else renders.
            router.push(destination);
          } else {
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
    isError,
    addonToken,
  };
}