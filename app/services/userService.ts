// services/userService.ts
import type { User, UserProfile, UserInvestorProfile } from "../models/User";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error ${response.status}`);
  }
  return response.json();
}

export const userService = {
  /**
   * SIGNIN: Restituisce l'oggetto User base
   */
  async verifyToken(): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/verify-token`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<User>(response);
  },

  /**
   * GET PROFILE: Restituisce UserProfile (User + InvestorProfile)
   */
  async getUserProfile(): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<UserProfile>(response);
  },

  /**
   * UPDATE PROFILE
   */
  async updateInvestorProfile(profileData: Partial<UserInvestorProfile>): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData),
    });
    return handleResponse<void>(response);
  }
};