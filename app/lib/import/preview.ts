import { RawRow } from "./fileParsing";
import { ColumnFieldMapping, ColumnMappingDTO, TransactionTarget } from "../../models/Import";
import { parseDateValue } from "../parser/dateFormat";
import { strftimeToDatefns } from "./fieldDefaults";

// Frontend-local transform used only to render Block C (preview) and Block D (anomalies) live
// as the user edits the mapping. The authoritative transform that actually gets saved runs on
// the backend at commit time — this one never leaves the browser and is never sent anywhere.

export type AnomalyKind =
  | "unparsed-date"
  | "unparsed-number"
  | "unmapped-type"
  | "date-out-of-range"
  | "unexpected-negative"
  | "duplicate"
  | "amount-mismatch";

export interface ParsedPreviewTransaction {
  date: string;
  type: TransactionTarget | null; // null means "not imported"
  ticker?: string;
  isin?: string;
  name?: string;
  quantity?: number;
  price?: number;
  amount?: number;
  fees?: number;
  currency?: string;
  broker?: string;
}

export interface PreviewRow {
  index: number;
  raw: RawRow;
  parsed: ParsedPreviewTransaction | null; // null when the date or amount couldn't be parsed at all
  anomalies: AnomalyKind[];
}

// A field is populated either from a source column or a constant value shared by every row
// (e.g. a file that's entirely EUR maps currency as a constant rather than a column).
function fieldValue(row: RawRow, field: ColumnFieldMapping | undefined): string | undefined {
  if (!field) return undefined;
  if (field.source_column) return row[field.source_column];
  if (field.constant_value != null) return field.constant_value;
  return undefined;
}

function parseLocaleNumber(raw: string | undefined, field: ColumnFieldMapping | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let negative = false;
  let s = trimmed;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[€$£¥%\s]/g, "");

  const thousands = field?.thousands_separator;
  const decimal = field?.decimal_separator ?? ".";
  if (thousands) s = s.split(thousands).join("");
  if (decimal !== ".") s = s.replace(decimal, ".");
  if (s.startsWith("-")) negative = true;

  const n = Number(s);
  if (Number.isNaN(n)) return undefined;
  return negative ? -Math.abs(n) : n;
}

const MIN_PLAUSIBLE_YEAR = 1990;

function isDateOutOfRange(iso: string): boolean {
  const year = Number(iso.slice(0, 4));
  if (!year) return false;
  if (year < MIN_PLAUSIBLE_YEAR) return true;
  return new Date(iso).getTime() > Date.now();
}

const TARGETS: TransactionTarget[] = ["buy", "sell", "dividend"];

export function buildPreviewRow(
  index: number,
  row: RawRow,
  mapping: ColumnMappingDTO,
  valueMap: Record<string, TransactionTarget | null>,
): PreviewRow {
  const anomalies: AnomalyKind[] = [];
  const fields = mapping.fields;

  const dateField = fields.date;
  const rawDate = fieldValue(row, dateField);
  const date = dateField?.date_format && rawDate ? parseDateValue(rawDate, strftimeToDatefns(dateField.date_format)) : "";
  if (!date) anomalies.push("unparsed-date");
  else if (isDateOutOfRange(date)) anomalies.push("date-out-of-range");

  const typeField = fields.type;
  let type: TransactionTarget | null = null;
  if (typeField?.constant_value) {
    type = TARGETS.includes(typeField.constant_value as TransactionTarget) ? (typeField.constant_value as TransactionTarget) : null;
  } else {
    const rawVal = fieldValue(row, typeField);
    type = rawVal !== undefined ? valueMap[rawVal.trim()] ?? null : null;
  }
  if (type === null) anomalies.push("unmapped-type");

  const amountRaw = fieldValue(row, fields.amount);
  const amount = parseLocaleNumber(amountRaw, fields.amount);
  if (amountRaw !== undefined && amountRaw.trim() !== "" && amount === undefined) anomalies.push("unparsed-number");

  const quantity = parseLocaleNumber(fieldValue(row, fields.quantity), fields.quantity);
  const price = parseLocaleNumber(fieldValue(row, fields.price), fields.price);
  const fees = parseLocaleNumber(fieldValue(row, fields.fees), fields.fees);

  if (type === "buy" || type === "sell") {
    if ((quantity ?? 0) < 0 || (price ?? 0) < 0) anomalies.push("unexpected-negative");
  }

  if (quantity !== undefined && price !== undefined && amount !== undefined && amount !== 0) {
    const expected = Math.abs(quantity * price);
    const netAmount = Math.abs(amount) - (fees ?? 0);
    const diffRatio = Math.abs(expected - netAmount) / (expected || 1);
    if (diffRatio > 0.01) anomalies.push("amount-mismatch");
  }

  const parsed: ParsedPreviewTransaction | null =
    date && amount !== undefined
      ? {
          date,
          type,
          ticker: fieldValue(row, fields.ticker) || undefined,
          isin: fieldValue(row, fields.isin) || undefined,
          name: fieldValue(row, fields.name) || undefined,
          quantity,
          price,
          amount,
          fees,
          currency: fieldValue(row, fields.currency) || undefined,
          broker: fieldValue(row, fields.broker) || undefined,
        }
      : null;

  return { index, raw: row, parsed, anomalies };
}

export function buildPreviewRows(
  rows: RawRow[],
  mapping: ColumnMappingDTO,
  valueMap: Record<string, TransactionTarget | null>,
): PreviewRow[] {
  const previewRows = rows.map((row, i) => buildPreviewRow(i, row, mapping, valueMap));

  // Exact-duplicate detection over the raw row content (source-column agnostic).
  const seen = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = JSON.stringify(row);
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(i);
  });
  for (const indexes of seen.values()) {
    if (indexes.length > 1) {
      for (const i of indexes) previewRows[i].anomalies.push("duplicate");
    }
  }

  return previewRows;
}
