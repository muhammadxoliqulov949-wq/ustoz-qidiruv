/* -------------------------------------------------------------------------- */
/* Admin bootstrap CLI — Phase 15.                                            */
/*                                                                              */
/*   npm run admin:list                    who currently has the admin role     */
/*   npm run admin:promote -- +998XXXXXXXXX  existing account → admin           */
/*   npm run admin:demote  -- +998XXXXXXXXX  admin → their previous role        */
/*   npm run admin:create  -- +998XXXXXXXXX  NEW password-only admin account    */
/*                                                                              */
/* WHY A SCRIPT AND NOT A ROUTE                                               */
/*   • It is not reachable over HTTP at all. There is no endpoint, no server    */
/*     action and no page that can grant the admin role — so an escalation      */
/*     attempt from a browser has nothing to call.                              */
/*   • It never reads a role from a request. The operator states the target      */
/*     phone number explicitly; the role is implied by the command.             */
/*   • It is the ONLY writer of `users.role = 'admin'` anywhere in the codebase. */
/*                                                                              */
/* WHY AN ADMIN IS ITS OWN ACCOUNT                                            */
/*   `users(id, role)` is the target of a COMPOSITE foreign key from            */
/*   `student_profiles` and `teacher_profiles`, and each profile table CHECKs    */
/*   its own role (`= 'student'` / `= 'teacher'`). The database therefore        */
/*   refuses to turn a profiled account into an admin — and that is a security   */
/*   property we KEEP: an operator account physically cannot own courses, be     */
/*   enrolled as a student, or inherit a marketplace identity. Least privilege.  */
/*                                                                              */
/*   So bootstrap has two paths:                                                */
/*     create  — PRIMARY. A NEW, profile-less operator account.                 */
/*     promote — an already profile-less account (legacy/manual rows). Refuses   */
/*               a profiled account with an explanation instead of deleting      */
/*               courses to force it through.                                   */
/*                                                                              */
/* SAFETY RULES                                                                */
/*   • No default account, no default password, no seeded admin in production.  */
/*   • `promote` requires an EXISTING account and refuses an unknown phone.     */
/*   • `create` requires ADMIN_PASSWORD in the environment (≥ 12 chars) and      */
/*     refuses to run with a weaker or missing one. It is never interactive,    */
/*     so no password is ever echoed to a terminal history or a log.            */
/*   • No credential is printed, logged or committed.                           */
/* -------------------------------------------------------------------------- */
import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/server/db/client";
import { hashPassword } from "../src/server/auth/password";
import { newId } from "../src/server/auth/ids";
import { describeEnv } from "../src/server/env";

/** The exact phone form the `users_phone_format` CHECK constraint accepts. */
const PHONE_RE = /^\+998[0-9]{9}$/;

const MIN_ADMIN_PASSWORD = 12;

function usage(): never {
  console.error(
    [
      "usage:",
      "  npm run admin:list",
      "  npm run admin:promote -- +998XXXXXXXXX",
      "  npm run admin:demote  -- +998XXXXXXXXX",
      "  npm run admin:create  -- +998XXXXXXXXX      (requires ADMIN_PASSWORD)",
    ].join("\n"),
  );
  process.exit(1);
}

function requirePhone(): string {
  const phone = (process.argv[3] ?? "").trim();
  if (!PHONE_RE.test(phone)) {
    console.error("Target must be an existing phone number in +998XXXXXXXXX form.");
    process.exit(1);
  }
  return phone;
}

/** Never print a phone in full; the operator knows which number they typed. */
function mask(phone: string): string {
  return `${phone.slice(0, 4)}****${phone.slice(-3)}`;
}

/**
 * Release the driver and exit.
 *
 * PGlite keeps its worker alive after the last query, so a script that only
 * awaits its command would hang the terminal (and any pipe) forever. Closing
 * explicitly — then exiting — makes the command usable in a shell and in CI.
 */
async function shutdown(): Promise<void> {
  const db = getDb() as unknown as { $client?: { close?: () => Promise<void> } };
  try {
    await db.$client?.close?.();
  } catch {
    // A already-closed handle is not an error worth reporting.
  }
  process.exit(0);
}

async function findUser(phone: string) {
  const db = getDb();
  const rows = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.phone, phone))
    .limit(1);
  return rows[0] ?? null;
}

