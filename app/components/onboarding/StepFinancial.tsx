import { Wallet } from "lucide-react";

interface StepFinancialProps {
  formData: any;
  setFormData: (data: any) => void;
}

export function StepFinancial({ formData, setFormData }: StepFinancialProps) {
  const handleNumericChange = (field: string, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setFormData({ ...formData, [field]: cleaned });
  };

  const inputClass = "w-full p-4 bg-[#F7F5EF] border border-[rgba(196,154,60,0.3)] rounded-2xl font-bold text-[#1c1917] focus:bg-white focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 outline-none transition-all placeholder:text-[#a8a29e] placeholder:font-normal";
  const symbol = formData.currency === 'EUR' ? '€' : formData.currency === 'USD' ? '$' : '£';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-[#C49A3C]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Wallet className="w-8 h-8 text-[#C49A3C]" />
        </div>
        <h1
          className="text-3xl font-bold text-[#1c1917]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Your Current Situation
        </h1>
        <p className="text-[#78716c] mt-2 text-sm">This helps us provide accurate financial analysis.</p>
      </div>

      <div className="space-y-2 mb-4">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">Reference Currency</label>
        <select
          className="w-full p-4 bg-[#F7F5EF] border border-[rgba(196,154,60,0.3)] rounded-2xl font-bold text-[#1c1917] focus:bg-white focus:border-[#C49A3C] outline-none transition-all appearance-none cursor-pointer"
          value={formData.currency}
          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
        >
          <option value="EUR">Euro (€)</option>
          <option value="USD">US Dollar ($)</option>
          <option value="GBP">British Pound (£)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">Estimated Wealth</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#a8a29e]">{symbol}</span>
            <input
              type="text"
              className={`${inputClass} pl-10`}
              value={formData.estimated_wealth}
              onChange={(e) => handleNumericChange('estimated_wealth', e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">Annual Income</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#a8a29e]">{symbol}</span>
            <input
              type="text"
              className={`${inputClass} pl-10`}
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
