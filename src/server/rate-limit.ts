import "server-only";
import { headers } from "next/headers";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { logError } from "./log";

/* -------------------------------------------------------------------------- */
/* Abuse protection — Phase 22.                                                 */
/*                                                                              */
/* A REUSABLE, DURABLE rate-limit abstraction for sensitive mutations. Every    */
/* brute-force and spam-sensitive action (login, register, enrollment, reviews, */
/* uploads, payments, refunds) funnels through `consumeRateLimit()` with a      */
/* policy from this module.                                                     */
/*                                                                              */
/* WHY POSTGRES. Serverless production runs many instances that share nothing   */
/* in-process, so an in-memory counter would grant the full budget on EVERY     */
/* instance — protection that evaporates under exactly the load it is meant     */
/* for. No Redis/Upstash exists in this project and none is invented here;      */
/* Postgres is the durable shared backend every instance already reaches, so    */
/* the budget is enforced there, in `rate_limit_events`. The messaging module's */
/* long-standing per-minute send guard already proved the pattern (a DB count   */
/* inside the deciding transaction); this module generalises it. That guard     */
/* stays where it is — it is tested and behaviour-identical — while everything  */
/* else adopts this one.                                                        */
/*                                                                              */
/* SEMANTICS. Fixed window, per key:                                            */
/*   1. delete the key's rows older than the window (one indexed range delete,  */
/*      so a hot key's row count never exceeds its limit);                      */
/*   2. count the key's remaining rows;                                         */
/*   3. at limit → refuse WITHOUT recording (a blocked attempt must not extend  */
/*      its own block); below limit → insert one row and allow.                 */
/* Two requests racing the last slot can both pass — over-admission by a small  */
/* race is accepted for abuse control (this guards cost/annoyance, never money: */
/* money is guarded by unique indexes and row locks, which are exact).          */
/*                                                                              */
/* FAILURE MODE. If the limiter itself errors (the migration has not been       */
/* applied yet, the database is unreachable), it FAILS OPEN — the request is    */
/* allowed and the failure is logged with a code. Locking every user out        */
/* because a defence table is missing would turn a defence into an outage; the  */
/* authentication check itself still runs, so fail-open weakens only the        */
/* throttle, never the credential verification.                                */
/*                                                                              */
/* QUIET KEYS are reaped opportunistically: a key whose window expired without  */
/* another hit leaves rows behind until a probabilistic sweep (2% of consumes)  */
/* deletes everything older than the longest window any policy uses. An         */
/* attacker minting unlimited distinct keys therefore grows the table only      */
/* until the next sweep, not forever.                                           */
/* -------------------------------------------------------------------------- */

export interface RateLimitPolicy {
  /** Budget name, e.g. "login:phone". The full key adds the identifier. */
  name: string;
  /** Max allowed attempts per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Attempts left in the window AFTER this one (0 when refused). */
  remaining: number;
}

/* ------------------------------ key building ------------------------------ */

/**
 * Build a storage key from parts. Identifiers are trimmed, lowercased (phones
 * are digits, emails are normalized before they arrive, user ids are opaque)
 * and stripped of anything but a safe alphabet, then capped at the length the
 * database CHECK enforces — so a hostile identifier cannot break the insert
 * or collide across separators.
 */
export function rateLimitKey(name: string, ...parts: string[]): string {
  const clean = (part: string): string =>
    part
      .trim()
      .toLowerCase()
      // `%` stays: IPv6 zone ids (`fe80::1%eth0`) are legitimate IP keys.
      .replace(/[^a-z0-9+_@.%-]/g, "_")
      .slice(0, 80);
  return [name, ...parts.map(clean)].join(":").slice(0, 200);
}

/**
 * Best-effort client IP from proxy headers. Vercel (and any standard proxy)
 * appends the client as the FIRST entry of `x-forwarded-for`; `x-real-ip` is
 * the fallback. Returns null when no usable value exists — callers then limit
 * on identity alone rather than refusing the request.
 */
export function parseClientIp(
  forwardedFor: string | null,
  realIp: string | null,
): string | null {
  const first = (forwardedFor ?? "").split(",")[0]?.trim() ?? "";
  const candidate = first || (realIp ?? "").trim();
  if (!candidate || candidate.length > 64) return null;
  // IPv4, IPv6 (with optional zone) and nothing else.
  if (!/^[0-9a-fA-F:.%]+$/.test(candidate)) return null;
  return candidate;
}

/**
 * The request's client IP for the per-IP budgets, or null when headers are
 * unavailable (never throws: a missing IP narrows limiting to identity keys
 * rather than refusing the request).
 */
export async function requestClientIp(): Promise<string | null> {
  try {
    const store = await headers();
    return parseClientIp(store.get("x-forwarded-for"), store.get("x-real-ip"));
  } catch {
    return null;
  }
}

/* --------------------------------- policies -------------------------------- */

/*
 * Budgets, chosen so legitimate use never notices and abuse cannot scale:
 *   • login/register are per-IDENTIFIER (a mistyped password costs one) plus
 *     per-IP (a credential-stuffing flood shares one bucket);
 *   • everything else is per authenticated user id.
 */
