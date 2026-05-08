import { Target } from "lucide-react";

interface StepGoalsProps {
  formData: any;
  setFormData: (data: any) => void;
}

const riskConfig = {
  low: { label: "Conservative", sub: "Capital preservation" },
  medium: { label: "Moderate", sub: "Balanced growth" },
  high: { label: "Aggressive", sub: "Maximum growth" },
} as const;

export function StepGoals({ formData, setFormData }: StepGoalsProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-[#C49A3C]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Target className="w-8 h-8 text-[#C49A3C]" />
        </div>
        <h1
          className="text-3xl font-bold text-[#1c1917]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Your Strategy
        </h1>
        <p className="text-[#78716c] mt-2 text-sm">Define your goals and risk appetite.</p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">Risk Tolerance</label>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(riskConfig) as Array<keyof typeof riskConfig>).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setFormData({ ...formData, risk_tolerance: level })}
              className={`p-4 rounded-2xl font-bold border-2 transition-all text-left ${
                formData.risk_tolerance === level
                  ? 'border-[#C49A3C] bg-[#C49A3C]/10 text-[#1c1917]'
                  : 'border-[rgba(196,154,60,0.2)] bg-[#F7F5EF] text-[#78716c] hover:border-[#C49A3C]/50'
              }`}
            >
              <p className="text-sm">{riskConfig[level].label}</p>
              <p className="text-[10px] font-normal mt-0.5 opacity-70">{riskConfig[level].sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 mt-6">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">Your Goals (Optional)</label>
        <textarea
          rows={3}
          className="w-full p-4 bg-[#F7F5EF] border border-[rgba(196,154,60,0.3)] rounded-2xl font-medium text-[#1c1917] focus:bg-white focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 outline-none transition-all resize-none placeholder:text-[#a8a29e]"
          value={formData.financial_goals}
          onChange={(e) => setFormData({ ...formData, financial_goals: e.target.value })}
          placeholder="E.g. Buy a house in 5 years, early retirement..."
        />
      </div>
    </div>
  );
}
