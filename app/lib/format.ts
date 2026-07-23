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

// Default name for a newly generated report: the client's name for an advisor
// generating on a client's behalf, or just the date/time for a self-generated report.
// Time is included so multiple reports on the same day/for the same client stay distinguishable.
export function buildReportName(clientName?: string | null): string {
  const now = new Date();
  const datePart = now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const timePart = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const prefix = clientName?.trim() || "Report";
  return `${prefix} - ${datePart}, ${timePart}`;
}
