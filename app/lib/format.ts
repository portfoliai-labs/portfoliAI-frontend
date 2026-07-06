export function formatCurrency(value: number, currency: string = "EUR", decimals: number = 2): string {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`.trim();
}
