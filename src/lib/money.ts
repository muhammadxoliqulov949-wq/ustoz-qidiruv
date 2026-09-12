/* -------------------------------------------------------------------------- */
/* Money — Phase 14. Pure, integer-only, no dependencies.                      */
/*                                                                              */
/* WHY THIS FILE EXISTS                                                         */
/* Two different units meet in this product:                                    */
/*   • the marketplace prices courses in whole UZS so'm (`courses.price_uzs`);  */
/*   • the Payme Merchant API works exclusively in TIYIN (1 so'm = 100 tiyin).  */
/*                                                                              */
/* Mixing them silently is how payment systems charge 100x or 1/100th of the    */
/* real price, so every crossing of that boundary goes through a named function */
/* here and nowhere else.                                                        */
/*                                                                              */
/* RULES                                                                        */
/*   • No floating point, ever. `number` is used only where the value is        */
/*     provably a safe integer; tiyin amounts are `bigint`.                     */
/*   • Every conversion validates its input and throws on nonsense rather than  */
/*     returning NaN, which would otherwise be written to the database.          */
/*                                                                              */
/* WHY bigint FOR TIYIN                                                         */
/* `courses.price_uzs` is a Postgres `integer` capped at 100_000_000 so'm. In   */
/* tiyin that is 10_000_000_000 — an order of magnitude beyond int32's          */
/* 2_147_483_647. The database column is therefore `bigint`, and this module    */
/* speaks `bigint` so the overflow cannot be reintroduced by an intermediate    */
/* JS number.                                                                    */
/* -------------------------------------------------------------------------- */

/*
 * Tiyin per so'm. Fixed by the currency, not a configuration value.
 *
 * Written as `BigInt(100)` rather than the `100n` literal because the project
 * targets ES2017; bumping the whole app's compile target for one constant
 * would be a far broader change than this phase warrants.
 */
export const TIYIN_PER_SOM = BigInt(100);

/** The only currency this product handles. */
export const SUPPORTED_CURRENCY = "UZS" as const;
export type Currency = typeof SUPPORTED_CURRENCY;

/**
 * Largest price the schema permits, in so'm (`courses_price_check`). Mirrored
 * here so a conversion cannot quietly produce an amount the database will
 * reject at insert time.
 */
export const MAX_PRICE_SOM = 100_000_000;

/** Same bound expressed in tiyin. */
export const MAX_AMOUNT_TIYIN = BigInt(MAX_PRICE_SOM) * TIYIN_PER_SOM;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} exceeds the safe integer range`);
  }
}

/**
 * Course price (whole so'm) → payment amount (tiyin).
 *
 * Rejects negatives and anything above the schema's price ceiling, so an
 * impossible amount can never reach the provider or the database.
 */
export function somToTiyin(som: number): bigint {
  assertSafeInteger(som, "Price in so'm");
  if (som < 0) throw new MoneyError("Price in so'm cannot be negative");
  if (som > MAX_PRICE_SOM) throw new MoneyError("Price in so'm exceeds the maximum");
  return BigInt(som) * TIYIN_PER_SOM;
}

/**
 * Tiyin → whole so'm. Exact only when the amount is a whole number of so'm,
 * which every amount this product creates is; a fractional amount is a bug
 * somewhere upstream and is reported rather than rounded away.
 */
export function tiyinToSom(tiyin: bigint): number {
  if (tiyin < BigInt(0)) throw new MoneyError("Amount in tiyin cannot be negative");
  if (tiyin % TIYIN_PER_SOM !== BigInt(0)) {
    throw new MoneyError("Amount in tiyin is not a whole number of so'm");
  }
  const som = tiyin / TIYIN_PER_SOM;
  if (som > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MoneyError("Amount in tiyin exceeds the safe integer range");
  }
  return Number(som);
}

/**
 * Parse an amount that arrived from the provider over JSON-RPC.
 *
 * Payme sends `amount` as a JSON number in tiyin. JSON numbers are IEEE-754
 * doubles, so this rejects anything non-integral or outside the safe range
 * instead of trusting it. Returns `null` on bad input — the caller maps that
 * to the provider's "wrong amount" error rather than throwing.
 */
export function parseProviderAmount(value: unknown): bigint | null {
  if (typeof value !== "number") return null;
  if (!Number.isInteger(value) || !Number.isSafeInteger(value)) return null;
  if (value < 0) return null;
  const tiyin = BigInt(value);
  if (tiyin > MAX_AMOUNT_TIYIN) return null;
  return tiyin;
}

/**
 * Tiyin → a JSON-RPC-safe number for provider responses.
 *
 * Every amount we produce is bounded by MAX_AMOUNT_TIYIN (10^10), comfortably
 * inside the safe integer range, so this is lossless for real data.
 */
export function tiyinToProviderAmount(tiyin: bigint): number {
  if (tiyin < BigInt(0)) throw new MoneyError("Amount in tiyin cannot be negative");
  if (tiyin > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MoneyError("Amount in tiyin exceeds the safe integer range");
  }
  return Number(tiyin);
}

/** A course is free when its price is exactly zero. Free never means "unknown". */
export function isFreePriceSom(som: number): boolean {
  assertSafeInteger(som, "Price in so'm");
  return som === 0;
}

/**
 * Human-readable so'm for the UI, e.g. `150 000 so'm`. Uses a non-breaking
 * space between the number and the unit so the amount never wraps mid-value.
 */
export function formatSom(som: number): string {
  assertSafeInteger(som, "Price in so'm");
  return `${som.toLocaleString("ru-RU").replace(/\u00A0/g, " ")}\u00A0so'm`;
}

/** Human-readable amount for a stored tiyin value. */
export function formatTiyin(tiyin: bigint): string {
  return formatSom(tiyinToSom(tiyin));
}
