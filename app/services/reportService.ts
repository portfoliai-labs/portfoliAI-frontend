// services/reportService.ts
import type { Document, PresignedUrl } from "../models/Report";
import { apiFetch } from "./apiClient";

export const reportService = {
  // GET /v1/reports/?for_user_uuid=... — advisors pass client UUID to fetch their documents
  async getAllDocuments(forUserUuid?: string | null): Promise<Document[]> {
    const query = forUserUuid ? `?for_user_uuid=${encodeURIComponent(forUserUuid)}` : '';
    return apiFetch<Document[]>(`/v1/reports/${query}`);
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
