// models/User.ts
// Aligned with backend DTOs in app/api/dto/routes_user.py

// Matches UserRoles enum from backend
type UserRole = 'USER' | 'ADVISOR';

// Matches SubscriptionTier enum from backend
type SubscriptionTier = 'FREE' | 'TESTER';

// Matches UserProfileResponse DTO (GET /users/profile, POST /users/profile response)
interface UserProfile {
  uuid: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string | null;
  language: string;
  profile_picture: string | null;
  first_name: string | null;
  last_name: string | null;
  // Investor profile fields (null until set via PATCH /users/profile)
  estimated_wealth: number | null;
  annual_income: number | null;
  financial_goals: string | null;
  risk_tolerance: string | null;
  currency: string | null;
  subscription_tier: SubscriptionTier | null;
}

// Matches ProfileCreatePayload DTO (POST /users/profile)
interface ProfileCreatePayload {
  first_name: string;
  last_name: string;
  language: string;
  role: UserRole;
}

// Matches ProfileUpdatePayload DTO (PATCH /users/profile) — investor financial data
interface ProfileUpdatePayload {
  estimated_wealth?: number | null;
  annual_income?: number | null;
  financial_goals?: string | null;
  risk_tolerance?: string | null;
  currency?: string | null;
  language?: string | null;
}

// Matches UserMetricsResponse DTO (GET /users/metrics)
interface UserMetrics {
  report_generated: number;
  report_in_error: number;
  report_in_progress: number;
  report_generated_this_month: number;
  // null means the subscription has no monthly cap (unlimited reports)
  reports_remaining: number | null;
}

// Matches SubscriptionResponse DTO (GET /users/subscription, POST /users/subscription)
interface SubscriptionResponse {
  tier: SubscriptionTier;
  plan_name: string;
  monthly_reports_limit: number | null;
  has_unlimited_reports: boolean;
  created_at: string;
  updated_at: string;
}

export type {
  UserProfile,
  ProfileCreatePayload,
  ProfileUpdatePayload,
  UserMetrics,
  UserRole,
  SubscriptionTier,
  SubscriptionResponse,
};