async function list(): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.users.id, role: schema.users.role, phone: schema.users.phone })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"));
  console.log(`driver: ${String(describeEnv().driver)} · admins: ${rows.length}`);
  for (const row of rows) {
    // Masked on purpose: this output may be pasted into an issue or a log.
    console.log(`  ${mask(row.phone)}  (${row.id})`);
  }
  if (rows.length === 0) console.log("  (none — use admin:promote or admin:create)");
}

async function promote(): Promise<void> {
  const phone = requirePhone();
  const user = await findUser(phone);
  if (!user) {
    // Safe failure: an unknown target changes nothing and says nothing about
    // which numbers do exist.
    console.error("No account with that phone number. Nothing was changed.");
    process.exit(1);
  }
  if (user.role === "admin") {
    console.log(`${mask(phone)} is already an admin. Nothing to do.`);
    return;
  }

  const db = getDb();
  /*
   * Refuse a PROFILED account, and say why instead of deleting data to make it
   * work. `student_profiles`/`teacher_profiles` hold a composite FK on
   * (user_id, role): the UPDATE below would be rejected by PostgreSQL, and
   * "fixing" it would mean deleting the profile — i.e. the teacher's courses and
   * the student's requests. Silence or a raw FK error would both be worse.
   */
  const [studentRows, teacherRows] = await Promise.all([
    db
      .select({ userId: schema.studentProfiles.userId })
      .from(schema.studentProfiles)
      .where(eq(schema.studentProfiles.userId, user.id))
      .limit(1),
    db
      .select({ userId: schema.teacherProfiles.userId })
      .from(schema.teacherProfiles)
      .where(eq(schema.teacherProfiles.userId, user.id))
      .limit(1),
  ]);
  if (studentRows.length > 0 || teacherRows.length > 0) {
    const kind = teacherRows.length > 0 ? "teacher" : "student";
    console.error(
      [
        `${mask(phone)} has a ${kind} profile, so it cannot become an admin.`,
        "A profile is bound to its account role by a composite foreign key, and",
        "removing it would delete that account's marketplace data.",
        "Create a separate operator account instead:",
        "  ADMIN_PASSWORD=... npm run admin:create -- +998XXXXXXXXX",
      ].join("\n"),
    );
    process.exit(1);
  }

  await db
    .update(schema.users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));
  console.log(`Promoted ${mask(phone)}: ${user.role} → admin.`);
}

async function demote(): Promise<void> {
  const phone = requirePhone();
  const user = await findUser(phone);
  if (!user) {
    console.error("No account with that phone number. Nothing was changed.");
    process.exit(1);
  }
  if (user.role !== "admin") {
    console.log(`${mask(phone)} is not an admin. Nothing to do.`);
    return;
  }
  const db = getDb();
  /*
   * An admin never has a profile row (see the FK rationale at the top), so
   * `student` is the only role the database will accept here. The account can
   * then keep using the ordinary registration/onboarding flow. The admin's past
   * decisions in `admin_audit_events` are untouched: the trail records that an
   * admin with this user id acted, and demotion does not erase history.
   */
  await db
    .update(schema.users)
    .set({ role: "student", updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));
  console.log(`Demoted ${mask(phone)}: admin → student.`);
}

async function create(): Promise<void> {
  const phone = requirePhone();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (password.length < MIN_ADMIN_PASSWORD) {
    console.error(
      `ADMIN_PASSWORD must be set and at least ${MIN_ADMIN_PASSWORD} characters. Nothing was created.`,
    );
    process.exit(1);
  }
  const existing = await findUser(phone);
  if (existing) {
    console.error("An account with that phone number already exists. Use admin:promote.");
    process.exit(1);
  }

  const db = getDb();
  const id = newId("usr");
  /*
   * ONLY the `users` row is created. There is intentionally no student_profiles
   * or teacher_profiles insert: an admin is an operator account with no
   * marketplace identity, so it cannot own courses or enrollments.
   */
  await db.insert(schema.users).values({
    id,
    role: "admin",
    phone,
    passwordHash: await hashPassword(password),
  });
  console.log(`Created admin ${mask(phone)} (${id}). Password was read from ADMIN_PASSWORD and not stored in plaintext.`);
}

const command = process.argv[2];
const run =
  command === "list"
    ? list
    : command === "promote"
      ? promote
      : command === "demote"
        ? demote
        : command === "create"
          ? create
          : null;

if (run === null) usage();

run()
  .then(shutdown)
  .catch((error: unknown) => {
    // Never print a connection string, a password or a row payload.
    console.error(
      `admin command failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exit(1);
  });
