"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Globe, Target, ShieldAlert, Wallet, Coins, Save, 
  Loader2, CheckCircle2, AlertCircle, ChevronDown, Banknote 
} from "lucide-react";
import { userService } from "../../services/userService";

export function SettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Stati per i dropdown
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [isRiskOpen, setIsRiskOpen] = useState(false);

  const [formData, setFormData] = useState({
    language: "it",
    currency: "EUR",
    estimated_wealth: "0",
    annual_income: "0",
    financial_goals: "",
    risk_tolerance: "medium",
  });

  const languages = [
    { code: "it", label: "ITA", flag: "🇮🇹" },
    { code: "en", label: "ENG", flag: "🇬🇧" }
  ];

  const currencies = [
    { code: "EUR", label: "Euro (€)" },
    { code: "USD", label: "Dollar ($)" },
    { code: "GBP", label: "Pound (£)" }
  ];

  const riskLevels = [
    { code: "low", label: "Bassa", color: "text-emerald-600" },
    { code: "medium", label: "Media", color: "text-amber-600" },
    { code: "high", label: "Alta", color: "text-rose-600" }
  ];

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const user = await userService.getUserProfile();
        setFormData({
          language: user.language || "it",
          currency: user.investor_profile?.currency || "EUR",
          estimated_wealth: String(user.investor_profile?.estimated_wealth || 0),
          annual_income: String(user.investor_profile?.annual_income || 0),
          financial_goals: user.investor_profile?.financial_goals || "",
          risk_tolerance: user.investor_profile?.risk_tolerance || "medium",
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await userService.updateInvestorProfile({
        ...formData,
        estimated_wealth: parseFloat(formData.estimated_wealth),
        annual_income: parseFloat(formData.annual_income),
      });
      setMessage({ type: "success", text: "Profilo aggiornato con successo" });
    } catch (err) {
      setMessage({ type: "error", text: "Errore durante il salvataggio" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Impostazioni</h2>
          <p className="text-slate-500 font-medium">Personalizza la tua esperienza e il tuo profilo finanziario</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-[1.5rem] font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? "Salvataggio..." : "Salva Modifiche"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* COLONNA 1: Preferenze Base (Lingua + Valuta) */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <SectionHeader icon={<Globe className="w-5 h-5" />} title="Preferenze" />
          
          <div className="grid grid-cols-2 gap-4">
            {/* Selettore Lingua */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Lingua</label>
              <div className="relative">
                <button 
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 hover:bg-white hover:border-blue-200 transition-all"
                >
                  <span>{languages.find(l => l.code === formData.language)?.flag} {languages.find(l => l.code === formData.language)?.label}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
                </button>
                {isLangOpen && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden">
                    {languages.map(l => (
                      <button key={l.code} onClick={() => { setFormData({...formData, language: l.code}); setIsLangOpen(false); }} className="w-full p-4 text-left font-bold hover:bg-blue-50 text-slate-600 flex items-center gap-2">
                        {l.flag} {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selettore Valuta */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valuta</label>
              <div className="relative">
                <button 
                  onClick={() => setIsCurrencyOpen(!isCurrencyOpen)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 hover:bg-white hover:border-blue-200 transition-all"
                >
                  <span><Banknote className="w-4 h-4 inline mr-2 text-slate-400" /> {formData.currency}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isCurrencyOpen ? 'rotate-180' : ''}`} />
                </button>
                {isCurrencyOpen && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden">
                    {currencies.map(c => (
                      <button key={c.code} onClick={() => { setFormData({...formData, currency: c.code}); setIsCurrencyOpen(false); }} className="w-full p-4 text-left font-bold hover:bg-blue-50 text-slate-600">
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COLONNA 2: Tolleranza Rischio */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <SectionHeader icon={<ShieldAlert className="w-5 h-5" />} title="Profilo di Rischio" />
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Livello di Rischio</label>
            <div className="relative">
              <button 
                onClick={() => setIsRiskOpen(!isRiskOpen)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 hover:bg-white hover:border-blue-200 transition-all"
              >
                <span className={riskLevels.find(r => r.code === formData.risk_tolerance)?.color}>
                  {riskLevels.find(r => r.code === formData.risk_tolerance)?.label}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isRiskOpen ? 'rotate-180' : ''}`} />
              </button>
              {isRiskOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden">
                  {riskLevels.map(r => (
                    <button key={r.code} onClick={() => { setFormData({...formData, risk_tolerance: r.code}); setIsRiskOpen(false); }} className={`w-full p-4 text-left font-bold hover:bg-blue-50 ${r.color}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGA FINANZIARIA (Patrimonio e Reddito) */}
        <div className="md:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
          <SectionHeader icon={<Wallet className="w-5 h-5" />} title="Dati Finanziari" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Patrimonio Stimato ({formData.currency})</label>
              <div className="relative">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"><Coins className="w-5 h-5" /></div>
                <input type="text" className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-300 transition-all" value={formData.estimated_wealth} onChange={(e) => setFormData({...formData, estimated_wealth: e.target.value.replace(/[^0-9.]/g, '')})}/>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Reddito Annuo ({formData.currency})</label>
              <div className="relative">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"><Banknote className="w-5 h-5" /></div>
                <input type="text" className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-300 transition-all" value={formData.annual_income} onChange={(e) => setFormData({...formData, annual_income: e.target.value.replace(/[^0-9.]/g, '')})}/>
              </div>
            </div>
            <div className="md:col-span-2 space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Obiettivi Finanziari</label>
              <textarea rows={3} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-300 transition-all resize-none" placeholder="Cosa vuoi ottenere?" value={formData.financial_goals} onChange={(e) => setFormData({...formData, financial_goals: e.target.value})}/>
            </div>
          </div>
        </div>
      </div>
      
      {/* Messaggi di Feedback */}
      {message && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-bold">{message.text}</span>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">{icon}</div>
      <span className="font-black text-xs uppercase tracking-widest text-slate-700">{title}</span>
    </div>
  );
}