// app/hooks/useAuthFlow.ts
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';
import { userService } from '../services/userService';

export function useAuthFlow() {
  const router = useRouter();
  const [status, setStatus] = useState('Ready to authenticate');
  const [isError, setIsError] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setStatus('Authenticating...');
      setIsError(false);
      
      try {
        const token = tokenResponse.access_token;
        localStorage.setItem("auth_token", token);
        
        // Esempio: Se il tuo backend restituisce una chiave da copiare
        // Invece di fare redirect, potresti settare la chiave:
        // const data = await userService.verifyToken();
        // setGeneratedKey(data.apiKey); 
        
        const userData = await userService.verifyToken();

        try {
          await userService.getUserProfile();
          router.push('/dashboard');
        } catch (profileError: any) {
          if (profileError.status === 404) {
            const params = new URLSearchParams({
              first_name: userData.first_name || '',
              last_name: userData.last_name || '',
            });
            router.push(`/onboarding?${params.toString()}`);
          } else {
            throw profileError;
          }
        }
      } catch (error) {
        console.error(error);
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