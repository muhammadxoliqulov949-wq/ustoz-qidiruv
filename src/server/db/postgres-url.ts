import "server-only";
import { DatabaseConfigError } from "./errors";

/* -------------------------------------------------------------------------- */
/* PostgreSQL connection-string policy — Phase 22.                              */
/*                                                                              */
/* PURE: no I/O, no logging, no secret values in errors — safe to unit-test.    */
/* Used by BOTH the request-time pool (`db/client.ts`) and the operator CLI     */
/* (`scripts/db.ts`), so every `pg` connection in this project gets identical   */
/* TLS semantics.                                                               */
/*                                                                              */
/* THE SSL WARNING, RESOLVED. `pg-connection-string` (used by `pg` ≥ 8.13)      */
/* emits a `SECURITY WARNING` whenever the URL carries `sslmode=require` (or    */
/* `prefer` / `verify-ca`): those modes are currently treated as aliases of     */
/* `verify-full`, but pg v9 will switch them to weaker libpq semantics. The     */
/* warning's own advice — and this module's rule — is to say `verify-full`      */
/* explicitly. Neon presents a publicly-trusted certificate whose hostname      */
/* matches the connection host, and Node verifies it against the default CA     */
/* store, so the rewrite changes NOTHING about today's behaviour (`require`     */
/* already verifies fully in pg v8): it pins the semantics and silences the     */
/* warning by being explicit rather than by being lax.                          */
/*                                                                              */
/* PRODUCTION RULES (fail loud, never weaken):                                  */
/*   • missing `sslmode` → error: an unencrypted production database            */
/*     connection must be impossible, not merely unlikely;                      */
/*   • `sslmode=disable` → error;                                               */
/*   • `require` / `prefer` / `verify-ca` → rewritten to `verify-full`;          */
/*   • `verify-full` → passed through untouched;                                */
/*   • anything else → error (an unknown mode is most likely a typo, and a      */
/*     typo in a security parameter must not silently become plaintext).        */
/*                                                                              */
/* DEVELOPMENT / TEST keep the same rewrite (so dev negotiates exactly what     */
/* prod negotiates, and the CLI stops warning too) but still allow a missing,   */
/* disabled or unknown mode, because a laptop Postgres frequently has no TLS.   */
/* -------------------------------------------------------------------------- */

/** Modes the driver currently warns about; all mean "verify fully, say so". */
const VERIFY_FULL_ALIASES = new Set(["require", "prefer", "verify-ca"]);

export interface NormalizedPostgresUrl {
  /** The URL to hand to `pg`, with explicit TLS semantics. */
  connectionString: string;
  /** The effective mode, for diagnostics that must never print the URL. */
  sslmode: string | null;
}

export function normalizePostgresUrl(
  raw: string,
  nodeEnv: string,
): NormalizedPostgresUrl {
  if (!/^postgres(ql)?:\/\//i.test(raw)) {
    throw new DatabaseConfigError(
      'DATABASE_URL must be a PostgreSQL connection string beginning with "postgresql://" or "postgres://".',
    );
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DatabaseConfigError(
      "DATABASE_URL is not a parseable PostgreSQL connection string.",
    );
  }

  const isProduction = nodeEnv === "production";
  const params = url.searchParams;
  const sslmode = params.get("sslmode");

  if (sslmode === null) {
    if (isProduction) {
      throw new DatabaseConfigError(
        "DATABASE_URL must include ?sslmode=verify-full in production: " +
          "an unencrypted database connection is refused rather than assumed.",
      );
    }
    return { connectionString: url.toString(), sslmode: null };
  }

  if (sslmode === "disable") {
    if (isProduction) {
      throw new DatabaseConfigError(
        "DATABASE_URL must not use sslmode=disable in production: " +
          "TLS to the database is required. Use ?sslmode=verify-full.",
      );
    }
    return { connectionString: url.toString(), sslmode };
  }

  if (sslmode === "verify-full") {
    return { connectionString: url.toString(), sslmode };
  }

  if (VERIFY_FULL_ALIASES.has(sslmode)) {
    // Pin today's actual semantics explicitly; behaviour is unchanged on pg v8.
    params.set("sslmode", "verify-full");
    return { connectionString: url.toString(), sslmode: "verify-full" };
  }

  if (isProduction) {
    throw new DatabaseConfigError(
      "DATABASE_URL carries an unrecognised sslmode in production: " +
        "use ?sslmode=verify-full.",
    );
  }
  return { connectionString: url.toString(), sslmode };
}
