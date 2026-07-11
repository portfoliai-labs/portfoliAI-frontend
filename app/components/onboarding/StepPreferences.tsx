import { Settings } from "lucide-react";

interface StepPreferencesProps {
  formData: any;
  setFormData: (data: any) => void;
}

export function StepPreferences({ formData, setFormData }: StepPreferencesProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-[#C49A3C]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Settings className="w-8 h-8 text-[#C49A3C]" />
        </div>
        <h1
          className="text-3xl font-bold text-[#1c1917]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Your preferences
        </h1>
        <p className="text-[#78716c] mt-2 text-sm">
          Set your default reference currency.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">Default currency</label>
        <select
          className="w-full p-4 bg-[#F7F5EF] border border-[rgba(196,154,60,0.3)] rounded-2xl font-bold text-[#1c1917] focus:bg-white focus:border-[#C49A3C] outline-none transition-all appearance-none cursor-pointer"
          value={formData.currency || "EUR"}
          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
        >
          <option value="EUR">Euro (€)</option>
          <option value="USD">US Dollar ($)</option>
          <option value="GBP">British Pound (£)</option>
        </select>
      </div>
    </div>
  );
}
