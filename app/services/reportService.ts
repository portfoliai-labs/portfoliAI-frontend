// services/reportService.ts
import type { Document, PresignedUrl } from "../models/Report";
import { apiFetch } from "./apiClient";

export const reportService = {
  // GET /v1/portfolios/{p}/reports
  async getAllDocuments(portfolioUuid: string): Promise<Document[]> {
    return apiFetch<Document[]>(`/v1/portfolios/${portfolioUuid}/reports`);
  },

  async downloadReport(portfolioUuid: string, documentId: string): Promise<PresignedUrl> {
    return apiFetch<PresignedUrl>(`/v1/portfolios/${portfolioUuid}/reports/${documentId}/download`);
  },

  async addTag(portfolioUuid: string, documentId: string, tagName: string): Promise<void> {
    return apiFetch<void>(`/v1/portfolios/${portfolioUuid}/reports/${documentId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name: tagName }),
    });
  },

  async removeTag(portfolioUuid: string, documentId: string, tagName: string): Promise<void> {
    return apiFetch<void>(`/v1/portfolios/${portfolioUuid}/reports/${documentId}/tags/${encodeURIComponent(tagName)}`, {
      method: 'DELETE',
    });
  },
};
