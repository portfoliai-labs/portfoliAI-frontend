import { StandardTransaction } from "../../models/Report";
import { ValidationError, TransactionValidationResult } from "./types";
import { REQUIRED_FIELDS } from "./config";

// --- Private helpers ---

const hasTimeComponent = (date: string): boolean =>
  /T\d{2}:\d{2}/.test(date) || /\s\d{2}:\d{2}/.test(date);

// --- Regex constants ---

// Date-only, or a datetime with an optional seconds/fractional-seconds/timezone suffix
const ISO_DATE_RE   = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const CURRENCY_RE   = /^[A-Z]{3}$/;
const MIC_RE        = /^[A-Z]{4}$/;
const ISIN_RE       = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const TICKER_RE     = /^[A-Z0-9.\-]{1,20}$/i;
const VALID_OPS     = new Set<string>(["buy", "sell", "dividend"]);

// --- Public validators ---

/**
 * Checks that all required fields are mapped and that at least one of isin/ticker
 * is present. Also detects missing time components and exchange_mic.
 */
export const validateMapping = (data: StandardTransaction[]) => {
  if (data.length === 0) return {
    isValid: false,
    missingFields: [...REQUIRED_FIELDS.map(String), "isin or ticker"],
    hasOrdersWithoutTime: false,
    hasMissingExchangeMic: false,
  };

  const missingFields: string[] = REQUIRED_FIELDS.filter(field =>
    data.some(row => {
      const val = row[field as keyof StandardTransaction];
      return val === undefined || val === null || val === "" || (typeof val === "number" && isNaN(val));
    })
  ).map(String);

  if (data.some(row => !row.isin && !row.ticker))
    missingFields.push("isin or ticker");

  const hasOrdersWithoutTime = data.some(
    row => row.date && row.date !== "" && !hasTimeComponent(row.date),
  );

  const hasMissingExchangeMic = data.some(row => !row.exchange_mic);

  return { isValid: missingFields.length === 0, missingFields, hasOrdersWithoutTime, hasMissingExchangeMic };
};

/**
 * Validates the actual values of each transaction row against domain rules.
 * Returns a structured result with per-field error counts and invalid row count.
 */
export const validateTransactions = (data: StandardTransaction[]): TransactionValidationResult => {
  const errors: ValidationError[] = [];

  data.forEach((row, i) => {
    if (!row.date || !ISO_DATE_RE.test(row.date))
      errors.push({ field: "date", row: i, message: "Must be ISO format YYYY-MM-DD, optionally with a time (YYYY-MM-DDTHH:mm)" });

    if (row.isin && !ISIN_RE.test(row.isin))
      errors.push({ field: "isin", row: i, message: `Invalid ISIN format: "${row.isin}"` });

    if (row.ticker && !TICKER_RE.test(row.ticker))
      errors.push({ field: "ticker", row: i, message: `Invalid ticker format: "${row.ticker}"` });

    if (row.exchange_mic && !MIC_RE.test(row.exchange_mic))
      errors.push({ field: "exchange_mic", row: i, message: "MIC must be 4 uppercase letters (e.g. XMIL, XNYS)" });

    if (!VALID_OPS.has(row.operation))
      errors.push({ field: "operation", row: i, message: 'Must be "buy", "sell", or "dividend"' });

    if (typeof row.quantity !== "number" || isNaN(row.quantity) || row.quantity <= 0)
      errors.push({ field: "quantity", row: i, message: "Must be a positive number" });

    if (typeof row.price !== "number" || isNaN(row.price) || row.price < 0)
      errors.push({ field: "price", row: i, message: "Must be a positive number" });

    if (!row.currency || !CURRENCY_RE.test(row.currency))
      errors.push({ field: "currency", row: i, message: "Must be a 3-letter ISO code (e.g. EUR, USD)" });

    if (typeof row.fees !== "number" || isNaN(row.fees) || row.fees < 0)
      errors.push({ field: "fees", row: i, message: "Must be a non-negative number (defaults to 0 if absent)" });
  });

  const errorsByField: Record<string, number> = {};
  const rowsWithErrors = new Set<number>();
  for (const err of errors) {
    errorsByField[err.field] = (errorsByField[err.field] || 0) + 1;
    rowsWithErrors.add(err.row);
  }

  return { isValid: errors.length === 0, errors, errorsByField, invalidRowCount: rowsWithErrors.size };
};
