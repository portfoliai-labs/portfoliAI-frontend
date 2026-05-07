import { Wallet } from "lucide-react";

interface StepFinancialProps {
  formData: any;
  setFormData: (data: any) => void;
}

export function StepFinancial({ formData, setFormData }: StepFinancialProps) {
  /* Helper to strip non-numeric characters for currency inputs */
  const handleNumericChange = (field: string, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setFormData({ ...formData, [field]: cleaned });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black text-slate-800">Your Current Situation</h1>
        <p className="text-slate-500 mt-2">This data helps us provide accurate financial analysis.</p>
      </div>

      <div className="space-y-2 mb-4">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Reference Currency</label>
        <select 
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
          value={formData.currency}
          onChange={(e) => setFormData({...formData, currency: e.target.value})}
        >
          <option value="EUR">Euro (€)</option>
          <option value="USD">US Dollar ($)</option>
          <option value="GBP">British Pound (£)</option>
        </select>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Estimated Wealth</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
              {formData.currency === 'EUR' ? '€' : formData.currency === 'USD' ? '$' : '£'}
            </span>
            <input 
              type="text" 
              className="w-full pl-10 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
              value={formData.estimated_wealth}
              onChange={(e) => handleNumericChange('estimated_wealth', e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Annual Income</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
              {formData.currency === 'EUR' ? '€' : formData.currency === 'USD' ? '$' : '£'}
            </span>
            <input 
              type="text" 
              className="w-full pl-10 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
              value={formData.annual_income}
              onChange={(e) => handleNumericChange('annual_income', e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
    </div>
  );
}