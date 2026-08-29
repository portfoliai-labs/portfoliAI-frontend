import { motion } from "framer-motion";
import { UploadCloud, Sparkles, LayoutDashboard, Mail, LucideIcon } from "lucide-react";

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
  highlight?: boolean;
}

const STEPS: Step[] = [
  {
    icon: UploadCloud,
    title: "Upload your history",
    description: "Once, ever. Export the CSV or Excel file from your broker and upload it.",
  },
  {
    icon: Sparkles,
    title: "Get the full analysis",
    description: "The complete report on your entire history — performance, risk, costs, allocation — right away.",
  },
  {
    icon: LayoutDashboard,
    title: "Follow the dashboard",
    description: "Value, P/L, composition and costs, updated every day after markets close.",
  },
  {
    icon: Mail,
    title: "Receive the reports",
    description: "Monthly, quarterly and annual reports land in your inbox automatically — no request needed.",
    highlight: true,
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-b py-24 scroll-mt-20" style={{ background: "#FDFCF8", borderColor: "#e7e5e0" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-px" style={{ background: "#C49A3C" }} />
          <span className="text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: "#8A6A28" }}>
            How it works now
          </span>
        </div>
        <h2
          className="text-[clamp(26px,3.5vw,46px)] font-bold leading-[1.1] tracking-tight mb-3"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
        >
          Upload once.<br />Hear from us on our own.
        </h2>
        <p className="mb-14 text-[14px] font-light max-w-lg" style={{ color: "#78716c" }}>
          There is no upload-and-download loop anymore. You set up your portfolio once, and the reporting comes to you from then on.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-px" style={{ background: "#e7e5e0" }}>
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative flex flex-col p-7"
                style={{ background: step.highlight ? "#1c1917" : "#FDFCF8" }}
              >
                <span
                  className="text-[10px] font-mono mb-4"
                  style={{ color: step.highlight ? "rgba(196,154,60,0.6)" : "#c4bdb5" }}
                >
                  0{i + 1}
                </span>
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-sm border mb-5"
                  style={{ borderColor: step.highlight ? "rgba(196,154,60,0.4)" : "rgba(196,154,60,0.25)" }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: step.highlight ? "#E8C97A" : "#8A6A28" }} strokeWidth={1.5} />
                </div>
                {step.highlight && (
                  <span
                    className="absolute top-6 right-6 text-[9px] font-semibold tracking-[0.1em] uppercase px-2 py-0.5 rounded-sm"
                    style={{ background: "#C49A3C", color: "#1c1917" }}
                  >
                    New
                  </span>
                )}
                <h3
                  className="text-[16px] font-bold mb-2 tracking-tight"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: step.highlight ? "#fff" : "#1c1917" }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: step.highlight ? "rgba(255,255,255,0.5)" : "#78716c" }}
                >
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
