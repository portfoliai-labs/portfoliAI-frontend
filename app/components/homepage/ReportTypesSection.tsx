import { motion } from "framer-motion";
import { FileSearch, Send, LucideIcon } from "lucide-react";

interface ReportTypeCard {
  icon: LucideIcon;
  badge: string;
  title: string;
  description: string;
  points: string[];
  meta: string;
  emphasized?: boolean;
}

const CARDS: ReportTypeCard[] = [
  {
    icon: FileSearch,
    badge: "On request",
    title: "Full Analysis",
    description: "Covers your entire history in depth.",
    points: ["Performance & ROI", "Risk & volatility", "Costs, explicit + implicit", "Allocation & efficient frontier", "Benchmark comparison"],
    meta: "Typically generated once, on your first upload.",
  },
  {
    icon: Send,
    badge: "Automatic — arrives on its own",
    title: "Periodic Report",
    description: "What changed this period, in a page you can read in a minute.",
    points: ["Capital deposited or withdrawn", "Market effect on your value", "Costs incurred this period", "How your weights moved", "Thresholds crossed"],
    meta: "Monthly, quarterly, and annual — no request needed.",
    emphasized: true,
  },
];

export default function ReportTypesSection() {
  return (
    <section className="border-b py-24 scroll-mt-20" style={{ background: "#F7F5EF", borderColor: "#E0DACC" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-px" style={{ background: "#C49A3C" }} />
          <span className="text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: "#8A6A28" }}>
            Two kinds of report
          </span>
        </div>
        <h2
          className="text-[clamp(26px,3.5vw,46px)] font-bold leading-[1.1] tracking-tight mb-3"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
        >
          One deep-dive.<br />One that finds you.
        </h2>
        <p className="mb-14 text-[14px] font-light max-w-lg" style={{ color: "#78716c" }}>
          You ask for one, the other shows up in your inbox by itself.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex flex-col p-9 rounded-[4px] border"
                style={{
                  background: card.emphasized ? "#1c1917" : "#fff",
                  borderColor: card.emphasized ? "#1c1917" : "#e7e5e0",
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div
                    className="w-10 h-10 flex items-center justify-center rounded-sm border"
                    style={{ borderColor: card.emphasized ? "rgba(196,154,60,0.4)" : "rgba(196,154,60,0.25)" }}
                  >
                    <Icon className="w-4.5 h-4.5" style={{ color: card.emphasized ? "#E8C97A" : "#8A6A28" }} strokeWidth={1.5} />
                  </div>
                  <span
                    className="text-[10px] font-semibold tracking-[0.1em] uppercase px-2.5 py-1 rounded-full"
                    style={
                      card.emphasized
                        ? { background: "#C49A3C", color: "#1c1917" }
                        : { background: "rgba(196,154,60,0.08)", color: "#8A6A28" }
                    }
                  >
                    {card.badge}
                  </span>
                </div>

                <h3
                  className="text-[22px] font-bold mb-2 tracking-tight"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: card.emphasized ? "#fff" : "#1c1917" }}
                >
                  {card.title}
                </h3>
                <p
                  className="text-[13px] leading-relaxed mb-6"
                  style={{ color: card.emphasized ? "rgba(255,255,255,0.5)" : "#78716c" }}
                >
                  {card.description}
                </p>

                <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                  {card.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2 text-[12.5px]"
                      style={{ color: card.emphasized ? "rgba(255,255,255,0.55)" : "#5b5650" }}
                    >
                      <span className="shrink-0 mt-0.5 text-[11px]" style={{ color: card.emphasized ? "rgba(196,154,60,0.6)" : "#C49A3C" }}>→</span>
                      {p}
                    </li>
                  ))}
                </ul>

                <div
                  className="pt-4 text-[11.5px]"
                  style={{
                    borderTop: `1px solid ${card.emphasized ? "rgba(255,255,255,0.08)" : "#e7e5e0"}`,
                    color: card.emphasized ? "rgba(196,154,60,0.6)" : "#a8a29e",
                  }}
                >
                  {card.meta}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
