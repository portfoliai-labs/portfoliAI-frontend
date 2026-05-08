// app/(authenticated)/onboarding/page.tsx
"use client";

import { useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, Loader2, Rocket, User, Briefcase } from "lucide-react";
import { userService } from "../../services/userService";
import { advisorService } from "../../services/advisorService";
import { useUser } from "../../context/UserContext";
import type { UserRole } from "../../models/User";

import { StepPersonal } from "../../components/onboarding/StepPersonal";
import { StepFinancial } from "../../components/onboarding/StepFinancial";
import { StepGoals } from "../../components/onboarding/StepGoals";
import { StepConsultant } from "../../components/onboarding/StepConsultant";
import { StepPreferences } from "../../components/onboarding/StepPreferences";

interface OnboardingFormData {
  // Personal
  first_name: string;
  last_name: string;
  // Investor profile
  currency: string;
  estimated_wealth: string;
  annual_income: string;
  risk_tolerance: 'low' | 'medium' | 'high';
  financial_goals: string;
  // Consultant profile
  clients_count: string;
  total_aum: string;
  years_of_experience: string;
  specialization: string;
  language: string;
}

function RoleCard({
  icon,
  title,
  description,
  dark,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  dark?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full text-left p-8 rounded-[2rem] border transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] ${
        dark
          ? "bg-[#1c1917] border-[#C49A3C]/30 hover:border-[#C49A3C]/60"
          : "bg-white border-[rgba(196,154,60,0.25)] hover:border-[#C49A3C]/60 hover:shadow-lg"
      }`}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${dark ? "bg-[#C49A3C]/15" : "bg-[#F7F5EF]"}`}>
        <span className="text-[#C49A3C]">{icon}</span>
      </div>
      <h3
        className={`text-xl font-bold mb-2 ${dark ? "text-white" : "text-[#1c1917]"}`}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {title}
      </h3>
      <p className={`text-sm leading-relaxed ${dark ? "text-[#a8a29e]" : "text-[#78716c]"}`}>{description}</p>
      <div className={`mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${dark ? "text-[#C49A3C]" : "text-[#C49A3C]"}`}>
        Inizia <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useUser();

  const [role, setRole] = useState<UserRole | null>(null);
  const [step, setStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const [formData, setFormData] = useState<OnboardingFormData>({
    first_name: searchParams.get("first_name") || "",
    last_name: searchParams.get("last_name") || "",
    currency: "EUR",
    estimated_wealth: "",
    annual_income: "",
    risk_tolerance: "medium",
    financial_goals: "",
    clients_count: "",
    total_aum: "",
    years_of_experience: "",
    specialization: "",
    language: "it",
  });

  const handleRoleSelect = (selected: 'investor' | 'advisor') => {
    setRole(selected === 'investor' ? 'USER' : 'ADVISOR');
    setStep(1);
  };

  const handleNext = () => setStep((prev) => prev + 1);
  const handlePrev = () => {
    if (step === 1) {
      setStep(0);
      setRole(null);
    } else {
      setStep((prev) => prev - 1);
    }
  };

  const totalSteps = 3;

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      if (role === 'USER') {
        // Step 1: create profile with role USER
        await userService.createUserProfile({
          first_name: formData.first_name,
          last_name: formData.last_name,
          language: "en",
          role: 'USER',
        });
        // Step 2: set investor financial profile
        await userService.updateUserProfile({
          currency: formData.currency || null,
          estimated_wealth: parseFloat(formData.estimated_wealth) || null,
          annual_income: parseFloat(formData.annual_income) || null,
          risk_tolerance: formData.risk_tolerance || null,
          financial_goals: formData.financial_goals || null,
        });
      } else {
        // Step 1: create profile with role ADVISOR
        await userService.createUserProfile({
          first_name: formData.first_name,
          last_name: formData.last_name,
          language: formData.language || "it",
          role: 'ADVISOR',
        });
        // Step 2: set advisor profile data
        await advisorService.updateAdvisorProfile({
          clients_count: parseInt(formData.clients_count) || null,
          aum: parseFloat(formData.total_aum) || null,
          years_experience: parseInt(formData.years_of_experience) || null,
          specialization: formData.specialization || null,
        });
      }

      await refreshUser();
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to create profile:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [formData, role, refreshUser, router]);

  const isNextDisabled = step === 1 && (!formData.first_name.trim() || !formData.last_name.trim());

  // — Step 0: Role selection —
  if (step === 0) {
    return (
      <div className="min-h-screen bg-[#F7F5EF] flex flex-col items-center justify-center p-6">
        <div
          className="text-2xl font-black tracking-tight text-[#1c1917] mb-12"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Portfoli<span className="text-[#C49A3C]">AI</span>
        </div>

        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C49A3C] mb-3">Benvenuto</p>
            <h1
              className="text-3xl md:text-4xl font-bold text-[#1c1917] mb-3"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Come utilizzerai PortfoliAI?
            </h1>
            <p className="text-[#78716c] text-sm">
              Seleziona il profilo più adatto a te. Potrai sempre modificarlo in seguito.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <RoleCard
              icon={<User className="w-7 h-7" />}
              title="Investitore Privato"
              description="Gestisci il tuo patrimonio personale, analizza i tuoi investimenti e ottieni report fiscali."
              onClick={() => handleRoleSelect('investor')}
            />
            <RoleCard
              icon={<Briefcase className="w-7 h-7" />}
              title="Consulente Finanziario"
              description="Gestisci più clienti, carica le loro operazioni e personalizza l'analisi per ciascuno."
              dark
              onClick={() => handleRoleSelect('advisor')}
            />
          </div>
        </div>
      </div>
    );
  }

  // — Steps 1–3 —
  const renderStep = () => {
    if (role === 'USER') {
      if (step === 1) return <StepPersonal formData={formData} setFormData={setFormData} />;
      if (step === 2) return <StepFinancial formData={formData} setFormData={setFormData} />;
      if (step === 3) return <StepGoals formData={formData} setFormData={setFormData} />;
    } else {
      if (step === 1) return <StepPersonal formData={formData} setFormData={setFormData} />;
      if (step === 2) return <StepConsultant formData={formData} setFormData={setFormData} />;
      if (step === 3) return <StepPreferences formData={formData} setFormData={setFormData} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5EF] flex flex-col items-center justify-center p-4">
      {/* Progress bar */}
      <div className="w-full max-w-2xl mb-8 flex items-center justify-between relative px-2">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-[rgba(196,154,60,0.2)] -z-10 rounded-full" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#C49A3C] -z-10 rounded-full transition-all duration-500"
          style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
        />

        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((num) => (
          <div
            key={num}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all duration-300 text-sm ${
              step >= num
                ? "bg-[#C49A3C] border-[#C49A3C]/30 text-white"
                : "bg-white border-[rgba(196,154,60,0.3)] text-[#a8a29e]"
            }`}
          >
            {step > num ? <Check className="w-4 h-4" /> : num}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-sm border border-[rgba(196,154,60,0.2)] p-8 md:p-12">
        <div className="min-h-[300px]">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-[rgba(196,154,60,0.15)]">
          <button
            onClick={handlePrev}
            disabled={loading}
            className={`flex items-center gap-2 px-6 py-3 font-bold text-[#78716c] hover:bg-[#F7F5EF] rounded-xl transition-colors ${
              step === 0 ? "invisible" : "visible"
            }`}
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={isNextDisabled}
              className="flex items-center gap-2 px-8 py-4 bg-[#1c1917] text-white rounded-2xl font-bold hover:bg-[#2a2820] transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-4 bg-[#C49A3C] text-white rounded-2xl font-bold hover:bg-[#d4aa4c] transition-colors shadow-sm disabled:opacity-50"
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

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C49A3C]" />
      </div>
    }>
      <OnboardingWizard />
    </Suspense>
  );
}
