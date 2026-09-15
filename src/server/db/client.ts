import "server-only";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";
import { serverEnv } from "../env";

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

/**
 * Thrown when this deployment's database configuration cannot safely serve
 * reads. Messages name ENVIRONMENT VARIABLES and never their values, so they
 * are safe to log and safe to show an operator.
 */
export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

/** A connection string is the one value the pool cannot guess or default. */
function postgresUrl(raw: string): string {
  if (!/^postgres(ql)?:\/\//i.test(raw)) {
    throw new DatabaseConfigError(
      'DATABASE_URL must be a PostgreSQL connection string beginning with "postgresql://" or "postgres://".',
    );
  }
  return raw;
}

function createDatabase() {
  const env = serverEnv();
  if (env.DB_DRIVER === "pg") {
    // Loaded lazily so the unused driver is never initialised (and so a
    // PGlite-only deployment does not need `pg` installed at all).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    // Presence is enforced by serverEnv(); the shape is enforced here.
    const pool = new Pool({ connectionString: postgresUrl(env.DATABASE_URL as string), max: 10 });
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
