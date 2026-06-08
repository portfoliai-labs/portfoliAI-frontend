import { StandardTransaction } from "../../models/Report";
import { parse, format } from "date-fns";
import { BrokerConfig } from "./types";

export const ALL_FIELDS: (keyof StandardTransaction)[] = [
  "id", "date", "isin", "ticker", "exchange_mic", "operation", "quantity",
  "price", "currency", "fees", "broker",
];

export const REQUIRED_FIELDS: (keyof StandardTransaction)[] = [
  "id", "date", "operation", "quantity", "price", "currency",
];

export const BROKER_CONFIGS: Record<string, BrokerConfig> = {
  FINECO: {
    columns: {
      id: "Isin",
      date: "Operazione",
      isin: "Isin",
      operation: "Segno",
      quantity: "Quantita",
      price: "Prezzo",
      currency: "Divisa",
      fees: "Commissioni amministrato",
    },
    formatters: {
      date: (val: unknown): string => {
        if (typeof val !== "string") return "";
        try {
          return format(parse(val.trim(), "dd/MM/yyyy", new Date()), "yyyy-MM-dd");
        } catch {
          return "";
        }
      },
      operation: (val: unknown): StandardTransaction["operation"] => {
        if (!val) return "OTHER";
        const s = String(val).toUpperCase();
        if (s === "A") return "buy";
        if (s === "S") return "sell";
        return "dividend";
      },
      fees: (val: unknown): number => {
        const n = Number(val);
        return isNaN(n) ? 0 : Math.abs(n);
      },
      broker: (): string => "Fineco",
    },
  },
};
