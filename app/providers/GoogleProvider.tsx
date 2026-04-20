"use client";

import { GoogleOAuthProvider } from '@react-oauth/google';

export function GoogleProvider({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-center p-6">
        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-200">
          <strong>Configuration Error:</strong> <br />
          Missing variable <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in the <code>.env.local</code> file.
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
}