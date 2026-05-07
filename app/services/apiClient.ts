// services/apiClient.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;

  const defaultHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: defaultHeaders,
  });

  // INTERCEPTOR: Handle 401 Unauthorized
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      // Pulisci subito per invalidare eventuali altre chiamate concorrenti
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_profile");
      window.dispatchEvent(new Event("auth-unauthorized"));
    }
    throw new ApiError(401, "Unauthorized");
  }

  // Handle other errors
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorData.detail || `Error ${response.status}`);
  }

  return response.json();
}