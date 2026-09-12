import "server-only";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Server environment contract — Phase 11.                                     */
/*                                                                              */
/* SPLIT RULE                                                                   */
/*   • src/lib/env.ts  — PUBLIC, client-safe values (NEXT_PUBLIC_*) only.       */
/*   • this module     — SERVER-ONLY secrets. `import "server-only"` makes any  */
/*     accidental import from a Client Component a BUILD ERROR, which is the    */
/*     mechanical guarantee that DATABASE_URL can never reach the browser       */
/*     bundle.                                                                   */
/*                                                                              */
/* Nothing here is ever logged: `describeEnv()` returns booleans/driver names   */
/* only, never a value. Validation is lazy so `next build` (which imports       */
/* modules without a database) does not explode at import time.                 */
/* -------------------------------------------------------------------------- */

const schema = z.object({
  /**
   * Postgres connection string. Optional in local/dev where the PGlite
   * driver is used instead (see server/db/client.ts).
   */
  DATABASE_URL: z.string().min(1).optional(),
  /**
   * "pg"     — real Postgres server (production / staging).
   * "pglite" — embedded Postgres (wasm) for local dev, tests and CI.
   */
  DB_DRIVER: z.enum(["pg", "pglite"]).default("pglite"),
  /** Filesystem path for the PGlite data directory (dev only). */
  PGLITE_DATA_DIR: z.string().default(".data/pglite"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Forces `Secure` cookies off for local http testing; never set in prod. */
  AUTH_INSECURE_COOKIES: z.enum(["0", "1"]).default("0"),
  /**
   * Re-enables the Phase 9 teacher WORKSPACE PICKER as a read-only demo tool.
   * It is NOT authentication and confers no authorization whatsoever: it only
   * decides whether the catalogue-inspection UI is rendered. Forced off in
   * production (see demoWorkspaceEnabled()).
   */
  DEMO_TEACHER_WORKSPACE: z.enum(["0", "1"]).default("0"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached !== null) return cached;
  const parsed = schema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    DB_DRIVER: process.env.DB_DRIVER,
    PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR,
    NODE_ENV: process.env.NODE_ENV,
    AUTH_INSECURE_COOKIES: process.env.AUTH_INSECURE_COOKIES,
    DEMO_TEACHER_WORKSPACE: process.env.DEMO_TEACHER_WORKSPACE,
  });
  if (!parsed.success) {
    // Field NAMES only — never values, so a bad secret cannot be logged.
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid server environment: ${fields}`);
  }
  if (parsed.data.DB_DRIVER === "pg" && !parsed.data.DATABASE_URL) {
    throw new Error("DB_DRIVER=pg requires DATABASE_URL to be set");
  }
  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return serverEnv().NODE_ENV === "production";
}

/** Safe diagnostic summary (no secret values). */
export function describeEnv(): Record<string, string | boolean> {
  const env = serverEnv();
  return {
    driver: env.DB_DRIVER,
    hasDatabaseUrl: env.DATABASE_URL !== undefined,
    nodeEnv: env.NODE_ENV,
  };
}

/**
 * The Phase 9 workspace picker is a demo affordance only. Even if the flag is
 * set, it stays off in production so no deployment can present a "choose who
 * you are" control next to real accounts.
 */
export function demoWorkspaceEnabled(): boolean {
  const env = serverEnv();
  return env.DEMO_TEACHER_WORKSPACE === "1" && env.NODE_ENV !== "production";
}
