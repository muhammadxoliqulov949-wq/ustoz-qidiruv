/**
 * Display formatters — SSR-deterministic (no Intl locale dependencies,
 * which can differ between Node ICU builds and browsers → hydration noise).
 * Groups use non-breaking spaces, matching Uzbek typographic convention.
 */

const NBSP = "\u00A0";

/** 1260 → “1 260” */
export function formatCount(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 4.9 → “4.9” (one decimal) */
export function formatRating(value: number): string {
  return value.toFixed(1);
}

/** Monthly UZS price; 0 renders as “Bepul”. */
export function formatPrice(priceUzs: number): string {
  if (priceUzs <= 0) return "Bepul";
  return `${formatCount(priceUzs)} so'm`;
}
