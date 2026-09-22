export function formatCurrency(value: number, currency: string = "EUR", decimals: number = 2): string {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`.trim();
}

// Quantities come from the backend as arbitrary-precision decimal strings (e.g. "0.001710320000000000"),
// often zero-padded to a fixed number of decimals. Trims insignificant trailing zeros for display via
// plain string manipulation — never via Number() — so precision beyond what a JS double can hold
// (the whole reason quantity is a string) isn't lost in the process.
export function formatQuantity(value: string | number): string {
  const s = typeof value === "number" ? value.toString() : value;
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}
