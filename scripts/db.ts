/* -------------------------------------------------------------------------- */
/* Database CLI — Phase 11.                                                    */
/*                                                                              */
/*   npm run db:migrate   apply committed migrations from ./drizzle             */
/*   npm run db:seed      DEVELOPMENT-ONLY import of the canonical datasets     */
/*   npm run db:reset     drop the local PGlite data dir, migrate, seed         */
/*                                                                              */
/* Migration and seed are strictly separate steps: schema changes are           */
/* deterministic SQL files, seeding is an explicit dev action that refuses to   */
/* run against NODE_ENV=production.                                             */
/* -------------------------------------------------------------------------- */
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "drizzle");

type Sql = (query: string) => Promise<unknown>;

async function connect(): Promise<{ exec: Sql; close: () => Promise<void> }> {
  const driver = process.env.DB_DRIVER ?? "pglite";
  if (driver === "pg") {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return {
      exec: async (query) => pool.query(query),
      close: async () => {
        await pool.end();
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DATA_DIR ?? ".data/pglite";
  mkdirSync(path.join(ROOT, dir), { recursive: true });
  const client = new PGlite(dir);
  return {
    exec: async (query) => client.exec(query),
    close: async () => client.close(),
  };
}

async function migrate(): Promise<void> {
  const { exec, close } = await connect();
  await exec(`CREATE TABLE IF NOT EXISTS __migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied = new Set<string>();
  const rows = (await exec(`SELECT name FROM __migrations`)) as
    | { rows?: { name: string }[] }
    | { rows: { name: string }[] }[];
  const list = Array.isArray(rows) ? rows.flatMap((r) => r.rows ?? []) : (rows.rows ?? []);
  for (const row of list) applied.add(row.name);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    // drizzle-kit separates statements with an explicit breakpoint marker.
    const statements = sql
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    await exec("BEGIN");
    try {
      for (const statement of statements) await exec(statement);
      await exec(`INSERT INTO __migrations (name) VALUES ('${file}')`);
      await exec("COMMIT");
    } catch (error) {
      await exec("ROLLBACK");
      throw error;
    }
    count += 1;
    console.log(`applied ${file}`);
  }
  console.log(count === 0 ? "migrations: already up to date" : `migrations: applied ${count}`);
  await close();
}

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:seed refuses to run with NODE_ENV=production");
  }
  const { seedDevelopmentData } = await import("../src/server/db/seed");
  const summary = await seedDevelopmentData();
  console.log("seed:", JSON.stringify(summary));
}

async function reset(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:reset refuses to run with NODE_ENV=production");
  }
  const dir = process.env.PGLITE_DATA_DIR ?? ".data/pglite";
  rmSync(path.join(ROOT, dir), { recursive: true, force: true });
  console.log(`removed ${dir}`);
  await migrate();
  await seed();
}

const command = process.argv[2];
const run =
  command === "migrate" ? migrate : command === "seed" ? seed : command === "reset" ? reset : null;

if (run === null) {
  console.error("usage: tsx scripts/db.ts <migrate|seed|reset>");
  process.exit(1);
}

run().catch((error: unknown) => {
  // Never print the connection string or any row payload.
  console.error(`db command failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
});
