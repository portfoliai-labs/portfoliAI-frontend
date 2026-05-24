// src/lib/parsers/brokerParser.ts
import { StandardTransaction } from "../../models/Report";


// Represents a raw row from CSV/Excel before processing
export type RawRow = Record<string, unknown>;

export const ALL_FIELDS: (keyof StandardTransaction)[] = [
  "date", "isin", "ticker", "operation", "quantity", 
  "price", "currency", "fees", "broker"
];

export const REQUIRED_FIELDS: (keyof StandardTransaction)[] = [
  "date", "operation", "quantity", "price", "currency", "ticker"
];

/**
 * Interface defining a broker's configuration.
 * - 'columns': Maps Standard Fields to default CSV Headers.
 * - 'formatters': Generalized functions to parse ANY specific field.
 */
export interface BrokerConfig {
  columns: Partial<Record<keyof StandardTransaction, string>>;
  formatters?: Partial<{
    [K in keyof StandardTransaction]: (rawVal: unknown, fullRow: RawRow) => StandardTransaction[K];
  }>;
}

/**
 * Helper to parse European/Italian formatted numbers into valid floats.
 */
/*export const parseNumber = (val: unknown): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  
  const cleanVal = String(val)
    .replace(/\./g, '') // Remove thousands dot
    .replace(',', '.'); // Replace decimal comma with dot
    
  return parseFloat(cleanVal) || 0;
};*/

export const BROKER_CONFIGS: Record<string, BrokerConfig> = {
  FINECO: {
    columns: {
      date: "Operazione",
      isin: "Isin",
      operation: "Segno",
      quantity: "Quantita",
      price: "Prezzo",
      currency: "Divisa",
      fees: "Commissioni amministrato",
    },
    formatters: {
      operation: (val: unknown): StandardTransaction['operation'] => {
        if (!val) return 'OTHER';
        const str = String(val).toUpperCase();
        if (str === 'A') return 'buy';
        if (str === 'S') return 'sell';
        return 'dividend';
      },
      fees: (val: unknown): number => Math.abs(Number(val)),
      broker: (): string => "Fineco"
    }
  }
};

/**
 * Normalizes a raw row using the UI mapping AND the broker-specific formatters.
 */
export const standardizeRow = (
  row: RawRow, 
  mapping: Partial<Record<keyof StandardTransaction, string>>,
  brokerId: string
): StandardTransaction => {
  
  // Helper to extract the raw value from the row based on the current UI mapping
  const getVal = (field: keyof StandardTransaction): unknown => {
    const csvHeader = mapping[field];
    return csvHeader ? row[csvHeader] : undefined;
  };

  const formatters = BROKER_CONFIGS[brokerId]?.formatters || {};

  const fallbackOperationParser = (val: unknown): StandardTransaction['operation'] => {
    if (!val) return 'OTHER';
    const str = String(val).toUpperCase();
    if (str.includes('BUY') || str.includes('ACQUISTO') || str === 'A' || str.includes('+')) return 'buy';
    if (str.includes('SELL') || str.includes('VENDITA') || str === 'S' || str.includes('-')) return 'sell';
    if (str.includes('DIV')) return 'dividend';
    return 'OTHER';
  };

  // Build the object field by field to ensure type safety
  return {
    date: formatters.date 
      ? formatters.date(getVal('date'), row) 
      : String(getVal('date') ?? ''),
      
    isin: formatters.isin 
      ? formatters.isin(getVal('isin'), row) 
      : String(getVal('isin') ?? ''),
      
    ticker: formatters.ticker 
      ? formatters.ticker(getVal('ticker'), row) 
      : String(getVal('ticker') ?? ''),
      
    operation: formatters.operation 
      ? formatters.operation(getVal('operation'), row) 
      : fallbackOperationParser(getVal('operation')),
      
    quantity: formatters.quantity 
      ? formatters.quantity(getVal('quantity'), row) 
      : Number(getVal('quantity')),
      
    price: formatters.price 
      ? formatters.price(getVal('price'), row) 
      : Number(getVal('price')),
      
    currency: formatters.currency 
      ? formatters.currency(getVal('currency'), row) 
      : String(getVal('currency') ?? ''),
      
    fees: formatters.fees 
      ? formatters.fees(getVal('fees'), row) 
      : Number(getVal('fees')),

    broker: formatters.broker
      ? formatters.broker(getVal('broker'), row)
      : String(getVal('broker') ?? '')
  };
};

/**
 * Identifies the broker by matching CSV headers.
 */
export const identifyBroker = (firstRow: RawRow | undefined): string => {
  if (!firstRow) return "UNKNOWN";
  const headers = Object.keys(firstRow);
  
  for (const [broker, config] of Object.entries(BROKER_CONFIGS)) {
    const expectedHeaders = Object.values(config.columns);
    const matchCount = expectedHeaders.filter(h => headers.includes(h as string)).length;
    
    if (matchCount / expectedHeaders.length > 0.6) {
      return broker;
    }
  }
  return "UNKNOWN";
};

const hasTimeComponent = (date: string): boolean =>
  /T\d{2}:\d{2}/.test(date) || /\s\d{2}:\d{2}/.test(date);

/**
 * Validates if the mapping is complete based on REQUIRED_FIELDS.
 * Checks all rows (not just the first) for missing required fields.
 * Also detects orders that have a date but no time component.
 */
export const validateMapping = (data: StandardTransaction[]) => {
  if (data.length === 0) return { isValid: false, missingFields: REQUIRED_FIELDS, hasOrdersWithoutTime: false };

  const missingFields = REQUIRED_FIELDS.filter(field =>
    data.some(row => {
      const val = row[field];
      return val === undefined || val === null || val === "" || (typeof val === 'number' && isNaN(val));
    })
  );

  const hasOrdersWithoutTime = data.some(
    row => row.date && row.date !== "" && !hasTimeComponent(row.date)
  );

  return { isValid: missingFields.length === 0, missingFields, hasOrdersWithoutTime };
};