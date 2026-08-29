import { motion } from "framer-motion";
import { Clock, TrendingUp, PieChart, DollarSign } from "lucide-react";

const KpiTile = ({
  icon: Icon, label, value, sub, valueColor = "#1c1917",
}: { icon: React.ElementType; label: string; value: string; sub?: string; valueColor?: string }) => (
  <div className="rounded-[4px] p-4 flex flex-col gap-1" style={{ background: "#fff", border: "1px solid #E8E4DC" }}>
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3" style={{ color: "#a8a29e" }} strokeWidth={1.5} />
      <span className="text-[9px] uppercase tracking-widest" style={{ color: "#a8a29e" }}>{label}</span>
    </div>
    <span className="text-[19px] font-bold leading-none" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: valueColor }}>
      {value}
    </span>
    {sub && <span className="text-[9px]" style={{ color: "#c4bdb5" }}>{sub}</span>}
  </div>
);

const AllocRow = ({ name, pct, color }: { name: string; pct: number; color: string }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between">
      <span className="text-[10px]" style={{ color: "#78716c" }}>{name}</span>
      <span className="text-[10px] font-mono font-medium" style={{ color: "#292524" }}>{pct}%</span>
    </div>
    <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "#E8E4DC" }}>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </div>
  </div>
);

export default function DashboardSection() {
  return (
    <section className="border-b py-24 scroll-mt-20" style={{ background: "#FDFCF8", borderColor: "#e7e5e0" }}>
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

        {/* Mockup */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="order-2 lg:order-1"
        >
          <div className="rounded-[6px] p-5" style={{ background: "#F7F5EF", border: "1px solid #E0DACC" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "#8A6A28" }}>Dashboard</span>
              <span className="flex items-center gap-1 text-[9px]" style={{ color: "#a8a29e" }}>
                <Clock className="w-3 h-3" /> Updated today, after close
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <KpiTile icon={DollarSign} label="Current Value" value="€ 44,232" />
              <KpiTile icon={TrendingUp} label="Unrealized P/L" value="+€ 14,357" valueColor="#2D6A4F" />
            </div>

            <div className="rounded-[4px] p-3.5 mb-2.5" style={{ background: "#fff", border: "1px solid #E8E4DC" }}>
              <div className="flex items-center gap-1.5 mb-3">
                <PieChart className="w-3 h-3" style={{ color: "#a8a29e" }} strokeWidth={1.5} />
                <span className="text-[9px] uppercase tracking-widest" style={{ color: "#a8a29e" }}>Composition</span>
              </div>
              <div className="flex flex-col gap-2.5">
                <AllocRow name="ETF (6 holdings)" pct={95.3} color="#C49A3C" />
                <AllocRow name="Cryptocurrency" pct={4.7} color="rgba(196,154,60,0.35)" />
              </div>
            </div>

            <div className="rounded-[4px] p-3.5" style={{ background: "rgba(196,154,60,0.07)", border: "1px solid rgba(196,154,60,0.25)" }}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[9px] uppercase tracking-widest" style={{ color: "#8A6A28" }}>Total Cost, This Period</span>
                <span className="text-[15px] font-bold font-mono" style={{ color: "#8A6A28" }}>€ 401.39</span>
              </div>
              <div className="flex gap-2.5">
                <div className="flex-1 rounded-sm p-2" style={{ background: "#fff" }}>
                  <div className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: "#a8a29e" }}>Explicit</div>
                  <div className="text-[11px] font-mono font-medium" style={{ color: "#292524" }}>€ 59.00</div>
                </div>
                <div className="flex-1 rounded-sm p-2" style={{ background: "#fff" }}>
                  <div className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: "#a8a29e" }}>Implicit (spread)</div>
                  <div className="text-[11px] font-mono font-medium" style={{ color: "#9B2226" }}>€ 342.39</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="order-1 lg:order-2"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="w-5 h-px" style={{ background: "#C49A3C" }} />
            <span className="text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: "#8A6A28" }}>
              The dashboard
            </span>
          </div>
          <h2
            className="text-[clamp(26px,3.5vw,46px)] font-bold leading-[1.1] tracking-tight mb-5"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
          >
            Your portfolio,<br />any day you check.
          </h2>
          <p className="text-[14px] font-light leading-[1.8] max-w-md mb-6" style={{ color: "#78716c" }}>
            Current value, unrealized P/L, composition — and, in plain view, what it actually
            cost you to get here. Split between what your broker shows you and what it doesn&apos;t.
          </p>
          <div className="flex items-start gap-3 rounded-[4px] p-4 max-w-md" style={{ background: "#F7F5EF", border: "1px solid #E0DACC" }}>
            <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#8A6A28" }} strokeWidth={1.5} />
            <p className="text-[12.5px] leading-relaxed" style={{ color: "#78716c" }}>
              Prices update once a day, after markets close. It&apos;s a monitoring tool, not a
              trading screen — built for tracking your portfolio over time, not for watching it
              tick.
            </p>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
