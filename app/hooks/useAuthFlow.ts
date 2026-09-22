// app/hooks/useAuthFlow.ts
"use client";

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Triggers Supabase's Google OAuth redirect. Unlike the previous popup-based flow,
// this navigates the whole tab away to Google and back — there's no onSuccess
// callback here, completion (profile fetch, routing, addon token display) happens
// on /auth/callback once Supabase hands back a session.
export function useAuthFlow(mode: 'default' | 'addon' = 'default', next?: string | null) {
  const [status, setStatus] = useState<string>('Ready to authenticate');
  const [isError, setIsError] = useState<boolean>(false);

  // Where to send the user once they're actually let into the app. Falls
  // back to the dashboard when there's no specific page they were trying
  // to reach (e.g. a deep link to a report shared from an email).
  const destination = next || '/dashboard';

  const login = async () => {
    setStatus('Redirecting to Google...');
    setIsError(false);

    const callbackUrl = new URL('/auth/callback', window.location.origin);
    callbackUrl.searchParams.set('next', destination);
    if (mode === 'addon') callbackUrl.searchParams.set('source', 'addon');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    });

    // Only reached if Supabase refuses to even start the redirect (e.g. the
    // Google provider isn't configured) — once the redirect happens, this
    // component is torn down.
    if (error) {
      console.error("Auth Flow Error:", error);
      setIsError(true);
      setStatus('Google Login failed.');
    }
  };

  return {
    login,
    status,
    isError,
  };
}
