import { StandardTransaction } from "../../models/Report";
import { BrokerConfig } from "./types";

export const ALL_FIELDS: (keyof StandardTransaction)[] = [
  "date", "isin", "ticker", "operation", "amount", "quantity",
  "price", "currency", "fees", "broker",
];

// quantity/price are no longer universally required — they're only mandatory for
// buy/sell (enforced per-row by validateTransactions), since a dividend can be
// paid in cash (amount only) or in shares (amount + quantity + price).
export const REQUIRED_FIELDS: (keyof StandardTransaction)[] = [
  "date", "operation", "amount", "currency", "ticker"
];

// No broker-specific configs for now — every file goes through manual column mapping.
export const BROKER_CONFIGS: Record<string, BrokerConfig> = {};
