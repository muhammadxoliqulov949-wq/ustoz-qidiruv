import { inArray, lt } from "drizzle-orm";
import { getDb, schema } from "../src/server/db/client";

/* -------------------------------------------------------------------------- */
/* Bounded operational cleanup — Phase 23.                                     */
/*                                                                              */
/* This command only removes expired session rows. Sessions contain hashed      */
/* tokens, are not business history, and are inert even if cleanup is delayed.  */
/* It never deletes users, enrollments, payments, tickets, audit events or      */
/* files. The selection is bounded and supports a dry run for scheduled jobs.   */
/* -------------------------------------------------------------------------- */

function flag(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new Error("limit must be an integer between 1 and 1000");
  }
  return parsed;
}

type DbHandle = ReturnType<typeof getDb>;
let openedDb: DbHandle | null = null;

async function closeDb(): Promise<void> {
  if (!openedDb) return;
  const db = openedDb as unknown as { $client?: { close?: () => Promise<void>; end?: () => Promise<void> } };
  try {
    if (db.$client?.close) await db.$client.close();
    else await db.$client?.end?.();
  } catch {
    // The cleanup result is already known; an already-closed client is harmless.
  }
}

async function cleanupSessions(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const limit = positiveInt(flag("limit"), 500);
  openedDb = getDb();
  const db = openedDb;
  const expired = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(lt(schema.sessions.expiresAt, new Date()))
    .orderBy(schema.sessions.expiresAt, schema.sessions.id)
    .limit(limit);

  console.log(JSON.stringify({ resource: "expired_sessions", selected: expired.length, limit, dryRun }));
  if (dryRun || expired.length === 0) return;

  await db.delete(schema.sessions).where(inArray(schema.sessions.id, expired.map((row) => row.id)));
  console.log(JSON.stringify({ resource: "expired_sessions", deleted: expired.length, bounded: true }));
}

async function run(): Promise<void> {
  const command = process.argv[2];
  if (command !== "cleanup") {
    throw new Error("usage: tsx --conditions=react-server scripts/operations.ts cleanup [--dry-run] [--limit=500]");
  }
  await cleanupSessions();
}

run()
  .catch((error: unknown) => {
    // Keep cron output non-secret: connection errors can contain deployment
    // details, so report only a stable error code/type.
    const code =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "unknown";
    console.error(`operations command failed: ${code}`);
    process.exitCode = 1;
  })
  .finally(closeDb);
