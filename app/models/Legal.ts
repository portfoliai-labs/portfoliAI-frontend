// models/Legal.ts
// Aligned with backend DTOs in app/api/dto/routes_legal.py

// Matches LegalDocumentResponse DTO (GET /legal/documents, GET /legal/pending)
interface LegalDocument {
  code: string;
  version: string;
  url: string;
  published_at: string;
}

// Matches LegalAcceptanceItem DTO (nested in POST /legal/acceptances request)
interface LegalAcceptanceItem {
  code: string;
  version: string;
}

// Matches UserLegalAcceptanceResponse DTO (POST /legal/acceptances response)
interface UserLegalAcceptance {
  code: string;
  version: string;
  accepted_at: string;
}

export type { LegalDocument, LegalAcceptanceItem, UserLegalAcceptance };
