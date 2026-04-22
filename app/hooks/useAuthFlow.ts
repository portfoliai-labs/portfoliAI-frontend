// app/hooks/useAuthFlow.ts
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';
import { userService } from '../services/userService';

export function useAuthFlow() {
  const router = useRouter();
  const [status, setStatus] = useState('Ready to authenticate');

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setStatus('Authenticating...');
      
      try {
        const token = tokenResponse.access_token;
        localStorage.setItem("auth_token", token);
        
        // 1. Chiama verifyToken per i dati base
        const userData = await userService.verifyToken();

        try {
          // 2. Prova a ottenere il profilo
          await userService.getUserProfile();
          
          // Se esiste, vai in dashboard
          router.push('/dashboard');
        } catch (profileError: any) {
          // 3. Se 404, vai all'introduzione (onboarding)
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
        setStatus('Authentication failed.');
      }
    },
    onError: () => setStatus('Google Login failed.'),
  });

  return { login, status };
}