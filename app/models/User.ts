

// models/User.ts

interface User {
  id: number;
  uuid: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  language: string;
  created_at: string;
}

interface UserInvestorProfile {
  estimated_wealth: number | null;
  annual_income: number | null;
  financial_goals: string | null;
  risk_tolerance: string | null;
  currency: string | null;
}

// UserProfile estende User: eredita tutti i campi sopra + aggiunge il profilo
interface UserProfile extends User {
  investor_profile: UserInvestorProfile | null;
}

interface UserMetrics {
  user_id: string;
  report_generated: number;
  report_in_error: number;
  report_in_progress: number;
};


export type { User, UserProfile, UserInvestorProfile, UserMetrics };