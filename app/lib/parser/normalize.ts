import { StandardTransaction } from "../../models/Report";
import { RawRow } from "./types";
import { BROKER_CONFIGS } from "./config";

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

  return {
    id:           fmt.id           ? fmt.id(getVal("id"), row)                 : optStr(getVal("id")),
    date:         fmt.date         ? fmt.date(getVal("date"), row)              : String(getVal("date") ?? ""),
    isin:         fmt.isin         ? fmt.isin(getVal("isin"), row)              : optStr(getVal("isin")),
    ticker:       fmt.ticker       ? fmt.ticker(getVal("ticker"), row)          : optStr(getVal("ticker")),
    exchange_mic: fmt.exchange_mic ? fmt.exchange_mic(getVal("exchange_mic"), row) : optStr(getVal("exchange_mic")),
    operation:    fmt.operation    ? fmt.operation(getVal("operation"), row)    : fallbackOperation(getVal("operation")),
    quantity:     fmt.quantity     ? fmt.quantity(getVal("quantity"), row)      : Number(getVal("quantity")),
    price:        fmt.price        ? fmt.price(getVal("price"), row)            : Number(getVal("price")),
    currency:     fmt.currency     ? fmt.currency(getVal("currency"), row)      : String(getVal("currency") ?? ""),
    fees:         fmt.fees         ? fmt.fees(getVal("fees"), row)              : (() => { const n = Number(getVal("fees")); return isNaN(n) ? 0 : n; })(),
    broker:       fmt.broker       ? fmt.broker(getVal("broker"), row)          : String(getVal("broker") ?? ""),
  } as StandardTransaction;
};
