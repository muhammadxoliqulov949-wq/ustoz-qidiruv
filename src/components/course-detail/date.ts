/** Uzbek long-date formatting for data-layer ISO "YYYY-MM-DD" strings. */
const MONTHS_UZ = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

/** "2026-10-05" → "5-oktabr" (year appended only when not this year). */
export function formatDateUz(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const label = `${day}-${MONTHS_UZ[month - 1]}`;
  const currentYear = new Date().getFullYear();
  return year === currentYear ? label : `${label}, ${year}`;
}
