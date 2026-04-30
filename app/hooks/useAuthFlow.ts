// app/hooks/useAuthFlow.ts
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGoogleLogin, TokenResponse } from '@react-oauth/google';
import { userService } from '../services/userService';

interface UserData {
  first_name: string;
  last_name: string;
  email: string;
  picture?: string;
}

export function useAuthFlow() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('Ready to authenticate');
  const [isError, setIsError] = useState<boolean>(false);
  const [generatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async (): Promise<void> => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse: TokenResponse) => {
      setStatus('Authenticating...');
      setIsError(false);
      
      try {
        const token = tokenResponse.access_token;
        localStorage.setItem("auth_token", token);
        
        const userData: UserData = await userService.verifyToken();

        localStorage.setItem("user_name", `${userData.first_name} ${userData.last_name}`);
        localStorage.setItem("user_email", userData.email);
        if (userData.picture) localStorage.setItem("user_picture", userData.picture);

        try {
          await userService.getUserProfile();
          router.push('/dashboard');
        } catch (profileError: unknown) {
          if (profileError && typeof profileError === 'object' && 'status' in profileError) {
            const error = profileError as { status: number };
            
            if (error.status === 404) {
              const params = new URLSearchParams({
                first_name: userData.first_name || '',
                last_name: userData.last_name || '',
                email: userData.email || ''
              });
              router.push(`/onboarding?${params.toString()}`);
            } else {
              throw profileError;
            }
          } else {
            throw profileError;
          }
        }
      } catch (error) {
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
    generatedKey, 
    copied, 
    handleCopy 
  };
}