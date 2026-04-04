"use client";

import { ShieldCheck, FileText, Zap, BookOpen, BarChart3, TrendingDown, Lock, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

// Estraiamo il contenuto principale in un componente per poter usare l'hook useGoogleLogin
function LandingContent() {
  const router = useRouter();

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      // 1. Salviamo il token (simulando una sessione attiva)
      localStorage.setItem('auth_token', tokenResponse.access_token);
      
      // 2. Redirect alla pagina protetta
      router.push('/dashboard');
    },
    onError: () => {
      alert("Errore durante il login con Google.");
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* HEADER */}
      <header className="p-6 max-w-6xl mx-auto flex justify-between items-center">
        <div className="text-2xl font-bold tracking-tighter text-blue-900">PortfoliAI</div>
        <button 
          onClick={() => login()}
          className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          Accedi
        </button>
      </header>

      {/* HERO SECTION */}
      <main className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6">
          Clear, comprehensive <br className="hidden md:block" /> portfolio analysis in seconds.
        </h1>
        <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          Upload your investment data. Our engine generates an in-depth financial report covering historical performance, cash flow, and risk metrics in total privacy.
        </p>

        {/* CALL TO ACTION BUTTON */}
        <div className="mb-16 flex justify-center">
          <button 
            onClick={() => login()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg shadow-blue-200 transition-all hover:scale-105"
          >
            Sign in with Google to Start
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* SHOWCASE AREA - Document Report Mockup */}
        <div className="relative max-w-5xl mx-auto">
          <div className="absolute inset-0 bg-blue-600 blur-[120px] opacity-15 -z-10 rounded-full"></div>
          
          <div className="bg-slate-200/50 p-4 rounded-3xl border border-slate-200/60 shadow-2xl flex flex-col md:flex-row gap-4 items-stretch">
            
            {/* Table of Contents (Left Page) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 md:w-[40%] text-left relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
              
              <div className="flex items-center gap-2 text-slate-400 mb-8 border-b border-slate-100 pb-4">
                <BookOpen className="h-5 w-5" />
                <span className="font-semibold text-xs tracking-widest uppercase">Report Structure</span>
              </div>
              
              <ul className="space-y-4 text-sm font-medium text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">1.</span> 
                  <span>Executive Overview</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">2.</span> 
                  <span>Financial Overview & Cash Flow</span>
                </li>
                <li className="flex items-start gap-3 bg-blue-50 p-3 rounded-lg -ml-2 text-blue-900">
                  <span className="text-blue-600 font-bold">3.</span> 
                  <div className="flex-1">
                    <span className="block mb-2.5">Portfolio Analysis</span>
                    <ul className="space-y-2 text-xs text-slate-500 font-normal border-l-2 border-blue-200 pl-3 ml-1">
                      <li>3.1 Portfolio Composition</li>
                      <li>3.2 Performance & ROI Analysis</li>
                      <li className="text-blue-700 font-semibold">3.3 Risk & Volatility Analysis</li>
                      <li>3.4 Category-Level Analysis</li>
                    </ul>
                  </div>
                </li>
              </ul>
            </div>

            {/* Content Snippet (Right Page) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 md:w-[60%] text-left font-serif text-slate-800">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 font-sans">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chapter 3.3 Preview</span>
                <Zap className="h-4 w-4 text-blue-500" />
              </div>
              
              <h3 className="text-2xl font-bold mb-6 font-sans text-slate-900">Risk & Volatility Analysis</h3>
              
              <div className="space-y-5 text-sm leading-relaxed text-slate-600">
                <p>
                  The portfolio's structure demonstrates sensitivity to concentrated, region-specific regulatory events with global contagion effects.
                </p>
                <p>
                  The event's impact was amplified as the scope included cryptocurrency, causing a sharp decline in the portfolio's Bitcoin holding. This episode highlights a structural vulnerability to policy risks that can simultaneously affect multiple, seemingly distinct asset classes within the portfolio.
                </p>
                
                {/* Simulated Chart/Data Box */}
                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 my-6 font-sans">
                  <h4 className="text-xs font-bold text-slate-800 uppercase mb-3">Realized Risk Tracking</h4>
                  
                  <div className="flex items-end gap-1 h-16 mb-2">
                    <div className="w-1/6 bg-blue-200 h-[20%] rounded-t-sm"></div>
                    <div className="w-1/6 bg-blue-200 h-[35%] rounded-t-sm"></div>
                    <div className="w-1/6 bg-blue-300 h-[40%] rounded-t-sm"></div>
                    <div className="w-1/6 bg-rose-400 h-[90%] rounded-t-sm"></div>
                    <div className="w-1/6 bg-blue-300 h-[45%] rounded-t-sm"></div>
                    <div className="w-1/6 bg-blue-200 h-[25%] rounded-t-sm"></div>
                  </div>
                  
                  <p className="text-xs text-slate-500 mt-2 italic">
                    This chart tracks realized risk over a moving 21-trading-day window.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* VALUE PROPOSITION SECTION */}
      <section className="bg-slate-900 text-white py-24 mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4 tracking-tight">Know exactly where your money stands.</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Get a professional, data-driven overview of your investments without granting access to your brokerage accounts.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-2xl">
              <BarChart3 className="h-8 w-8 text-blue-400 mb-6" />
              <h3 className="font-bold text-xl mb-3 text-slate-50">Deep Portfolio Analysis</h3>
              <p className="text-slate-400 leading-relaxed text-sm">Visualize your exact asset allocation, category-level breakdowns, and historical ROI.</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-2xl">
              <TrendingDown className="h-8 w-8 text-amber-400 mb-6" />
              <h3 className="font-bold text-xl mb-3 text-slate-50">Risk Tracking</h3>
              <p className="text-slate-400 leading-relaxed text-sm">Understand your exposure to volatility. The report tracks realized risk over moving windows.</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-2xl">
              <Lock className="h-8 w-8 text-emerald-400 mb-6" />
              <h3 className="font-bold text-xl mb-3 text-slate-50">100% Private & Secure</h3>
              <p className="text-slate-400 leading-relaxed text-sm">Upload a simple data export. Your files are processed securely in memory and immediately destroyed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 text-center text-slate-500 text-sm">
        <p>© 2026 PortfoliAI. Concept design in development.</p>
      </footer>

    </div>
  );
}

// Wrap del componente con il Provider di Google
export default function Home() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <LandingContent />
      
    </GoogleOAuthProvider>
  );
}