// services/userService.ts
import type { UserProfile, UserMetrics } from "../models/User";
import { apiFetch } from "./apiClient";


export const userService = {
  /**
   * GET PROFILE: Restituisce UserProfile (User + InvestorProfile)
   */
  async getUserProfile(): Promise<UserProfile> {
    return apiFetch<UserProfile>('/users/profile');
  },

  async createUserProfile(profileData: any): Promise<UserProfile> {
    return apiFetch<UserProfile>('/users/profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  },

  /**
   * UPDATE PROFILE
   */
  async updateUserProfile(profileData: Partial<UserProfile>): Promise<void> {
    return apiFetch<void>('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  },

  async getUserMetrics(): Promise<UserMetrics> {
    return apiFetch<UserMetrics>('/users/metrics');
  }

};