export const RATE_LIMIT_POLICIES = {
  /** Phone-number login, per canonical phone. Generous: typos are normal. */
  loginByPhone: { name: "login:phone", limit: 10, windowSeconds: 600 },
  /** Operator login, per normalized email. */
  loginByEmail: { name: "login:email", limit: 10, windowSeconds: 600 },
  /** Any login/register attempt, per client IP (shared NATs are real). */
  authByIp: { name: "auth:ip", limit: 60, windowSeconds: 600 },
  /** Registrations, per canonical phone. */
  registerByPhone: { name: "register:phone", limit: 5, windowSeconds: 3600 },
  /** Registrations, per client IP. */
  registerByIp: { name: "register:ip", limit: 20, windowSeconds: 3600 },
  /** Enrollment submits, per student. */
  enrollmentSubmit: { name: "enrollment:submit", limit: 20, windowSeconds: 3600 },
  /** Enrollment cancellations, per student. */
  enrollmentCancel: { name: "enrollment:cancel", limit: 30, windowSeconds: 3600 },
  /** Review creates/edits/withdrawals share one bucket, per student. */
  reviewMutation: { name: "review:mutation", limit: 20, windowSeconds: 3600 },
  /** Uploads of any purpose share one bucket, per teacher. */
  upload: { name: "upload", limit: 30, windowSeconds: 3600 },
  /** Payment initiations, per student. */
  paymentStart: { name: "payment:start", limit: 20, windowSeconds: 3600 },
  /** Refund requests, per student. */
  refundRequest: { name: "refund:request", limit: 10, windowSeconds: 3600 },
} satisfies Record<string, RateLimitPolicy>;

/** Copy for a refused attempt. Generic on purpose: no budget is disclosed. */
export const RATE_LIMITED_MESSAGE = "Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.";

/* --------------------------------- consume --------------------------------- */

/** The longest window any policy uses; the sweep horizon. */
const SWEEP_CUTOFF_SECONDS = 24 * 3600;
/** Probability that a consume also reaps globally-expired rows. */
const SWEEP_PROBABILITY = 0.02;

export async function consumeRateLimit(
  policy: RateLimitPolicy,
  key: string,
  options: { nowMs?: number } = {},
): Promise<RateLimitDecision> {
  const db = getDb();
  const now = new Date(options.nowMs ?? Date.now());
  const windowStart = new Date(now.getTime() - policy.windowSeconds * 1000);
  try {
    // 1. This key's expired rows die first: a hot key never holds more rows
    //    than its limit, so the count below scans at most `limit` rows.
    await db
      .delete(schema.rateLimitEvents)
      .where(
        and(eq(schema.rateLimitEvents.key, key), lt(schema.rateLimitEvents.createdAt, windowStart)),
      );

    const counted = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.rateLimitEvents)
      .where(eq(schema.rateLimitEvents.key, key));
    const used = Number(counted[0]?.total ?? 0);

    if (used >= policy.limit) {
      return { allowed: false, remaining: 0 };
    }

    await db.insert(schema.rateLimitEvents).values({ key, createdAt: now });

    if (Math.random() < SWEEP_PROBABILITY) {
      // Best effort: a failed sweep changes nothing about this decision.
      // Awaiting it inside the request keeps serverless semantics simple —
      // the delete is one indexed range scan — and failures are swallowed
      // below, never thrown.
      await sweepExpired(now).catch(() => undefined);
    }

    return { allowed: true, remaining: Math.max(0, policy.limit - used - 1) };
  } catch (error) {
    // Fail OPEN (see the module header): the defence degrades, the request
    // does not. The authentication/authorization check still runs.
    logError("consumeRateLimit failed", error);
    return { allowed: true, remaining: policy.limit };
  }
}

/** Delete rows older than any policy window. Idempotent, best-effort. */
export async function sweepExpired(now: Date = new Date()): Promise<number> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - SWEEP_CUTOFF_SECONDS * 1000);
  try {
    const deleted = await db
      .delete(schema.rateLimitEvents)
      .where(lt(schema.rateLimitEvents.createdAt, cutoff))
      .returning();
    return deleted.length;
  } catch (error) {
    logError("sweepExpired failed", error);
    return 0;
  }
}

/* ------------------------------ action helper ------------------------------ */

export interface RateLimitCheck {
  policy: RateLimitPolicy;
  key: string;
}

/**
 * Consume several budgets for one attempt (e.g. per-identifier AND per-IP).
 * Stops at the first refusal. Sequential consumption can over-record by one
 * event when a later bucket refuses — negligible for abuse control.
 */
export async function consumeRateLimits(
  checks: RateLimitCheck[],
): Promise<RateLimitDecision> {
  let remaining = Number.MAX_SAFE_INTEGER;
  for (const check of checks) {
    const decision = await consumeRateLimit(check.policy, check.key);
    if (!decision.allowed) return decision;
    remaining = Math.min(remaining, decision.remaining);
  }
  return { allowed: true, remaining: remaining === Number.MAX_SAFE_INTEGER ? 0 : remaining };
}
