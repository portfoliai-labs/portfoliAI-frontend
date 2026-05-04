

export interface StandardTransaction {
  date: string;
  name: string;
  id: string;
  ticker: string;
  operation: 'buy' | 'sell' | 'dividend' | 'OTHER';
  amount: number;
  price: number;
  currency: string;
  trade_amount: number;
  fees: number;
  broker: string;
}

interface Report {
  document_id: string;
  name: string;
  createdAt: string; 
  tags: string[];
  url: string
}

export type { Report };