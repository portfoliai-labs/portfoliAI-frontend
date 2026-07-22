import { StandardTransaction } from "../../models/Report";
import { RawRow } from "./types";
import { BROKER_CONFIGS } from "./config";
import { parseDateValue } from "./dateFormat";

export const identifyBroker = (data: RawRow[]): string => {
  if (!data.length) return "UNKNOWN";

  // Aggregate headers from the first 10 rows — handles files where early rows have empty cells
  const headers = new Set<string>();
  for (const row of data.slice(0, 10)) {
    Object.keys(row).forEach(k => headers.add(k));
  }

  for (const [broker, config] of Object.entries(BROKER_CONFIGS)) {
    const expected = Object.values(config.columns);
    const matchRatio = expected.filter(h => headers.has(h as string)).length / expected.length;
    if (matchRatio > 0.6) return broker;
  }
  return "UNKNOWN";
};

export const standardizeRow = (
  row: RawRow,
  mapping: Partial<Record<keyof StandardTransaction, string>>,
  brokerId: string,
  dateFormat: string,
): StandardTransaction => {
  const getVal = (field: keyof StandardTransaction): unknown => {
    const header = mapping[field];
    return header ? row[header] : undefined;
  };

  const fmt = BROKER_CONFIGS[brokerId]?.formatters || {};

  const optStr = (val: unknown): string | undefined =>
    val !== undefined && val !== null && val !== "" ? String(val) : undefined;

  const fallbackOperation = (val: unknown): StandardTransaction["operation"] => {
    if (!val) return "other";
    const s = String(val).toUpperCase();
    if (s.includes("BUY") || s.includes("ACQUISTO") || s === "A" || s.includes("+")) return "buy";
    if (s.includes("SELL") || s.includes("VENDITA") || s === "S" || s.includes("-")) return "sell";
    if (s.includes("DIV")) return "dividend";
    return "other";
  };

  const isin   = fmt.isin   ? fmt.isin(getVal("isin"), row)     : optStr(getVal("isin"));
  const ticker = fmt.ticker ? fmt.ticker(getVal("ticker"), row) : optStr(getVal("ticker"));

  // A column that isn't mapped comes back as `undefined`, but XLSX/Papa parse a
  // genuinely blank cell in a *mapped* column as `""`, not `undefined` — treat
  // both as "not provided" so a blank quantity/price/amount cell (e.g. a cash
  // dividend row) reads as "not applicable" rather than as the number 0.
  const isBlank = (val: unknown): boolean =>
    val === undefined || val === null || (typeof val === "string" && val.trim() === "");

  // Quantity/price are optional (a cash dividend has neither) — null rather than
  // NaN when blank/unmapped, so validation can tell "not applicable" apart from
  // "mapped but unparseable". A literal 0 is treated the same as blank: neither
  // field is ever legitimately 0 for a real transaction (the backend requires
  // strictly positive quantity/price whenever they're provided), and some
  // spreadsheet exports fill dividend rows with 0 instead of leaving them empty.
  // NaN (garbage input) is left as-is so validation still flags it.
  const parseOptionalNumber = (raw: unknown): number | null => {
    if (isBlank(raw)) return null;
    const n = Number(raw);
    return n === 0 ? null : n;
  };

  const rawQuantity = getVal("quantity");
  const rawPrice = getVal("price");
  const quantity = fmt.quantity ? fmt.quantity(rawQuantity, row) : parseOptionalNumber(rawQuantity);
  const price = fmt.price ? fmt.price(rawPrice, row) : parseOptionalNumber(rawPrice);

  // Amount ("controvalore") comes from its own mapped column when present —
  // needed for a cash dividend, where no quantity/price exists at all — otherwise
  // it's derived from quantity * price so existing quantity+price-only files
  // (buy/sell, or stock dividends) keep working without remapping.
  const rawAmount = getVal("amount");
  const amount = !isBlank(rawAmount)
    ? Number(rawAmount)
    : (quantity !== null && price !== null ? quantity * price : NaN);

  // A broker with its own date formatter always wins (none configured right now — see
  // BROKER_CONFIGS); otherwise fall back to the flexible parser using the format
  // detected/chosen for this file. If that can't parse the value either, keep the raw
  // string so validation still shows the user what was there.
  const rawDate = String(getVal("date") ?? "");
  const parsedDate = fmt.date ? fmt.date(getVal("date"), row) : (parseDateValue(rawDate, dateFormat) || rawDate);

  return {
    // Locally-generated key, never mapped from a CSV column — prefers isin, falls back to ticker.
    id:           isin || ticker || "",
    date:         parsedDate,
    isin,
    ticker,
    operation:    fmt.operation    ? fmt.operation(getVal("operation"), row)    : fallbackOperation(getVal("operation")),
    amount,
    quantity,
    price,
    currency:     fmt.currency     ? fmt.currency(getVal("currency"), row)      : String(getVal("currency") ?? ""),
    fees:         fmt.fees         ? fmt.fees(getVal("fees"), row)              : (() => { const n = Number(getVal("fees")); return isNaN(n) ? 0 : n; })(),
    broker:       fmt.broker       ? fmt.broker(getVal("broker"), row)          : String(getVal("broker") ?? ""),
  } as StandardTransaction;
};
