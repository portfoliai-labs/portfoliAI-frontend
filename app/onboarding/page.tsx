// app/onboarding/page.tsx
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  User, Wallet, Target, ArrowRight, ArrowLeft, Check, Loader2, Rocket
} from "lucide-react";
import { userService } from "../services/userService";

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Initialize state using URL search params (passed from useAuthFlow)
  const [formData, setFormData] = useState({
    first_name: searchParams.get("first_name") || "",
    last_name: searchParams.get("last_name") || "",
    currency: "EUR",
    estimated_wealth: "",
    annual_income: "",
    risk_tolerance: "medium",
    financial_goals: ""
  });

  const handleNext = () => setStep(prev => prev + 1);
  const handlePrev = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Format numeric data before submitting
      const payload = {
        ...formData,
        estimated_wealth: parseFloat(formData.estimated_wealth) || 0,
        annual_income: parseFloat(formData.annual_income) || 0,
        language: "en" // Set default language
      };

      await userService.createUserProfile(payload);
      
      // User successfully created! Navigate to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Error creating user profile", error);
      alert("An error occurred while setting up your profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Progress Bar */}
      <div className="w-full max-w-2xl mb-8 flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded-full"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 -z-10 rounded-full transition-all duration-500"
          style={{ width: `${((step - 1) / 2) * 100}%` }}
        ></div>
        
        {[1, 2, 3].map((num) => (
          <div key={num} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 transition-colors duration-300 ${
            step >= num ? "bg-blue-600 border-blue-100 text-white" : "bg-white border-slate-200 text-slate-400"
          }`}>
            {step > num ? <Check className="w-5 h-5" /> : num}
          </div>
        ))}
      </div>

      {/* Wizard Card */}
      <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-xl p-8 md:p-12 border border-slate-100">
        
        {/* STEP 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-black text-slate-800">Welcome! What's your name?</h1>
              <p className="text-slate-500 mt-2">Let's get to know you to personalize your experience.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">First Name</label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  placeholder="E.g. John"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Last Name</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  placeholder="E.g. Doe"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Financial Info */}
        {step === 2 && (
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
                    onChange={(e) => setFormData({...formData, estimated_wealth: e.target.value.replace(/[^0-9.]/g, '')})}
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
                    onChange={(e) => setFormData({...formData, annual_income: e.target.value.replace(/[^0-9.]/g, '')})}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Goals & Risk */}
        {step === 3 && (
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
                {['low', 'medium', 'high'].map((level) => (
                  <button
                    key={level}
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
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-slate-100">
          {step > 1 ? (
            <button 
              onClick={handlePrev}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-5 h-5" /> Back
            </button>
          ) : <div></div> /* Spacer */}

          {step < 3 ? (
            <button 
              onClick={handleNext}
              disabled={step === 1 && (!formData.first_name || !formData.last_name)}
              className="flex items-center gap-2 px-8 py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-colors shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Creating...</>
              ) : (
                <><Rocket className="w-5 h-5" /> Complete Profile</>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// Wrap the main export in Suspense because Next.js requires it 
// when using useSearchParams() inside Client Components to prevent de-opts.
export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <OnboardingWizard />
    </Suspense>
  );
}