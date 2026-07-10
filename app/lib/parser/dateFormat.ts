import { parse, format, isValid } from "date-fns";

// Candidate date patterns tried (in order) when a broker has no dedicated date formatter.
// Order matters for the tie-break in detectDateFormat: dd/MM/yyyy comes before MM/dd/yyyy
// since the app's primary market (Fineco) is day-first.
export const DATE_FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: "yyyy-MM-dd", label: "YYYY-MM-DD" },
  { value: "dd/MM/yyyy", label: "DD/MM/YYYY" },
  { value: "MM/dd/yyyy", label: "MM/DD/YYYY" },
  { value: "dd-MM-yyyy", label: "DD-MM-YYYY" },
  { value: "dd.MM.yyyy", label: "DD.MM.YYYY" },
];

const CANDIDATE_FORMATS = DATE_FORMAT_OPTIONS.map(o => o.value);

// Pulls an optional trailing "HH:mm" or "HH:mm:ss" off the raw value, whether it's separated
// by "T" (ISO-style) or a plain space (most spreadsheet exports) — the date part is parsed
// against the chosen pattern, the time part is carried through untouched.
function splitDateTime(raw: string): { datePart: string; timePart: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*?)[T\s]+(\d{1,2}:\d{2}(?::\d{2})?)$/);
  if (match) return { datePart: match[1].trim(), timePart: match[2] };
  return { datePart: trimmed, timePart: "" };
}

/**
 * Parses `raw` against a specific date-fns pattern (e.g. "dd/MM/yyyy") and returns the
 * backend-expected "yyyy-MM-dd" (optionally "yyyy-MM-ddTHH:mm[:ss]") string, or "" if the
 * value doesn't match that pattern at all.
 */
export function parseDateValue(raw: string | undefined | null, pattern: string): string {
  if (!raw) return "";
  const { datePart, timePart } = splitDateTime(String(raw));
  if (!datePart) return "";

  const parsed = parse(datePart, pattern, new Date());
  if (!isValid(parsed)) return "";

  const iso = format(parsed, "yyyy-MM-dd");
  return timePart ? `${iso}T${timePart}` : iso;
}

/**
 * Guesses which of CANDIDATE_FORMATS the raw date column of a file is written in, by trying
 * each pattern against every non-empty value and keeping the one(s) that parse them all.
 * - Exactly one candidate parses everything → confident match, not ambiguous.
 * - More than one candidate parses everything (e.g. every day happens to be <= 12, so
 *   dd/MM/yyyy and MM/dd/yyyy both "work" but disagree) → genuinely ambiguous, the caller
 *   should let the user confirm/override.
 * - None parse everything → best-effort guess (whichever parses the most values), also
 *   surfaced as ambiguous so the user can pick the right one.
 */
export function detectDateFormat(rawValues: (string | undefined | null)[]): { format: string; ambiguous: boolean } {
  const values = rawValues.map(v => (v ?? "").toString().trim()).filter(Boolean);
  if (values.length === 0) return { format: CANDIDATE_FORMATS[0], ambiguous: false };

  const fullMatches = CANDIDATE_FORMATS.filter(fmt => values.every(v => parseDateValue(v, fmt) !== ""));

  if (fullMatches.length === 1) return { format: fullMatches[0], ambiguous: false };
  if (fullMatches.length > 1) return { format: fullMatches[0], ambiguous: true };

  const scored = CANDIDATE_FORMATS
    .map(fmt => ({ fmt, score: values.filter(v => parseDateValue(v, fmt) !== "").length }))
    .sort((a, b) => b.score - a.score);
  return { format: scored[0].fmt, ambiguous: true };
}
