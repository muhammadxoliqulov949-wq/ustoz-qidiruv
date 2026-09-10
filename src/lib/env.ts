/**
 * Placeholder environment config — Phase 1.
 *
 * Every external integration (API base URL, auth endpoints, image domains)
 * must be read through this module so routes and components never touch
 * `process.env` directly. In Phase 2 this becomes server-validated env
 * parsing; the access pattern stays identical.
 */
export const env = {
  appName: "USTOZ",
  /** Populated when the marketplace API is wired up (Phase 2+). */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
} as const;
