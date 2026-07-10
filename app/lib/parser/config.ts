import { StandardTransaction } from "../../models/Report";
import { BrokerConfig } from "./types";

export const ALL_FIELDS: (keyof StandardTransaction)[] = [
  "date", "isin", "ticker", "operation", "quantity",
  "price", "currency", "fees", "broker",
];

export const REQUIRED_FIELDS: (keyof StandardTransaction)[] = [
  "date", "operation", "quantity", "price", "currency", "ticker"
];

// No broker-specific configs for now — every file goes through manual column mapping.
export const BROKER_CONFIGS: Record<string, BrokerConfig> = {};
