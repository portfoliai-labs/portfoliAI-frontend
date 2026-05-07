"use client";

import { motion } from "framer-motion";
import { 
  BarChart3, TrendingDown, Lock, 
  ArrowRight, UploadCloud, Settings2, DownloadCloud 
} from "lucide-react";
import { useAuthFlow } from "@/app/hooks/useAuthFlow"; 
import FeatureCard from "../components/homepage/FeatureCard";
import StepCard from "../components/homepage/StepCard";
import dynamic from 'next/dynamic';
import SubscriptionSection from "../components/homepage/SubscriptionsSection";
import FaqSection from "../components/homepage/FaqSection";


// ==========================================
// 1. DATA SECTIONS (TRANSLATED)
// ==========================================
const featuresData = [
  { icon: BarChart3, title: "Deep Analysis", description: "Visualize exact asset allocation, category-level breakdowns, and historical ROI." },
  { icon: TrendingDown, title: "Risk Tracking", description: "Understand your exposure to volatility with risk metrics calculated over moving windows." },
  { icon: Lock, title: "100% Private & Secure", description: "Secure in-memory processing. Your files are analyzed and immediately destroyed." },
  { icon: BarChart3, title: "Hidden Fees Analysis", description: "Precise breakdown of direct commissions and implicit trading spreads." },
  { icon: Settings2, title: "Instant Reports", description: "Our AI engine generates your comprehensive PDF report in a matter of seconds." },
  { icon: TrendingDown, title: "Real Returns", description: "Discover the exact moment your investment recovers initial costs (Break-even)." },
];

const stepsData = [
  { number: 1, icon: UploadCloud, title: "Upload", description: "Export data from your broker and upload the CSV/Excel file." },
  { number: 2, icon: Settings2, title: "Process", description: "The AI engine cleans, categorizes, and analyzes your transactions." },
  { number: 3, icon: DownloadCloud, title: "Get Insights", description: "Download your detailed, ready-to-use PDF report." },
];


const Report3DShowcase = dynamic(
  () => import('../components/homepage/Report3DShowcase'), 
  { 
    ssr: false,
    loading: () => <div className="py-32 bg-slate-950 w-full min-h-[700px]" /> // Il tuo skeleton di caricamento
  }
);

// ==========================================
// 2. MAIN PAGE
// ==========================================
export default function HomePage() {
  const { login } = useAuthFlow();


  return (
    // Added scroll-smooth for native smooth scrolling to anchor links
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30 overflow-hidden scroll-smooth">
      
      {/* HEADER */}
      <header className="px-6 py-4 max-w-6xl mx-auto flex justify-between items-center sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <motion.div 
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          className="text-2xl font-bold tracking-tighter text-white flex items-center gap-2"
        >
          <div className="bg-cyan-600 p-1.5 rounded-lg">
            <BarChart3 className="text-white w-5 h-5" />
          </div>
          PortfoliAI
        </motion.div>
        
        {/* NAV WITH FIXED ANCHORS */}
        <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-400">
          <a href="#features" className="hover:text-cyan-400 transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-cyan-400 transition-colors">How it Works</a>
          <a href="#pricing" className="hover:text-cyan-400 transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-cyan-400 transition-colors">FAQ</a>
        </nav>

        <motion.button 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          onClick={() => login()}
          className="text-sm font-semibold bg-white text-slate-900 px-5 py-2.5 rounded-full hover:bg-cyan-50 transition-colors shadow-md"
        >
          Sign In / Sign Up
        </motion.button>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-20 pb-32 text-center">
        
        <motion.h1 
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight"
        >
          Your portfolio analysis, <br className="hidden md:block" /> 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            made crystal clear by AI.
          </span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed"
        >
          Upload your investment data. Our engine instantly generates an in-depth financial report on historical performance, cash flows, and risk metrics. In total privacy.
        </motion.p>

        <div className="flex justify-center mb-12">
          <button onClick={() => login()} className="group flex items-center gap-2 bg-cyan-600 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-cyan-500 transition-all shadow-[0_0_40px_-10px_rgba(6,182,212,0.4)]">
            Create Free Report <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* THE SHOWCASE IS THE HERO VISUAL */}
        <Report3DShowcase />
      </main>

      {/* FEATURES */}
      <section id="features" className="bg-slate-900 border-t border-slate-800 py-32 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-16">Everything you need to grow</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuresData.map((f, i) => <FeatureCard key={i} index={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-32 bg-slate-950 border-t border-slate-900 scroll-mt-20">
         <div className="max-w-5xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-20">Seamless Workflow</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative">
              <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-px bg-slate-800 -z-10"></div>
              {stepsData.map((s, i) => <StepCard key={i} index={i} {...s} />)}
            </div>
         </div>
      </section>

      {/* PRICING SECTION (WITH ID) */}
      <SubscriptionSection />

      {/* FAQ SECTION (WITH ID) */}
      <FaqSection />

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-900 text-slate-500 py-12 text-center text-sm">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-2 font-bold text-white text-lg opacity-80">
             <BarChart3 className="w-5 h-5" /> PortfoliAI
           </div>
           <p>© {new Date().getFullYear()} PortfoliAI. All rights reserved.</p>
           <div className="flex gap-6">
             <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
             <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
           </div>
        </div>
      </footer>
    </div>
  );
}
