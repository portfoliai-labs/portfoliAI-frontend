import { ShieldAlert } from "lucide-react";

/**
 * Persistent, non-dismissible legal notice shown wherever an AI-generated
 * report is actually consumed. Buried disclaimers (footer links only) carry
 * little evidentiary weight — this must be visible at the point of reliance.
 */
export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="note"
      aria-label="Legal disclaimer"
      className={`flex items-start gap-3 border-b ${compact ? "px-4 md:px-8 py-2.5" : "px-4 md:px-8 py-3.5"}`}
      style={{ background: "rgba(196,154,60,0.08)", borderColor: "rgba(196,154,60,0.25)" }}
    >
      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#8A6A28" }} strokeWidth={1.75} />
      <p className="text-[11.5px] leading-relaxed" style={{ color: "#5c4a1f" }}>
        <strong>Not financial advice.</strong> This report is generated automatically, including
        narrative sections produced by an AI model, and is provided for informational purposes
        only. It does not constitute investment, tax, or legal advice or a personalized
        recommendation under MiFID II. Figures may contain errors or delays — verify independently
        before making any decision. See our{" "}
        <a href="/terms-of-service" className="underline hover:opacity-80">Terms of Service</a>.
      </p>
    </div>
  );
}
