
// models/User.ts

type UserRole = 'investor' | 'consultant';

interface User {
  id: number;
  uuid: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  language: string;
  created_at: string;
  role?: UserRole;
}

interface UserInvestorProfile {
  estimated_wealth: number | null;
  annual_income: number | null;
  financial_goals: string | null;
  risk_tolerance: string | null;
  currency: string | null;
}

interface ConsultantProfile {
  clients_count: number | null;
  total_aum: number | null;
  years_of_experience: number | null;
  specialization: string | null;
  currency: string | null;
}

interface UserProfile extends User {
  investor_profile: UserInvestorProfile | null;
  consultant_profile?: ConsultantProfile | null;
}

interface UserMetrics {
  user_id: string;
  report_generated: number;
  report_in_error: number;
  report_in_progress: number;
}

export type { User, UserProfile, UserInvestorProfile, UserMetrics, ConsultantProfile, UserRole };