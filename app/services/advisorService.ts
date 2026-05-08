// services/advisorService.ts
import type {
  AdvisorProfile,
  AdvisorProfileUpdatePayload,
  Client,
  ClientCreatePayload,
  ClientProfileUpdatePayload,
} from "../models/Advisor";
import { apiFetch } from "./apiClient";

export const advisorService = {
  // --- Advisor own profile ---

  async getAdvisorProfile(): Promise<AdvisorProfile> {
    return apiFetch<AdvisorProfile>('/advisor/profile');
  },

  async updateAdvisorProfile(payload: AdvisorProfileUpdatePayload): Promise<void> {
    return apiFetch<void>('/advisor/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // --- Client management ---

  async getClients(): Promise<Client[]> {
    return apiFetch<Client[]>('/advisor/clients');
  },

  async createClient(payload: ClientCreatePayload): Promise<Client> {
    return apiFetch<Client>('/advisor/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteClient(clientUuid: string): Promise<void> {
    return apiFetch<void>(`/advisor/clients/${clientUuid}`, {
      method: 'DELETE',
    });
  },

  async updateClientProfile(clientUuid: string, payload: ClientProfileUpdatePayload): Promise<void> {
    return apiFetch<void>(`/advisor/clients/${clientUuid}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
