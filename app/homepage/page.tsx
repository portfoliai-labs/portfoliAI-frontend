"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, TrendingDown, Lock, 
  ArrowRight, UploadCloud, Settings2, DownloadCloud 
} from "lucide-react";
import { useAuthFlow } from "@/app/hooks/useAuthFlow"; 
import FeatureCard from "../components/homepage/FeatureCard";
import StepCard from "../components/homepage/StepCard";
import PricePlanCard from "../components/homepage/PricePlanCard";
import FaqItem from "../components/homepage/FaqItem";
import RealPricesReport from "../components/homepage/RealPricesReport";
import Report3DShowcase from "../components/homepage/Report3DShowcase";


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

const pricingData = [
  { title: "Starter", price: "Free", features: ["1 Report per month", "Basic portfolio analysis", "Standard CSV formats"], ctaText: "Start for Free", popular: false },
  { title: "Pro", price: "€15", features: ["Unlimited reports", "Risk & volatility analysis", "Advanced fee breakdown", "Priority support"], ctaText: "Upgrade to Pro", popular: true },
];

const faqData = [
  { question: "Which brokers are supported?", answer: "We support CSV/Excel formats from most major brokers (e.g., Degiro, Interactive Brokers, Fineco). The AI automatically adapts to column formats." },
  { question: "Is my financial data secure?", answer: "Absolutely. We do not store your transaction data. The file is processed in RAM and discarded as soon as the report is generated." },
  { question: "What exactly is in the PDF report?", answer: "The report includes: capital overview, historical cash flows, cost analysis, portfolio composition, ROI analysis, and volatility metrics." },
];

// ==========================================
// 2. MAIN PAGE
// ==========================================
export default function HomePage() {
  const { login } = useAuthFlow();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

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

      {/* HERO SECTION */}
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-32 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-900/30 border border-cyan-800 text-cyan-400 text-sm font-semibold mb-8"
        >
          <SparklesIcon className="w-4 h-4" /> New: Hidden Costs Analysis
        </motion.div>
        
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

        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
          className="flex flex-col sm:flex-row justify-center gap-4 mb-20"
        >
          <button 
            onClick={() => login()}
            className="group flex items-center justify-center gap-2 bg-cyan-600 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-cyan-500 transition-all shadow-[0_0_40px_-10px_rgba(6,182,212,0.5)]"
          >
            Generate Report Now 
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        {/* DASHBOARD PREVIEW COMPONENT */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
          className="relative mx-auto max-w-5xl z-10"
        >
          <RealPricesReport />
        </motion.div>
      </main>

      <Report3DShowcase />

      {/* FEATURES SECTION (WITH ID) */}
      <section id="features" className="bg-slate-900 border-t border-slate-800 py-32 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
              className="text-3xl md:text-4xl font-bold text-white mb-4"
            >
              Institutional-Grade Intelligence
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ delay: 0.1 }}
              className="text-slate-400 max-w-2xl mx-auto"
            >
              A level of detail previously reserved for institutions, now accessible to private investors through AI.
            </motion.p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuresData.map((f, i) => <FeatureCard key={i} index={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION (WITH ID) */}
      <section id="how-it-works" className="py-32 bg-slate-950 scroll-mt-20">
         <div className="max-w-5xl mx-auto px-6 text-center">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
              className="text-3xl md:text-4xl font-bold text-white mb-20"
            >
              How it works in 3 steps
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-slate-800 -z-10"></div>
              {stepsData.map((s, i) => <StepCard key={i} index={i} {...s} />)}
            </div>
         </div>
      </section>

      {/* PRICING SECTION (WITH ID) */}
      <section id="pricing" className="py-32 bg-slate-900 border-t border-b border-slate-800 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.h2 
             initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
             className="text-3xl md:text-4xl font-bold text-white mb-16"
          >
            Simple, transparent pricing
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
             {pricingData.map((p, i) => <PricePlanCard key={i} index={i} {...p} login={login} />)}
          </div>
        </div>
      </section>

      {/* FAQ SECTION (WITH ID) */}
      <section id="faq" className="py-32 bg-slate-950 scroll-mt-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
            className="text-3xl md:text-4xl font-bold text-white mb-10 text-center"
          >
            Frequently Asked Questions
          </motion.h2>
          <div className="space-y-4">
            {faqData.map((faq, index) => (
              <FaqItem 
                key={index} 
                index={index}
                question={faq.question} 
                answer={faq.answer} 
                isOpen={openFaqIndex === index}
                onToggle={() => toggleFaq(index)}
              />
            ))}
          </div>
        </div>
      </section>

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

// Small icon used in the Hero
function SparklesIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M9.315 7.584C12.195 3.883 16.695 1.5 21.5 1.5a.75.75 0 01.75.75c0 5.068-2.5 9.806-6.815 12.584-2.88 1.848-6.19 2.825-9.62 2.825-3.43 0-6.74-.977-9.62-2.825A15.488 15.488 0 01.5 2.25.75.75 0 011.25 1.5c4.805 0 9.305 2.383 12.185 6.084zM16.5 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-9 12.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" clipRule="evenodd" />
    </svg>
  );
}