"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, ArrowRight,
  User, Building2,
  TrendingUp, DollarSign, Activity, Shield, Scale,
  LayoutDashboard, Mail,
} from "lucide-react";
import { useAuthFlow } from "@/app/hooks/useAuthFlow";
import FeatureCard from "../components/homepage/FeatureCard";
import SubscriptionSection from "../components/homepage/SubscriptionsSection";
import FaqSection from "../components/homepage/FaqSection";
import ReportScrollPreview from "../components/homepage/ReportScrollPreview";
import DemoTourModal from "../components/homepage/DemoTourModal";
import HowItWorksSection from "../components/homepage/HowItWorksSection";
import ReportTypesSection from "../components/homepage/ReportTypesSection";
import DashboardSection from "../components/homepage/DashboardSection";
import { BetaBadge } from "../components/common/BetaBadge";

const featuresData = [
  { icon: DollarSign,     title: "Cost Transparency",     description: "Explicit commissions and implicit bid-ask spreads broken down by broker, asset, and period. The true cost of every trade." },
  { icon: LayoutDashboard, title: "Daily Dashboard",       description: "Current value, unrealized P/L, composition and costs — refreshed once a day after markets close." },
  { icon: Mail,           title: "Automatic Periodic Reports", description: "Monthly, quarterly and annual reports arrive in your inbox on their own. Nothing to request, nothing to remember." },
  { icon: BarChart3,      title: "Portfolio Overview",    description: "Total invested capital vs. current value, unrealized P/L, and overall ROI — all in one high-level snapshot." },
  { icon: TrendingUp,     title: "Cash Flow & Dividends", description: "Historical deposits, withdrawals, buy/sell activity, and dividend income broken down by asset — yield, yield on cost, and YoY growth." },
  { icon: Activity,       title: "Performance & ROI",     description: "Monthly heatmaps, annual returns, trailing period performance, and comparison against a market benchmark — alpha, tracking error, and more." },
  { icon: Scale,          title: "Efficient Frontier",    description: "Mean-variance optimization, Max Sharpe and Min Volatility allocations, and an asset correlation matrix — where you stand vs. the theoretical optimum." },
  { icon: Shield,         title: "Risk & Volatility",     description: "21-day rolling volatility, max drawdown, Sharpe ratio, and a category-level breakdown of what's really driving your risk." },
];

const audienceData = [
  {
    number: "01", icon: User, title: "Private Investors", role: "Self-directed",
    description: "Finally understand exactly what's happening inside your portfolio, day after day — with institutional-grade metrics, not simplified dashboards.",
    features: ["Daily-updated dashboard", "Automatic periodic reports", "Cost transparency by broker", "Risk & drawdown analysis"],
    highlight: false,
  },
  {
    number: "02", icon: Building2, title: "Financial Advisors", role: "Consultants & Wealth Managers",
    description: "Every client tracked continuously. Periodic reports go out to your whole book automatically — no manual generation, no chasing.",
    features: ["Automatic reports for every client", "White-label formatting", "Bulk report generation", "Branded with your firm's identity"],
    highlight: true,
  },
];

function SectionEyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-5 h-px" style={{ background: light ? "rgba(196,154,60,0.5)" : "#C49A3C" }} />
      <span className="text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: light ? "rgba(196,154,60,0.6)" : "#8A6A28" }}>
        {children}
      </span>
    </div>
  );
}

function SectionHeading({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <h2 className="text-[clamp(26px,3.5vw,46px)] font-bold leading-[1.1] tracking-tight"
      style={{ fontFamily: "'Playfair Display', Georgia, serif", color: light ? "#fff" : "#1c1917" }}>
      {children}
    </h2>
  );
}

