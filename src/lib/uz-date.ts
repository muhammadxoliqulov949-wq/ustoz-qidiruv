/* -------------------------------------------------------------------------- */
/* Deterministic Uzbek civil dates — Phase 18.                                 */
/*                                                                              */
/* `Intl.DateTimeFormat("uz-UZ")` is NOT deterministic across runtimes: the Node */
/* build used by the server and the Chromium build used by the browser ship       */
/* different ICU data, so the same Date formats to “14 sen 2026” on one side and  */
/* “2026 M09 14” on the other. When that string is rendered inside a client       */
/* island, React reports a hydration mismatch and re-renders the subtree.         */
/*                                                                              */
/* This module formats by hand instead: UTC+5 (Asia/Tashkent has had no DST since */
/* 1992), a fixed Uzbek month table, zero ICU dependency. The server and the      */
/* browser therefore always produce the same string from the same instant.        */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  "yan",
  "fev",
  "mar",
  "apr",
  "may",
  "iyn",
  "iyl",
  "avg",
  "sen",
  "okt",
  "noy",
  "dek",
] as const;

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

interface Parts {
  day: string;
  month: string;
  year: number;
}

function parts(value: Date | number): Parts | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return {
    day: String(shifted.getUTCDate()).padStart(2, "0"),
    month: MONTHS[shifted.getUTCMonth()] ?? "",
    year: shifted.getUTCFullYear(),
  };
}

/** “14 sen 2026” — civil date in Asia/Tashkent, identical on both runtimes. */
export function formatUzDate(value: Date | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const parsed = parts(value);
  return parsed === null ? "—" : `${parsed.day} ${parsed.month} ${parsed.year}`;
}

/** “14 sen 2026, 09:30” — the same instant, with a 24-hour clock. */
export function formatUzDateTime(value: Date | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const date = value instanceof Date ? value : new Date(value);
  const parsed = parts(date);
  if (parsed === null) return "—";
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  const hour = String(shifted.getUTCHours()).padStart(2, "0");
  const minute = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${parsed.day} ${parsed.month} ${parsed.year}, ${hour}:${minute}`;
}
