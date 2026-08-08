import { StandardTransaction } from "../../models/Report";
import { BrokerConfig } from "./types";

export const ALL_FIELDS: (keyof StandardTransaction)[] = [
  "date", "isin", "ticker", "operation", "amount", "quantity",
  "price", "currency", "fees", "broker",
];

// quantity/price are no longer universally required — they're only mandatory for
// buy/sell (enforced per-row by validateTransactions), since a dividend can be
// paid in cash (amount only) or in shares (amount + quantity + price).
// ticker is always required — the backend has no ticker-from-ISIN resolver, so
// an isin-only row can't be turned into a valid transaction (see FileUploader's
// toTransactionInput). isin is optional and only ever supplements the ticker.
export const REQUIRED_FIELDS: (keyof StandardTransaction)[] = [
  "date", "operation", "amount", "currency", "ticker"
];

// No broker-specific configs for now — every file goes through manual column mapping.
export const BROKER_CONFIGS: Record<string, BrokerConfig> = {};
