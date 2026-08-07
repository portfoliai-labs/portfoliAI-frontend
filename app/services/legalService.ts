// services/legalService.ts
import type { LegalDocument, LegalAcceptanceItem, UserLegalAcceptance } from "../models/Legal";
import { apiFetch } from "./apiClient";

export const legalService = {
  // GET /legal/documents — public, currently-active legal documents (no auth required)
  async getActiveDocuments(): Promise<LegalDocument[]> {
    return apiFetch<LegalDocument[]>('/legal/documents');
  },

  // GET /legal/pending — documents the authenticated user still needs to accept
  async getPendingDocuments(): Promise<LegalDocument[]> {
    return apiFetch<LegalDocument[]>('/legal/pending');
  },

  // POST /legal/acceptances — records the user's acceptance of the given document versions
  async acceptDocuments(items: LegalAcceptanceItem[]): Promise<UserLegalAcceptance[]> {
    return apiFetch<UserLegalAcceptance[]>('/legal/acceptances', {
      method: 'POST',
      body: JSON.stringify({ documents: items }),
    });
  },
};
