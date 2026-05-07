// app/(authenticated)/onboarding/layout.tsx
"use client";

import { useProtectedRoute } from "@/app/hooks/useProtectedRoute";
import { Loader2 } from "lucide-react";

/**
 * OnboardingLayout handles the specific protection for this route.
 * It uses 'token-only' level: access is granted if the user has a token 
 * but the profile might be missing (which is expected here).
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useProtectedRoute('token-only');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}