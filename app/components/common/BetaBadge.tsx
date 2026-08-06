/**
 * Small "Beta" pill shown next to the logo wherever it appears. Signals to
 * every visitor — logged in or not — that the product is an early-stage,
 * individually-operated pilot, reinforcing the disclaimers in the ToS/Privacy
 * Policy rather than relying on users to find them.
 */
export function BetaBadge({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.08em] leading-none"
      style={
        dark
          ? { background: "rgba(196,154,60,0.15)", color: "#E8C97A", border: "1px solid rgba(196,154,60,0.3)" }
          : { background: "rgba(196,154,60,0.1)", color: "#8A6A28", border: "1px solid rgba(196,154,60,0.3)" }
      }
    >
      Beta
    </span>
  );
}
