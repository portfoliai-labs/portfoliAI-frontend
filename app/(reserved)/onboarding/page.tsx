// app/(authenticated)/onboarding/page.tsx
"use client";

import { useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, Loader2, Rocket } from "lucide-react";
import { userService } from "../../services/userService";
import { useUser } from "../../context/UserContext";

// Sub-components for each step
import { StepPersonal } from "../../components/onboarding/StepPersonal";
import { StepFinancial } from "../../components/onboarding/StepFinancial";
import { StepGoals } from "../../components/onboarding/StepGoals";

/**
 * Interface for the onboarding form data to satisfy the linter
 */
interface OnboardingFormData {
  first_name: string;
  last_name: string;
  currency: string;
  estimated_wealth: string;
  annual_income: string;
  risk_tolerance: 'low' | 'medium' | 'high';
  financial_goals: string;
}

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useUser();
  
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Initialize state with parameterized defaults
  const [formData, setFormData] = useState<OnboardingFormData>({
    first_name: searchParams.get("first_name") || "",
    last_name: searchParams.get("last_name") || "",
    currency: "EUR",
    estimated_wealth: "",
    annual_income: "",
    risk_tolerance: "medium",
    financial_goals: ""
  });

  const handleNext = () => setStep((prev) => prev + 1);
  const handlePrev = () => setStep((prev) => prev - 1);

  /**
   * Submits the gathered data to create the user profile
   */
  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      // Data transformation for the API
      const payload = {
        ...formData,
        estimated_wealth: parseFloat(formData.estimated_wealth) || 0,
        annual_income: parseFloat(formData.annual_income) || 0,
        language: "en" 
      };

      await userService.createUserProfile(payload);
      
      // CRITICAL: Refresh the global context so the app knows the profile now exists
      await refreshUser();
      
      // Navigate to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to create profile:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [formData, refreshUser, router]);

  /**
   * Logic to disable the 'Next' button if required fields are missing
   */
  const isNextDisabled = step === 1 && (!formData.first_name.trim() || !formData.last_name.trim());

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Progress Indicator */}
      <div className="w-full max-w-2xl mb-8 flex items-center justify-between relative px-2">
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

      {/* Card Container */}
      <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-xl p-8 md:p-12 border border-slate-100">
        
        {/* Dynamic Step Rendering */}
        <div className="min-h-[300px]">
          {step === 1 && <StepPersonal formData={formData} setFormData={setFormData} />}
          {step === 2 && <StepFinancial formData={formData} setFormData={setFormData} />}
          {step === 3 && <StepGoals formData={formData} setFormData={setFormData} />}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-slate-100">
          <button 
            onClick={handlePrev}
            disabled={loading}
            className={`flex items-center gap-2 px-6 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors ${
              step === 1 ? "invisible" : "visible"
            }`}
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>

          {step < 3 ? (
            <button 
              onClick={handleNext}
              disabled={isNextDisabled}
              className="flex items-center gap-2 px-8 py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : (
                <><Rocket className="w-5 h-5" /> Get Started</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Main Page Export with Suspense boundary 
 * Required by Next.js when using useSearchParams()
 */
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