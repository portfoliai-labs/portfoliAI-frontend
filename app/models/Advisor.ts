// models/Advisor.ts
// Aligned with backend DTOs in app/api/dto/routes_advisor.py

// Matches AdvisorProfileResponse DTO (GET /advisor/profile)
interface AdvisorProfile {
  years_experience: number | null;
  specialization: string | null;
  clients_count: number | null;
  aum: number | null;
}

// Matches AdvisorProfileUpdatePayload DTO (PATCH /advisor/profile)
interface AdvisorProfileUpdatePayload {
  years_experience?: number | null;
  specialization?: string | null;
  clients_count?: number | null;
  aum?: number | null;
}

// Matches ClientResponse DTO (GET /advisor/clients, POST /advisor/clients response)
interface Client {
  uuid: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string | null;
  language: string;
  profile_picture: string | null;
  first_name: string | null;
  last_name: string | null;
  estimated_wealth: number | null;
  annual_income: number | null;
  financial_goals: string | null;
  risk_tolerance: string | null;
  currency: string | null;
}

// Matches ClientCreatePayload DTO (POST /advisor/clients)
interface ClientCreatePayload {
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  estimated_wealth?: number;
  annual_income?: number;
  financial_goals?: string;
  risk_tolerance?: string;
  currency?: string;
}

// Matches ClientProfileUpdatePayload DTO (PATCH /advisor/clients/{uuid}/profile)
interface ClientProfileUpdatePayload {
  estimated_wealth?: number | null;
  annual_income?: number | null;
  financial_goals?: string | null;
  risk_tolerance?: string | null;
  currency?: string | null;
  language?: string | null;
}

export type { AdvisorProfile, AdvisorProfileUpdatePayload, Client, ClientCreatePayload, ClientProfileUpdatePayload };
