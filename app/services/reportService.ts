// services/reportService.ts
import { Report } from "../models/Report"
import { StandardTransaction } from "../models/Report";


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;


// --- Helper ---

const getAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Helper function to handle fetch responses and throw meaningful errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// --- Service ---

export const reportService = {
  async getAllDocuments(): Promise<Report[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/reports/`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await handleResponse<Report[]>(response);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Service: getAllDocuments failed", error);
      throw error;
    }
  },

  async processReport(data: StandardTransaction[], filename: string): Promise<{ success: boolean }> {
    try {
      if (!data || data.length === 0) throw new Error("No data provided for analysis");
      
      const response = await fetch(`${API_BASE_URL}/v1/reports/process-report`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data, filename }),
      });
      return await handleResponse<{ success: boolean }>(response);
    } catch (error) {
      console.error("Service: processReport failed", error);
      throw error;
    }
  },

  async downloadReport(documentId: string): Promise<{ url: string }> {
    try {      
      const response = await fetch(`${API_BASE_URL}/v1/reports/${documentId}/download`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      // Nota: se il backend restituisce un JSON con l'URL (es. di R2), usa questo.
      // Se restituisce un file binario, la logica di handleResponse andrebbe cambiata in .blob()
      return await handleResponse<{ url: string }>(response);
    } catch (error) {
      console.error("Service: downloadReport failed", error);
      throw error;
    }
  },

  async addTag(documentId: string, tagName: string): Promise<{ success: boolean }> {
    try {
      if (!tagName.trim()) throw new Error("Tag name cannot be empty");
      
      const response = await fetch(`${API_BASE_URL}/v1/reports/${documentId}/tags`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: tagName }),
      });
      return await handleResponse<{ success: boolean }>(response);
    } catch (error) {
      console.error("Service: addTag failed", error);
      throw error;
    }
  },

  async removeTag(documentId: string, tagName: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/reports/${documentId}/tags/${encodeURIComponent(tagName)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return await handleResponse<{ success: boolean }>(response);
    } catch (error) {
      console.error("Service: removeTag failed", error);
      throw error;
    }
  }
};