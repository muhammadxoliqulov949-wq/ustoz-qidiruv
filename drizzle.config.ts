import type { Config } from "drizzle-kit";

/* drizzle-kit configuration. Migrations are generated into ./drizzle and are
 * committed: every environment gets the same deterministic DDL. */
export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/ustoz",
  },
  strict: true,
  verbose: false,
} satisfies Config;
