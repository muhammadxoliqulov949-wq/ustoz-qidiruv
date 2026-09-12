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
    const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
    return drizzlePg(pool, { schema, casing: "snake_case" });
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