function CapabilityBadges() {
  const badges = [
    { icon: LayoutDashboard, label: "Daily Dashboard" },
    { icon: Mail, label: "Automatic Reports" },
    { icon: DollarSign, label: "Real Cost Transparency" },
  ];
  return (
    <div className="flex gap-2 flex-wrap">
      {badges.map(({ icon: Icon, label }) => (
        <span key={label}
          className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide px-3.5 py-1.5 rounded-sm border uppercase"
          style={{ background: "transparent", color: "#78716c", borderColor: "#e7e5e0" }}
        >
          <Icon className="w-3 h-3" style={{ color: "#8A6A28" }} strokeWidth={1.5} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── HERO — full light background, report floats ────────────────────────────────

function HeroSection({ onLogin, onViewSample }: { onLogin: () => void; onViewSample: () => void }) {
  return (
    <section
      className="grid grid-cols-1 lg:grid-cols-2 items-center border-b"
      style={{ background: "#F7F5EF", borderColor: "#E0DACC", minHeight: "90vh" }}
    >
      {/* LEFT — copy */}
      <motion.div
        className="flex flex-col justify-center px-8 md:px-14 py-20"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        <SectionEyebrow>Continuous Portfolio Monitoring</SectionEyebrow>

        <h1
          className="text-[clamp(38px,5vw,64px)] font-black leading-[1.04] tracking-tight mb-6"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
        >
          See what your<br />
          investments are<br />
          <em style={{ fontStyle: "italic", color: "#8A6A28" }}>really</em> doing.
        </h1>

        <p className="text-[15px] font-light leading-[1.78] max-w-105 mb-8" style={{ color: "#78716c" }}>
          Upload your history once and PortfoliAI takes it from there: a dashboard updated
          every day, and monthly, quarterly and annual reports that land in your inbox —
          including the real cost of every trade, spread included.
        </p>

        <div className="mb-8"><CapabilityBadges /></div>

        <div className="flex items-center gap-5">
          <button onClick={onLogin}
            className="flex items-center gap-2 text-[13px] font-semibold px-6 py-3.5 rounded-[3px] transition-colors duration-200"
            style={{ background: "#1c1917", color: "#fafaf9" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2820")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1c1917")}
          >
            Start Tracking Free <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={onViewSample}
            className="text-[12px] tracking-wide transition-colors duration-200"
            style={{ color: "#a8a29e" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1c1917")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#a8a29e")}
          >
            View sample →
          </button>
        </div>

        <div className="flex mt-12 pt-8 border-t gap-0" style={{ borderColor: "#E0DACC" }}>
          {[{ num: "Daily", label: "portfolio updates" }, { num: "3", label: "automatic report cadences" }, { num: "100%", label: "of costs shown, explicit + implicit" }].map((s, i) => (
            <div key={i} className={`flex-1 ${i > 0 ? "pl-5 border-l" : ""} ${i < 2 ? "pr-5" : ""}`} style={{ borderColor: "#E0DACC" }}>
              <div className="text-[26px] font-bold leading-none mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>{s.num}</div>
              <div className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "#a8a29e" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* RIGHT — same light bg, PDF floats with 3D shadow */}
      <motion.div
        className="flex items-center justify-center px-8 py-16 lg:py-0"
        style={{ background: "#F7F5EF" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.25 }}
      >
        <ReportScrollPreview />
      </motion.div>
    </section>
  );
}

// ─── FOR WHOM ──────────────────────────────────────────────────────────────────

function ForWhomSection() {
  return (
    <section id="audience" className="border-b scroll-mt-20 py-24" style={{ background: "#131210", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <SectionEyebrow light>Built for</SectionEyebrow>
        <SectionHeading light>One platform,<br />two ways to use it.</SectionHeading>
        <p className="mt-3 mb-14 text-[14px] font-light max-w-md" style={{ color: "rgba(255,255,255,0.3)" }}>
          Whether monitoring your own portfolio or every client&apos;s, automatically and continuously.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border rounded-sm overflow-hidden"
          style={{ borderColor: "rgba(255,255,255,0.07)", "--tw-divide-opacity": 1 } as React.CSSProperties}>
          {audienceData.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div key={card.number}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative p-10 flex flex-col transition-colors duration-300"
                style={{ background: card.highlight ? "rgba(196,154,60,0.025)" : "transparent" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(196,154,60,0.04)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = card.highlight ? "rgba(196,154,60,0.025)" : "transparent"; }}
              >
                <span className="absolute top-5 right-6 text-[64px] font-black leading-none select-none pointer-events-none"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "rgba(255,255,255,0.04)" }}>{card.number}</span>
                <div className="w-11 h-11 flex items-center justify-center rounded-sm border mb-5 shrink-0"
                  style={{ borderColor: card.highlight ? "rgba(196,154,60,0.45)" : "rgba(196,154,60,0.2)" }}>
                  <Icon className="w-5 h-5" style={{ color: "#E8C97A" }} strokeWidth={1.5} />
                </div>
                <div className="text-[20px] font-bold mb-1 tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fff" }}>{card.title}</div>
                <div className="text-[10px] uppercase tracking-widest mb-4" style={{ color: "rgba(196,154,60,0.55)" }}>{card.role}</div>
                <p className="text-[13px] leading-[1.7] mb-6 flex-1" style={{ color: "rgba(255,255,255,0.35)" }}>{card.description}</p>
                <ul className="flex flex-col gap-2">
                  {card.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <span className="shrink-0 mt-0.5 text-[11px]" style={{ color: "rgba(196,154,60,0.45)" }}>→</span>{f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { login } = useAuthFlow();
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="min-h-screen font-sans overflow-hidden scroll-smooth" style={{ background: "#F7F5EF", color: "#1c1917" }}>

      {/* HEADER — light */}
      <header className="px-6 md:px-10 py-4 flex justify-between items-center sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ background: "rgba(250,248,242,0.94)", borderColor: "#e7e5e0" }}>
        <motion.div className="flex items-center gap-2.5" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <div className="w-7 h-7 flex items-center justify-center rounded-sm" style={{ background: "#1c1917" }}>
            <BarChart3 className="w-3.5 h-3.5" style={{ stroke: "#C49A3C" }} strokeWidth={2} />
          </div>
          <span className="text-[20px] font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
            PortfoliAI
          </span>
          <BetaBadge />
        </motion.div>

        <nav className="hidden md:flex gap-7 text-[12px] font-normal uppercase tracking-[0.06em]">
          {[{ label: "For Advisors", href: "#audience" },
            { label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "FAQ", href: "#faq" }
          ].map((item) => (
            <a key={item.label} href={item.href} className="transition-colors duration-200" style={{ color: "#78716c" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#1c1917")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#78716c")}
            >{item.label}</a>
          ))}
        </nav>

        <motion.button onClick={() => login()}
          className="text-[12px] font-semibold px-5 py-2.5 rounded-[3px] uppercase tracking-[0.05em] transition-colors duration-200"
          style={{ background: "#1c1917", color: "#fafaf9" }}
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#292524")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#1c1917")}
        >
          Sign In / Sign Up
        </motion.button>
      </header>

      <HeroSection onLogin={login} onViewSample={() => setDemoOpen(true)} />
      <DemoTourModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />

      <HowItWorksSection />
      <ReportTypesSection />
      <DashboardSection />
      <ForWhomSection />

      {/* FEATURES — light */}
      <section id="features" className="border-b py-24 scroll-mt-20" style={{ background: "#F7F5EF", borderColor: "#e7e5e0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionEyebrow>What&apos;s inside PortfoliAI</SectionEyebrow>
          <SectionHeading>Every angle,<br />covered.</SectionHeading>
          <p className="mt-3 mb-14 text-[14px] text-stone-400 max-w-sm">
            From the daily dashboard to the deepest report chapter — the same rigorous structure throughout.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuresData.map((f, i) => <FeatureCard key={i} index={i} {...f} />)}
          </div>
        </div>
      </section>

      <SubscriptionSection onCta={login} />
      <FaqSection />

      {/* FOOTER */}
      <footer className="border-t py-12" style={{ background: "#131210", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-[18px] font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fafaf9" }}>
            <BarChart3 className="w-5 h-5" style={{ stroke: "#C49A3C" }} strokeWidth={1.5} />PortfoliAI
          </div>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.2)" }}>
            © {new Date().getFullYear()} PortfoliAI. All rights reserved.
          </p>
          <div className="flex gap-6">
            {[{ label: "Privacy Policy", href: "/privacy-policy" }, { label: "Terms of Service", href: "/terms-of-service" }].map((l) => (
              <a key={l.label} href={l.href} className="text-[11px] uppercase tracking-wider transition-colors duration-200" style={{ color: "rgba(255,255,255,0.25)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
              >{l.label}</a>
            ))}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 mt-8 pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.22)" }}>
            PortfoliAI reports are generated automatically, including narrative analysis produced by
            an AI model, and are provided for informational and educational purposes only. Nothing on
            this site constitutes investment, tax, or legal advice, or a personalized recommendation
            under MiFID II. Past performance and simulated projections are not indicative of future
            results. Always verify figures independently and consult a licensed financial advisor
            before making investment decisions.
          </p>
        </div>
      </footer>
    </div>
  );
}
