export function formatCurrency(value: number, currency: string = "EUR", decimals: number = 2): string {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`.trim();
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
