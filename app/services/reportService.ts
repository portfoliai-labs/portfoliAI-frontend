// services/reportService.ts
import { Report } from "../models/Report"
import { StandardTransaction } from "../models/Report";
import { apiFetch } from "./apiClient";


export const reportService = {
  async getAllDocuments(): Promise<Report[]> {
    return apiFetch<Report[]>("v1/reports")
  },

  async processReport(data: StandardTransaction[], filename: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>("v1/reports/process-report", {
      method: 'POST',
      body: JSON.stringify({ data, filename }),
    })
  },

  async downloadReport(documentId: string): Promise<{ url: string }> {
    return apiFetch<{url: string}>(`v1/reports/${documentId}/download)`)
  },

  async addTag(documentId: string, tagName: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`v1/reports/${documentId}/tags)`, {
      method: 'POST',
      body: JSON.stringify({ name: tagName }),
    })
  },

  async removeTag(documentId: string, tagName: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`v1/reports/${documentId}/tags/${encodeURIComponent(tagName)})`, {
      method: 'DELETE',
      body: JSON.stringify({ name: tagName }),
    })
  }
};