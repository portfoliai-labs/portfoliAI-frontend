"use client";

import React, { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, ShieldCheck, Zap, Loader2, AlertCircle, Copy, Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAuthFlow } from "@/app/hooks/useAuthFlow";

const loginFeatures: Array<{ icon: React.ElementType; title: string; description: string }> = [
  {
    icon: Zap,
    title: "Instant AI Analysis",
    description: "Get your portfolio parsed and analysed in seconds.",
  },
  {
    icon: ShieldCheck,
    title: "Zero-Retention Privacy",
    description: "Your data is processed in-memory and destroyed immediately after the report is generated.",
  },
];

function TokenDisplay({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="w-full max-w-sm"
    >
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-px" style={{ background: "#C49A3C" }} />
          <span className="text-[10px] font-medium tracking-[0.14em] uppercase" style={{ color: "#8A6A28" }}>
            Authentication token
          </span>
        </div>
        <h2
          className="text-[clamp(26px,3vw,36px)] font-black leading-tight tracking-tight mb-3"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
        >
          Token generated.
        </h2>
        <p className="text-[14px] font-light" style={{ color: "#78716c" }}>
          Copy this token and paste it into the extension to authenticate.
        </p>
      </div>

      <div
        className="rounded-[3px] p-4 mb-4 font-mono text-[11px] break-all leading-relaxed select-all"
        style={{
          background: "#1c1917",
          color: "#E8C97A",
          border: "1px solid rgba(196,154,60,0.25)",
          wordBreak: "break-all",
        }}
      >
        {token}
      </div>

      <button
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-[3px] transition-all duration-200 text-[13px] font-semibold tracking-[0.04em] uppercase"
        style={{
          background: copied ? "rgba(34,197,94,0.12)" : "#1c1917",
          color: copied ? "#16a34a" : "#fafaf9",
          border: copied ? "1px solid rgba(34,197,94,0.35)" : "1px solid #1c1917",
        }}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy token
          </>
        )}
      </button>

      <div
        className="rounded-[3px] px-4 py-3 flex items-start gap-3 mt-6"
        style={{ background: "rgba(196,154,60,0.06)", border: "1px solid rgba(196,154,60,0.15)" }}
      >
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#8A6A28" }} strokeWidth={1.5} />
        <p className="text-[11px] leading-relaxed" style={{ color: "#8A6A28" }}>
          This token grants access to your PortfoliAI account. Keep it private and do not share it.
        </p>
      </div>
    </motion.div>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const isAddon = searchParams.get("source") === "addon";

  const { login, status, isError, addonToken } = useAuthFlow(isAddon ? "addon" : "default");
  const isLoading: boolean = status === "Authenticating...";

  return (
    <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-20" style={{ background: "#F7F5EF" }}>
      {/* Mobile logo */}
      <div className="md:hidden flex items-center gap-2.5 mb-12">
        <div className="w-7 h-7 flex items-center justify-center rounded-[4px]" style={{ background: "#1c1917" }}>
          <BarChart3 className="w-[14px] h-[14px]" style={{ stroke: "#C49A3C" }} strokeWidth={2} />
        </div>
        <span className="text-[20px] font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
          PortfoliAI
        </span>
      </div>

      {addonToken ? (
        <TokenDisplay token={addonToken} />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="w-full max-w-sm"
        >
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-5 h-px" style={{ background: "#C49A3C" }} />
              <span className="text-[10px] font-medium tracking-[0.14em] uppercase" style={{ color: "#8A6A28" }}>
                {isAddon ? "Extension sign in" : "Sign in"}
              </span>
            </div>
            <h2
              className="text-[clamp(28px,3vw,40px)] font-black leading-tight tracking-tight mb-3"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
            >
              {isAddon ? "Authenticate extension." : "Welcome back."}
            </h2>
            <p className="text-[14px] font-light" style={{ color: "#78716c" }}>
              {isAddon
                ? "Sign in with Google to generate your authentication token."
                : "Sign in to access your portfolio reports."}
            </p>
          </div>

          {isError && (
            <div
              className="mb-6 p-4 rounded-[3px] flex items-start gap-3"
              style={{ background: "rgba(155,34,38,0.06)", border: "1px solid rgba(155,34,38,0.2)" }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#9B2226" }} />
              <span className="text-[12px] font-medium" style={{ color: "#9B2226" }}>{status}</span>
            </div>
          )}

          <button
            onClick={() => login()}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-[3px] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "#1c1917", color: "#fafaf9", border: "1px solid #1c1917" }}
            onMouseEnter={(e) => { if (!isLoading) (e.currentTarget.style.background = "#2a2820"); }}
            onMouseLeave={(e) => { if (!isLoading) (e.currentTarget.style.background = "#1c1917"); }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#C49A3C" }} />
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
            )}
            <span className="text-[13px] font-semibold tracking-[0.04em] uppercase">
              {isLoading ? "Signing in…" : "Continue with Google"}
            </span>
          </button>

          {!isError && isLoading && (
            <p className="text-center text-[11px] font-medium mt-4 animate-pulse tracking-wider uppercase" style={{ color: "#C49A3C" }}>
              {status}
            </p>
          )}

          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px" style={{ background: "#E0DACC" }} />
            <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "#c4bdb5" }}>secure login</span>
            <div className="flex-1 h-px" style={{ background: "#E0DACC" }} />
          </div>

          <div
            className="rounded-[3px] px-4 py-3 flex items-start gap-3"
            style={{ background: "rgba(196,154,60,0.06)", border: "1px solid rgba(196,154,60,0.15)" }}
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#8A6A28" }} strokeWidth={1.5} />
            <p className="text-[11px] leading-relaxed" style={{ color: "#8A6A28" }}>
              Your files are processed in-memory and immediately destroyed.
              We never store your financial data.
            </p>
          </div>

          <p className="text-center text-[11px] mt-8 leading-relaxed" style={{ color: "#a8a29e" }}>
            By continuing, you agree to our{" "}
            <a href="#" className="underline transition-colors" style={{ color: "#78716c" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#1c1917")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#78716c")}
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline transition-colors" style={{ color: "#78716c" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#1c1917")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#78716c")}
            >
              Privacy Policy
            </a>.
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "#F7F5EF" }}>

      {/* ── LEFT — branding ── */}
      <div
        className="hidden md:flex md:w-1/2 flex-col justify-between p-14 lg:p-20 border-r relative overflow-hidden"
        style={{ background: "#131210", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-80px", left: "-80px",
            width: "480px", height: "480px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(196,154,60,0.07) 0%, transparent 70%)",
            filter: "blur(32px)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2.5"
        >
          <div className="w-7 h-7 flex items-center justify-center rounded-[4px]" style={{ background: "#fafaf9" }}>
            <BarChart3 className="w-[14px] h-[14px]" style={{ stroke: "#131210" }} strokeWidth={2} />
          </div>
          <span className="text-[20px] font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fafaf9" }}>
            PortfoliAI
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <div className="flex items-center gap-2 mb-8">
            <span className="w-5 h-px" style={{ background: "rgba(196,154,60,0.5)" }} />
            <span className="text-[10px] font-medium tracking-[0.14em] uppercase" style={{ color: "rgba(196,154,60,0.6)" }}>
              AI Portfolio Intelligence
            </span>
          </div>
          <h1
            className="text-[clamp(34px,3.8vw,52px)] font-black leading-[1.06] tracking-tight mb-6"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fafaf9" }}
          >
            Master your<br />
            wealth with<br />
            <em style={{ fontStyle: "italic", color: "#8A6A28" }}>absolute</em> clarity.
          </h1>
          <p className="text-[14px] font-light leading-[1.75] max-w-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            Join investors and advisors who use PortfoliAI to uncover
            hidden costs and understand their real returns.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="flex flex-col gap-6"
        >
          {loginFeatures.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="flex items-start gap-4">
                <div
                  className="w-9 h-9 flex items-center justify-center rounded-[4px] border flex-shrink-0"
                  style={{ borderColor: "rgba(196,154,60,0.22)" }}
                >
                  <Icon className="w-4 h-4" style={{ color: "#E8C97A" }} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold mb-0.5" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fafaf9" }}>
                    {feature.title}
                  </h3>
                  <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="flex gap-0 mt-4 pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {[{ num: "€ 0", label: "to start" }, { num: "100%", label: "private" }, { num: "<30s", label: "per report" }].map((s, i) => (
              <div key={i} className={`flex-1 ${i > 0 ? "pl-4 border-l" : ""} ${i < 2 ? "pr-4" : ""}`} style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-[22px] font-bold leading-none mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fafaf9" }}>{s.num}</div>
                <div className="text-[9px] uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.22)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT — auth form ── */}
      <Suspense fallback={
        <div className="w-full md:w-1/2 flex items-center justify-center" style={{ background: "#F7F5EF" }}>
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#C49A3C" }} />
        </div>
      }>
        <LoginContent />
      </Suspense>
    </div>
  );
}
