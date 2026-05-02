// src/lib/parsers/brokerParser.ts

export interface StandardTransaction {
  date: string;
  name: string;
  id: string;
  ticker: string;
  operation: 'buy' | 'sell' | 'dividend' | 'OTHER';
  amount: number;
  price: number;
  currency: string;
  tradeAmount: number;
  fees: number;
  broker: string;
}

// Represents a raw row from CSV/Excel before processing
export type RawRow = Record<string, unknown>;

export const ALL_FIELDS: (keyof StandardTransaction)[] = [
  "date", "name", "id", "ticker", "operation", "amount", 
  "price", "currency", "tradeAmount", "fees", "broker"
];

export const REQUIRED_FIELDS: (keyof StandardTransaction)[] = [
  "date", "name", "operation", "amount", "price", "currency", "ticker"
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
export const parseNumber = (val: unknown): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  
  const cleanVal = String(val)
    .replace(/\./g, '') // Remove thousands dot
    .replace(',', '.'); // Replace decimal comma with dot
    
  return parseFloat(cleanVal) || 0;
};

export const BROKER_CONFIGS: Record<string, BrokerConfig> = {
  FINECO: {
    columns: {
      date: "Operazione",
      name: "Titolo",
      id: "Isin",
      operation: "Segno",
      amount: "Quantita",
      price: "Prezzo",
      currency: "Divisa",
      tradeAmount: "Controvalore",
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
      fees: (val: unknown): number => Math.abs(parseNumber(val)),
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
      
    name: formatters.name 
      ? formatters.name(getVal('name'), row) 
      : String(getVal('name') ?? ''),
      
    id: formatters.id 
      ? formatters.id(getVal('id'), row) 
      : String(getVal('id') ?? ''),
      
    ticker: formatters.ticker 
      ? formatters.ticker(getVal('ticker'), row) 
      : String(getVal('ticker') ?? ''),
      
    operation: formatters.operation 
      ? formatters.operation(getVal('operation'), row) 
      : fallbackOperationParser(getVal('operation')),
      
    amount: formatters.amount 
      ? formatters.amount(getVal('amount'), row) 
      : Math.abs(parseNumber(getVal('amount'))),
      
    price: formatters.price 
      ? formatters.price(getVal('price'), row) 
      : parseNumber(getVal('price')),
      
    currency: formatters.currency 
      ? formatters.currency(getVal('currency'), row) 
      : String(getVal('currency') ?? ''),
      
    tradeAmount: formatters.tradeAmount 
      ? formatters.tradeAmount(getVal('tradeAmount'), row) 
      : parseNumber(getVal('tradeAmount')),
      
    fees: formatters.fees 
      ? formatters.fees(getVal('fees'), row) 
      : parseNumber(getVal('fees')),

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

/**
 * Validates if the mapping is complete based on REQUIRED_FIELDS.
 */
export const validateMapping = (data: StandardTransaction[]) => {
  if (data.length === 0) return { isValid: false, missingFields: REQUIRED_FIELDS };

  const sample = data[0];
  const missingFields = REQUIRED_FIELDS.filter(field => {
    const val = sample[field];
    return val === undefined || val === null || val === "" || (typeof val === 'number' && isNaN(val));
  });

  return { isValid: missingFields.length === 0, missingFields };
};