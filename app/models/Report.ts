// models/Report.ts

// Matches DocumentStatuses enum from backend
type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'FAILED';

// Matches DocumentResponse DTO (GET /v1/reports/, GET /v1/reports/{id}/download)
interface Document {
  document_id: string;
  user_id: string;
  job_id: string | null;
  generated_by_uuid: string | null;
  name: string;
  size: number;
  status: DocumentStatus;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

// Matches PresignedUrlResponse DTO (GET /v1/reports/{id}/download)
interface PresignedUrl {
  url: string;
}

// Frontend-only shape used while a transaction is being parsed/edited client-side,
// before it is turned into a backend TransactionInput (see models/Transaction.ts) and saved.
// `id` is a locally-generated key (isin, or the ticker), not the backend transaction_uuid.
// At least one of `isin` or `ticker` must be provided.
type StandardTransaction = {
  id: string;
  date: string;
  operation: 'buy' | 'sell' | 'dividend' | 'other';
  quantity: number;
  price: number;
  currency: string;
  fees: number;
  broker: string;
} & (
  | { isin: string; ticker?: string }
  | { isin?: string; ticker: string }
);

export type { Document, DocumentStatus, PresignedUrl, StandardTransaction };
