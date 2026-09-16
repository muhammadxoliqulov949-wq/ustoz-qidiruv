import "server-only";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";
import { serverEnv } from "../env";
import { DatabaseConfigError } from "./errors";
import { normalizePostgresUrl } from "./postgres-url";

export { DatabaseConfigError };

/* -------------------------------------------------------------------------- */
/* Database client — Phase 11.                                                 */
/*                                                                              */
/* Two drivers, ONE schema and ONE migration set:                              */
/*   • DB_DRIVER=pg     → node-postgres pool against a real Postgres server     */
/*                        (production / staging).                               */
/*   • DB_DRIVER=pglite → PGlite, i.e. genuine PostgreSQL 18 compiled to wasm,  */
/*                        used for local dev, tests and CI. It is a real        */
/*                        Postgres engine, so CHECK/FK/UNIQUE constraints and   */
/*                        transactions behave exactly as in production — this   */
/*                        is deliberately NOT a mock or an in-memory fake.      */
/*                                                                              */
/* PRODUCTION RULE                                                             */
/*   PGlite is a DEVELOPMENT/TEST driver: it stores the cluster in a local      */
/*   directory. On a serverless platform that directory is ephemeral and the    */
/*   filesystem is frequently read-only, so the embedded engine cannot serve a  */
/*   real deployment. Therefore production may ONLY use pg, and a production    */
/*   process with no PostgreSQL configuration fails here, loudly, naming the    */
/*   missing variables — it never falls back to `.data/pglite`.                 */
/*                                                                              */
/*   The check lives in this module on purpose. It is NOT in `serverEnv()`:     */
/*   that validator also serves payments, storage and `next build`, which runs  */
/*   with NODE_ENV=production and MUST keep working with no database at all.    */
/*   Failing here means the error surfaces only when runtime data access is     */
/*   actually attempted, and never during the build.                            */
/*                                                                              */
/* The connection is cached on globalThis so Next.js dev HMR does not open a    */
/* new pool on every reload. Nothing here logs a connection string.             */
/* -------------------------------------------------------------------------- */

export type Database = ReturnType<typeof createDatabase>;

function createDatabase() {
  const env = serverEnv();
  if (env.DB_DRIVER === "pg") {
    // Loaded lazily so the unused driver is never initialised (and so a
    // PGlite-only deployment does not need `pg` installed at all).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    // Presence is enforced by serverEnv(); the shape AND the TLS policy are
    // enforced here (Phase 22: `sslmode=require` is rewritten to the
    // explicitly-verifying `verify-full` it already means on pg v8).
    const { connectionString } = normalizePostgresUrl(
      env.DATABASE_URL as string,
      env.NODE_ENV,
    );
    const pool = new Pool({
      connectionString,
      /*
       * Phase 22 pool policy for serverless Postgres (Neon pooler):
       *   • max 10 — the pg default, unchanged: each warm serverless instance
       *     holds at most ten connections, and the pooler multiplexes them;
       *   • connectionTimeoutMillis — waiting for a free connection fails
       *     after 10 s instead of hanging the request forever, so an
       *     overloaded pool degrades into catchable errors, not hung pages;
       *   • statement_timeout — no single statement may run longer than 30 s;
       *     every legitimate query in this codebase is milliseconds, so this
       *     only ever catches a stuck query before it pins a connection;
       *   • idle_in_transaction_session_timeout — a transaction idle for 30 s
       *     is killed server-side; no transaction here legitimately idles.
       */
      max: 10,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
      idle_in_transaction_session_timeout: 30_000,
    });
    /*
     * An idle client that errors (the pooler closing a stale connection is
     * the routine case) emits 'error' on the pool — and an EventEmitter with
     * no 'error' listener THROWS, which would crash the serverless instance.
     * This listener keeps that routine event routine. Code only, never the
     * connection string.
     */
    pool.on("error", (error: Error & { code?: string }) => {
      console.error("pg pool idle client error", { code: error.code ?? "unknown" });
    });
    return drizzlePg(pool, { schema, casing: "snake_case" });
  }

  /*
   * Reaching this point means the driver is NOT pg. In production that is a
   * configuration error, not a supported mode: the next statement would create
   * a `.data/pglite` directory on a filesystem that cannot hold it, and the
   * deployment would answer every database-backed request with a filesystem
   * error instead of saying what is actually wrong.
   *
   * Throwing BEFORE the mkdir is what guarantees production never touches
   * `.data/` — there is no path from a missing credential to a local database.
   */
  if (env.NODE_ENV === "production") {
    throw new DatabaseConfigError(
      "Runtime database access is not configured for production: PGlite is a development/test " +
        "driver that writes a local data directory, which a production serverless runtime cannot " +
        "persist or create. Set DB_DRIVER=pg and DATABASE_URL (a pooled connection string such as " +
        "?sslmode=require) in this deployment's environment. See \"Deployment (Vercel)\" in README.md.",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  mkdirSync(env.PGLITE_DATA_DIR, { recursive: true });
  const client = new PGlite(env.PGLITE_DATA_DIR);
  return drizzlePglite(client, { schema, casing: "snake_case" });
}

declare global {
  var __ustozDb: ReturnType<typeof createDatabase> | undefined;
}

export function getDb(): Database {
  if (!globalThis.__ustozDb) {
    globalThis.__ustozDb = createDatabase();
  }
  return globalThis.__ustozDb;
}

export { schema };
