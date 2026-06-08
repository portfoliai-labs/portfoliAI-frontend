import { StandardTransaction } from "../../models/Report";

export type RawRow = Record<string, unknown>;

export interface BrokerConfig {
  columns: Partial<Record<keyof StandardTransaction, string>>;
  formatters?: Partial<{
    [K in keyof StandardTransaction]: (rawVal: unknown, fullRow: RawRow) => StandardTransaction[K];
  }>;
}

export interface ValidationError {
  field: string;
  row: number;
  message: string;
}

export interface TransactionValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  errorsByField: Record<string, number>;
  invalidRowCount: number;
}
