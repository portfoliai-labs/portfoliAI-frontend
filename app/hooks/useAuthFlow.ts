"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';

export function useAuthFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const source = searchParams.get('source');

  const [status, setStatus] = useState('Ready to authenticate');
  const [isError, setIsError] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setStatus('Login successful. Generating keys...');
      setIsError(false);
      
      try {
        const realGoogleToken = tokenResponse.access_token;
        localStorage.setItem("auth_token", realGoogleToken);
        
        if (source === 'addon') {
          setGeneratedKey(realGoogleToken);
          setStatus('Success! Copy your Access Token.');
        } else {
          setStatus('Success! Redirecting to dashboard...');
          router.push('/dashboard');
        }
      } catch (error) {
        setStatus('Failed to process authentication.');
        setIsError(true);
      }
    },
    onError: () => {
      setStatus('Google Login failed.');
      setIsError(true);
    },
  });

  const handleCopy = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return { login, status, isError, generatedKey, copied, handleCopy };
}