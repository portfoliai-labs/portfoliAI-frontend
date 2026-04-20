// services/reportService.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Helper function to handle fetch responses and throw meaningful errors
 */
async function handleResponse(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export const reportService = {
  async getAllDocuments() {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/reports/`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await handleResponse(response);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Service: getAllDocuments failed", error);
      throw error;
    }
  },

  async processReport(data: any[], filename: string) {
    try {
      if (!data || data.length === 0) throw new Error("No data provided for analysis");
      
      const response = await fetch(`${API_BASE_URL}/v1/reports/process-report`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data, filename }),
      });
      return await handleResponse(response);
    } catch (error) {
      console.error("Service: processReport failed", error);
      throw error;
    }
  },

  async addTag(documentId: string, tagName: string) {
    try {
      if (!tagName.trim()) throw new Error("Tag name cannot be empty");
      
      const response = await fetch(`${API_BASE_URL}/v1/reports/${documentId}/tags`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: tagName }),
      });
      return await handleResponse(response);
    } catch (error) {
      console.error("Service: addTag failed", error);
      throw error;
    }
  },

  async removeTag(documentId: string, tagName: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/reports/${documentId}/tags/${encodeURIComponent(tagName)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return await handleResponse(response);
    } catch (error) {
      console.error("Service: removeTag failed", error);
      throw error;
    }
  }
};