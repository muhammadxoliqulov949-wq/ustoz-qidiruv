import { sql } from "drizzle-orm";
import { getDb, schema } from "../src/server/db/client";
import { cleanupStorage } from "../src/server/file-service";
import { storageStatus } from "../src/server/storage";

/* -------------------------------------------------------------------------- */
/* Storage operations CLI — Phase 18.                                           */
/*                                                                              */
/* Two commands, both read-mostly and both safe to run by hand:                  */
/*                                                                              */
/*   storage:status                       → is this deployment configured, and    */
/*                                          how many assets are in each state?   */
/*   storage:cleanup [--dry-run] [--hours=24] [--limit=500]                       */
/*                                        → sweep abandoned uploads + orphaned   */
/*                                          objects.                              */
/*                                                                              */
/* Nothing here prints a credential, a bucket name or a storage key: the report   */
/* is counts and state names only. Scheduling is deliberately NOT implemented —   */
/* see README → "Cleanup semantics" for the cron shape we do not ship.            */
/* -------------------------------------------------------------------------- */

function flag(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((argument) => argument.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

async function status(): Promise<void> {
  const storage = storageStatus();
  console.log("storage:", JSON.stringify(storage, null, 2));

  const db = getDb();
  const rows = await db
    .select({ status: schema.fileAssets.status, count: sql<number>`count(*)::int` })
    .from(schema.fileAssets)
    .groupBy(schema.fileAssets.status);

  const byStatus: Record<string, number> = {};
  for (const row of rows) byStatus[row.status] = row.count;
  console.log("assets by status:", JSON.stringify(byStatus));

  const documents = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.teacherVerificationDocuments);
  console.log("frozen evidence rows:", documents[0]?.count ?? 0);

  if (!storage.enabled) {
    console.log(
      "storage is DISABLED in this environment: uploads are refused honestly and\n" +
        "nothing is written. Set STORAGE_PROVIDER (local for development, s3 for a\n" +
        "bucket) to enable media.",
    );
  }
}

async function cleanup(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const hours = Number(flag("hours") ?? "24");
  const limit = Number(flag("limit") ?? "500");

  if (!Number.isFinite(hours) || hours < 0) throw new Error("--hours must be a positive number");
  if (!Number.isFinite(limit) || limit < 1) throw new Error("--limit must be a positive number");

  const report = await cleanupStorage({
    pendingOlderThanHours: hours,
    limit,
    dryRun,
  });

  console.log(
    `${dryRun ? "storage:cleanup --dry-run" : "storage:cleanup"}:`,
    JSON.stringify(report),
  );
  if (dryRun) {
    console.log("dry run: nothing was changed. Re-run without --dry-run to apply.");
  }
  if (report.failed > 0) {
    console.log(
      `${report.failed} object operation(s) failed. Rows are already marked deleted,\n` +
        "so the next run will retry them; repeated failures point at provider\n" +
        "permissions or network access, not at the database.",
    );
  }
}

const command = process.argv[2];
const run = command === "status" ? status : command === "cleanup" ? cleanup : null;

if (run === null) {
  console.error("usage: tsx --conditions=react-server scripts/storage.ts <status|cleanup> [--dry-run]");
  process.exit(1);
}

run().catch((error: unknown) => {
  // Never print a credential or a provider payload.
  console.error(
    `storage command failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exit(1);
});
