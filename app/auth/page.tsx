import { Suspense } from 'react';
import { GoogleProvider } from '../providers/GoogleProvider';
import { AuthCard } from '../components/auth/AuthCard'

export default function AuthPage() {
  return (
    <GoogleProvider>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500 font-medium">Loading auth...</div>}>
        <AuthCard />
      </Suspense>
    </GoogleProvider>
  );
}