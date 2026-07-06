import { StandardTransaction } from "../../models/Report";
import { TransactionValidationResult } from "../../lib/parser";

export interface UploadedFileState {
  id: string;
  fileName: string;
  rawData: Record<string, unknown>[];
  previewData: StandardTransaction[];
  manualMap: Partial<Record<keyof StandardTransaction, string>>;
  detectedBroker: string;
  isValid: boolean;
  missingFields: string[];
  hasOrdersWithoutTime: boolean;
  hasMissingExchangeMic: boolean;
  validationErrors: TransactionValidationResult;
  confirmed: boolean;
}
