"use client";

import React, { useState } from 'react';
import { useGoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { Zap, ShieldCheck } from 'lucide-react';

function AuthContent() {
  const [status, setStatus] = useState('Ready to authenticate');
  const [isError, setIsError] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setStatus('Login successful. Generating keys...');
      setIsError(false);
      
      try {
        // Simulazione chiamata backend
        const mockApiKey = "wf_sk_test_" + Math.random().toString(36).substring(7);
        
        setStatus('Success! Closing window...');

        if (window.opener) {
          window.opener.postMessage({ 
            type: 'AUTH_SUCCESS', 
            payload: { apiKey: mockApiKey } 
          }, '*');
          
          setTimeout(() => window.close(), 1000);
        } else {
          setStatus('Error: Opener window not found.');
          setIsError(true);
        }
      } catch (error) {
        setStatus('Failed to generate API Key.');
        setIsError(true);
      }
    },
    onError: () => {
      setStatus('Google Login failed.');
      setIsError(true);
    },
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white">
      <div className="p-10 bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white shadow-2xl text-center space-y-8 max-w-sm w-full mx-4">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200">
            <Zap className="text-white h-8 w-8" />
          </div>
        </div>
        
        <div>
          <h1 className="text-2xl font-bold text-blue-950">PortfoliAI Auth</h1>
          <p className={`mt-2 text-sm font-medium ${isError ? 'text-rose-600' : 'text-slate-500'}`}>
            {status}
          </p>
        </div>
        
        <button 
          onClick={() => login()}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 group"
        >
          Proceed with Google
          <ShieldCheck className="h-5 w-5 opacity-70 group-hover:opacity-100" />
        </button>

        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
          Secure ephemeral session
        </p>
      </div>
    </div>
  );
}

export default function AuthProxyPage() {
  // Richiama la variabile d'ambiente creata nel file .env.local
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Fallback UI per il Developer se si dimentica di impostare la variabile
  if (!clientId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-center p-6">
        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-200">
          <strong>Errore di configurazione:</strong> <br />
          Manca la variabile <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> nel file <code>.env.local</code>.
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthContent />
    </GoogleOAuthProvider>
  );
}