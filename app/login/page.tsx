"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, 
  ShieldCheck, 
  Zap, 
  Loader2, 
  AlertCircle 
} from "lucide-react";
import { useAuthFlow } from "@/app/hooks/useAuthFlow";

/**
 * Feature list to display on the branding side of the login page
 */
const loginFeatures: Array<{ icon: React.ElementType; title: string; description: string }> = [
  {
    icon: Zap,
    title: "Instant AI Analysis",
    description: "Get your portfolio parsed and analyzed in seconds."
  },
  {
    icon: ShieldCheck,
    title: "Bank-grade Security",
    description: "Your financial data is processed in-memory and never stored."
  }
];

export default function LoginPage() {
  // Consume our custom hook for Google OAuth
  const { login, status, isError } = useAuthFlow();
  
  // Determine if we are currently waiting for the authentication process
  const isLoading: boolean = status === 'Authenticating...';

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      
      {/* =========================================
          LEFT SIDE: Branding & Value Proposition 
          ========================================= */}
      <div className="hidden md:flex md:w-1/2 bg-slate-950 relative overflow-hidden flex-col justify-between p-12 lg:p-24">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 blur-3xl"></div>
        </div>

        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 text-white font-black text-2xl"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          PortfoliAI
        </motion.div>

        {/* Hero Copy */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-20"
        >
          <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            Master your wealth <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              with absolute precision.
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md">
            Join thousands of smart investors who trust PortfoliAI to uncover hidden fees and optimize their asset allocation.
          </p>
        </motion.div>

        {/* Feature list */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="space-y-8 mt-20"
        >
          {loginFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="flex items-start gap-4">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <Icon className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold">{feature.title}</h3>
                  <p className="text-slate-500 text-sm">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* =========================================
          RIGHT SIDE: Authentication Form
          ========================================= */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-24 relative">
        
        {/* Mobile Logo (Visible only on small screens) */}
        <div className="md:hidden flex items-center gap-2 text-slate-900 font-black text-2xl mb-12">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          PortfoliAI
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="text-center md:text-left mb-10">
            <h2 className="text-3xl font-black text-slate-900 mb-3">Welcome back</h2>
            <p className="text-slate-500">Sign in to your account to continue</p>
          </div>

          {/* Error Message Display */}
          {isError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm font-medium">{status}</div>
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={() => login()}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 font-bold py-4 px-8 rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            ) : (
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
            )}
            <span>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>

          {/* Status feedback (non-error) */}
          {!isError && isLoading && (
            <p className="text-center text-sm font-medium text-blue-600 mt-6 animate-pulse">
              {status}
            </p>
          )}

          {/* Legal / Terms */}
          <p className="text-center text-sm text-slate-400 mt-12 px-6">
            By continuing, you agree to our{' '}
            <a href="#" className="underline hover:text-slate-600 transition-colors">Terms of Service</a>{' '}
            and{' '}
            <a href="#" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}