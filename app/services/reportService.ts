// services/reportService.ts
import type { Document, PresignedUrl, StandardTransaction } from "../models/Report";
import { apiFetch } from "./apiClient";

export const reportService = {
  async getAllDocuments(): Promise<Document[]> {
    return apiFetch<Document[]>('/v1/reports/');
  },

  async processReport(data: StandardTransaction[], filename: string): Promise<void> {
    return apiFetch<void>('/v1/reports/process-report', {
      method: 'POST',
      body: JSON.stringify({ data, filename }),
    });
  },

  async downloadReport(documentId: string): Promise<PresignedUrl> {
    return apiFetch<PresignedUrl>(`/v1/reports/${documentId}/download`);
  },

  async addTag(documentId: string, tagName: string): Promise<void> {
    return apiFetch<void>(`/v1/reports/${documentId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name: tagName }),
    });
  },

  async removeTag(documentId: string, tagName: string): Promise<void> {
    return apiFetch<void>(`/v1/reports/${documentId}/tags/${encodeURIComponent(tagName)}`, {
      method: 'DELETE',
    });
  },
};
