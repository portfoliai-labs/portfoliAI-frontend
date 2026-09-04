import { detectDateFormat } from "../parser/dateFormat";

// The backend stores date_format as a Python strftime pattern (e.g. "%d/%m/%Y"); our local
// date-fns-based detector/parser works with date-fns patterns ("dd/MM/yyyy"). These convert
// between the two — order matters ("yyyy" must be replaced before the leftover "yy").
export function datefnsToStrftime(pattern: string): string {
  return pattern.replace(/yyyy/g, "%Y").replace(/yy/g, "%y").replace(/MM/g, "%m").replace(/dd/g, "%d");
}

export function strftimeToDatefns(pattern: string): string {
  return pattern.replace(/%Y/g, "yyyy").replace(/%y/g, "yy").replace(/%m/g, "MM").replace(/%d/g, "dd");
}

// Best-effort default whenever the user (re)points the date field at a column the model
// didn't map — reuses the same detector the manual-mapping flow already relies on. Returns
// the backend's strftime style, ready to store on the field mapping directly.
export function guessDateFormat(values: string[]): string {
  return datefnsToStrftime(detectDateFormat(values).format);
}

export function guessDecimalSeparator(values: string[]): "," | "." {
  const commaDecimals = values.filter((v) => /,\d{1,2}$/.test(v.trim())).length;
  const dotDecimals = values.filter((v) => /\.\d{1,2}$/.test(v.trim())).length;
  return commaDecimals >= dotDecimals ? "," : ".";
}

// A thousands separator is only claimed when values actually show grouping (e.g. "1.234,56")
// — otherwise it's left unset rather than guessed, since misreading a lone decimal point as a
// thousands separator would corrupt every value it touches.
export function guessThousandsSeparator(values: string[], decimalSeparator: "," | "."): "," | "." | null {
  const candidate = decimalSeparator === "," ? "." : ",";
  const groupingRe = new RegExp(`\\d\\${candidate}\\d{3}(?:\\D|$)`);
  return values.some((v) => groupingRe.test(v.trim())) ? candidate : null;
}
