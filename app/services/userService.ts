// services/userService.ts
import type { UserProfile, ProfileCreatePayload, ProfileUpdatePayload, UserMetrics } from "../models/User";
import { apiFetch } from "./apiClient";

export const userService = {
  async getUserProfile(): Promise<UserProfile> {
    return apiFetch<UserProfile>('/users/profile');
  },

  // POST /users/register — creates the user with basic info + role only
  async createUserProfile(payload: ProfileCreatePayload): Promise<UserProfile> {
    return apiFetch<UserProfile>('/users/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // PATCH /users/profile — sets investor financial data after profile creation
  async updateUserProfile(payload: ProfileUpdatePayload): Promise<void> {
    return apiFetch<void>('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async getUserMetrics(): Promise<UserMetrics> {
    return apiFetch<UserMetrics>('/users/metrics');
  },
};
