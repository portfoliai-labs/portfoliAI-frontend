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

// Matches ReportPayload DTO (POST /v1/reports/process-report)
// At least one of `isin` or `ticker` must be provided.
// If `exchange_mic` is omitted, warn the user: the ticker from the first available
// exchange will be used, which may cause unexpected spread.
type StandardTransaction = {
  id: string;
  date: string;
  operation: 'buy' | 'sell' | 'dividend' | 'OTHER';
  quantity: number;
  price: number;
  currency: string;
  fees: number;
  broker: string;
  exchange_mic?: string;
} & (
  | { isin: string; ticker?: string }
  | { isin?: string; ticker: string }
);

export type { Document, DocumentStatus, PresignedUrl, StandardTransaction };
