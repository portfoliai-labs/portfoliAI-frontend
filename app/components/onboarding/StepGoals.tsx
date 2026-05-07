import { Target } from "lucide-react";

interface StepGoalsProps {
  formData: any;
  setFormData: (data: any) => void;
}

export function StepGoals({ formData, setFormData }: StepGoalsProps) {
  const riskLevels = ['low', 'medium', 'high'] as const;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black text-slate-800">Your Strategy</h1>
        <p className="text-slate-500 mt-2">Define your goals and your willingness to take risks.</p>
      </div>
      
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Risk Tolerance</label>
        <div className="grid grid-cols-3 gap-3">
          {riskLevels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setFormData({...formData, risk_tolerance: level})}
              className={`p-4 rounded-2xl font-bold border-2 transition-all capitalize ${
                formData.risk_tolerance === level 
                  ? 'border-blue-600 bg-blue-50 text-blue-700' 
                  : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-blue-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 mt-6">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Your Goals (Optional)</label>
        <textarea 
          rows={3}
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all resize-none"
          value={formData.financial_goals}
          onChange={(e) => setFormData({...formData, financial_goals: e.target.value})}
          placeholder="E.g. Buy a house in 5 years, early retirement..."
        />
      </div>
    </div>
  );
}