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
interface StandardTransaction {
  date: string;
  isin: string;
  ticker: string;
  operation: 'buy' | 'sell' | 'dividend' | 'OTHER';
  quantity: number;
  price: number;
  currency: string;
  fees: number;
  broker: string;
}

export type { Document, DocumentStatus, PresignedUrl, StandardTransaction };
