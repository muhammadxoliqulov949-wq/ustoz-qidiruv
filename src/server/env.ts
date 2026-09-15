import "server-only";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Server environment contract — Phase 11.                                     */
/*                                                                              */
/* SPLIT RULE                                                                   */
/*   • src/lib/env.ts  — PUBLIC, client-safe values (NEXT_PUBLIC_*) only.       */
/*   • this module     — SERVER-ONLY secrets. `import "server-only"` makes any  */
/*     accidental import from a Client Component a BUILD ERROR, which is the    */
/*     mechanical guarantee that DATABASE_URL can never reach the browser       */
/*     bundle.                                                                   */
/*                                                                              */
/* Nothing here is ever logged: `describeEnv()` returns booleans/driver names   */
/* only, never a value. Validation is lazy so `next build` (which imports       */
/* modules without a database) does not explode at import time.                 */
/* -------------------------------------------------------------------------- */

const schema = z.object({
  /**
   * Postgres connection string. Optional in local/dev where the PGlite
   * driver is used instead (see server/db/client.ts).
   */
  DATABASE_URL: z.string().min(1).optional(),
  /**
   * "pg"     — real Postgres server (production / staging).
   * "pglite" — embedded Postgres (wasm) for local dev, tests and CI.
   */
  DB_DRIVER: z.enum(["pg", "pglite"]).default("pglite"),
  /** Filesystem path for the PGlite data directory (dev only). */
  PGLITE_DATA_DIR: z.string().default(".data/pglite"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Forces `Secure` cookies off for local http testing; never set in prod. */
  AUTH_INSECURE_COOKIES: z.enum(["0", "1"]).default("0"),
  /**
   * Re-enables the Phase 9 teacher WORKSPACE PICKER as a read-only demo tool.
   * It is NOT authentication and confers no authorization whatsoever: it only
   * decides whether the catalogue-inspection UI is rendered. Forced off in
   * production (see demoWorkspaceEnabled()).
   */
  DEMO_TEACHER_WORKSPACE: z.enum(["0", "1"]).default("0"),

  /* ------------------------------- payments -------------------------------- */
  /*
   * Phase 14. Payment is OFF unless explicitly configured.
   *
   *   disabled   — no payment UI, no initiation, callback returns "not found".
   *                The honest default for any deployment without credentials.
   *   test       — Payme sandbox/test cashbox. Real protocol, test money.
   *   production — real money. Additionally requires NODE_ENV=production, so a
   *                dev machine cannot accidentally point at live credentials.
   */
  PAYMENT_MODE: z.enum(["disabled", "test", "production"]).default("disabled"),
  /** Payme cashbox id ("ID кассы"). Not secret, but server-side anyway. */
  PAYME_MERCHANT_ID: z.string().min(1).optional(),
  /**
   * The cashbox key used as the Basic-auth PASSWORD on incoming Payme
   * callbacks. SECRET. Never logged, never sent to the browser.
   */
  PAYME_MERCHANT_KEY: z.string().min(1).optional(),
  /**
   * Basic-auth LOGIN Payme sends. The documented value is "Paycom"; it is
   * configurable because Payme support may issue a different login.
   */
  PAYME_MERCHANT_LOGIN: z.string().min(1).default("Paycom"),
  /**
   * Checkout host used to build the payment link.
   * Production: https://checkout.paycom.uz — Test: https://checkout.test.paycom.uz
   */
  PAYME_CHECKOUT_URL: z.string().url().default("https://checkout.paycom.uz"),
  /** Absolute base URL used to build the post-payment return link. */
  APP_BASE_URL: z.string().url().optional(),

  /* -------------------------------- storage -------------------------------- */
  /*
   * Phase 18. Uploads are OFF unless explicitly configured, exactly like
   * payments: a deployment without object storage must not present an upload
   * control it cannot honour.
   *
   *   disabled — no upload UI, upload actions refuse with honest copy.
   *   local    — DEVELOPMENT ONLY. Filesystem under STORAGE_LOCAL_DIR. The
   *              factory refuses this provider when NODE_ENV=production, so a
   *              missing credential can never fall back to a laptop directory.
   *   s3       — S3-compatible object storage (AWS S3, Cloudflare R2, MinIO…).
   */
  STORAGE_PROVIDER: z.enum(["disabled", "local", "s3"]).default("disabled"),
  /** Root for the local provider. Gitignored (`.data/`), never web-served. */
  STORAGE_LOCAL_DIR: z.string().default(".data/storage"),
  /**
   * HMAC secret for LOCAL private read URLs. Optional: local is development
   * only, and the factory supplies a documented dev value. Real private
   * delivery in production is the provider's own signed URL.
   */
  STORAGE_SIGNING_SECRET: z.string().min(1).optional(),
  /** PRIVATE bucket (verification evidence). */
  STORAGE_S3_BUCKET: z.string().min(1).optional(),
  /** PUBLIC bucket (profile images, course covers). Defaults to the same one. */
  STORAGE_S3_PUBLIC_BUCKET: z.string().min(1).optional(),
  /** Region or `auto` (Cloudflare R2). */
  STORAGE_S3_REGION: z.string().min(1).default("auto"),
  /** Custom endpoint for R2/MinIO. Omit for AWS S3. */
  STORAGE_S3_ENDPOINT: z.string().url().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /** MinIO and some gateways need path-style addressing. */
  STORAGE_S3_FORCE_PATH_STYLE: z.enum(["0", "1"]).default("0"),
  /**
   * Unsigned base URL of the PUBLIC namespace (CDN or bucket domain). Required
   * for s3, because a cover with no publicly addressable URL would be invisible
   * to the marketplace. MUST expose only the `public/` prefix.
   */
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached !== null) return cached;
  const parsed = schema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    DB_DRIVER: process.env.DB_DRIVER,
    PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR,
    NODE_ENV: process.env.NODE_ENV,
    AUTH_INSECURE_COOKIES: process.env.AUTH_INSECURE_COOKIES,
    DEMO_TEACHER_WORKSPACE: process.env.DEMO_TEACHER_WORKSPACE,
    PAYMENT_MODE: process.env.PAYMENT_MODE,
    PAYME_MERCHANT_ID: process.env.PAYME_MERCHANT_ID,
    PAYME_MERCHANT_KEY: process.env.PAYME_MERCHANT_KEY,
    PAYME_MERCHANT_LOGIN: process.env.PAYME_MERCHANT_LOGIN,
    PAYME_CHECKOUT_URL: process.env.PAYME_CHECKOUT_URL,
    APP_BASE_URL: process.env.APP_BASE_URL,
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
    STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR,
    STORAGE_SIGNING_SECRET: process.env.STORAGE_SIGNING_SECRET,
    STORAGE_S3_BUCKET: process.env.STORAGE_S3_BUCKET,
    STORAGE_S3_PUBLIC_BUCKET: process.env.STORAGE_S3_PUBLIC_BUCKET,
    STORAGE_S3_REGION: process.env.STORAGE_S3_REGION,
    STORAGE_S3_ENDPOINT: process.env.STORAGE_S3_ENDPOINT,
    STORAGE_S3_ACCESS_KEY_ID: process.env.STORAGE_S3_ACCESS_KEY_ID,
    STORAGE_S3_SECRET_ACCESS_KEY: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
    STORAGE_S3_FORCE_PATH_STYLE: process.env.STORAGE_S3_FORCE_PATH_STYLE,
    STORAGE_PUBLIC_BASE_URL: process.env.STORAGE_PUBLIC_BASE_URL,
  });
  if (!parsed.success) {
    // Field NAMES only — never values, so a bad secret cannot be logged.
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid server environment: ${fields}`);
  }
  if (parsed.data.DB_DRIVER === "pg" && !parsed.data.DATABASE_URL) {
    throw new Error("DB_DRIVER=pg requires DATABASE_URL to be set");
  }
  /*
   * FAIL SAFE, NOT OPEN. If someone turns payments on, the credentials must
   * actually be there; a half-configured payment system is worse than none,
   * because it would present a "pay" button that cannot settle.
   *
   * Note which names are reported: field NAMES only, never values.
   */
  if (parsed.data.PAYMENT_MODE !== "disabled") {
    const missing: string[] = [];
    if (!parsed.data.PAYME_MERCHANT_ID) missing.push("PAYME_MERCHANT_ID");
    if (!parsed.data.PAYME_MERCHANT_KEY) missing.push("PAYME_MERCHANT_KEY");
    if (missing.length > 0) {
      throw new Error(
        `PAYMENT_MODE=${parsed.data.PAYMENT_MODE} requires: ${missing.join(", ")}`,
      );
    }
  }
  if (parsed.data.PAYMENT_MODE === "production" && parsed.data.NODE_ENV !== "production") {
    throw new Error("PAYMENT_MODE=production is only allowed when NODE_ENV=production");
  }
  cached = parsed.data;
  return cached;
}

/* --------------------------------- payments -------------------------------- */

export type PaymentMode = "disabled" | "test" | "production";

/** Whether this deployment can take payments at all. */
export function paymentMode(): PaymentMode {
  return serverEnv().PAYMENT_MODE;
}

export function paymentsEnabled(): boolean {
  return paymentMode() !== "disabled";
}

/**
 * Payme configuration. Returns null when payments are disabled, so callers
 * cannot accidentally build a checkout link without credentials.
 *
 * SECURITY: this module imports "server-only", so importing it from a Client
 * Component is a BUILD ERROR. That is the mechanical guarantee -- not a
 * convention -- that the merchant key cannot end up in the browser bundle.
 */
export interface PaymeConfig {
  merchantId: string;
  merchantKey: string;
  merchantLogin: string;
  checkoutUrl: string;
  mode: PaymentMode;
  appBaseUrl: string | null;
}

export function paymeConfig(): PaymeConfig | null {
  const env = serverEnv();
  if (env.PAYMENT_MODE === "disabled") return null;
  // Non-null by the boot validation above.
  return {
    merchantId: env.PAYME_MERCHANT_ID as string,
    merchantKey: env.PAYME_MERCHANT_KEY as string,
    merchantLogin: env.PAYME_MERCHANT_LOGIN,
    checkoutUrl: env.PAYME_CHECKOUT_URL,
    mode: env.PAYMENT_MODE,
    appBaseUrl: env.APP_BASE_URL ?? null,
  };
}

export function isProduction(): boolean {
  return serverEnv().NODE_ENV === "production";
}

/** Safe diagnostic summary (no secret values). */
export function describeEnv(): Record<string, string | boolean> {
  const env = serverEnv();
  return {
    driver: env.DB_DRIVER,
    hasDatabaseUrl: env.DATABASE_URL !== undefined,
    nodeEnv: env.NODE_ENV,
    // Booleans and a mode name only -- never the merchant id or key.
    paymentMode: env.PAYMENT_MODE,
    hasPaymeCredentials:
      env.PAYME_MERCHANT_ID !== undefined && env.PAYME_MERCHANT_KEY !== undefined,
    // Storage: the provider NAME and booleans only — never a bucket key or a
    // secret access key.
    storageProvider: env.STORAGE_PROVIDER,
    storageConfigured:
      env.STORAGE_PROVIDER === "local" ||
      (env.STORAGE_PROVIDER === "s3" &&
        env.STORAGE_S3_BUCKET !== undefined &&
        env.STORAGE_S3_ACCESS_KEY_ID !== undefined &&
        env.STORAGE_S3_SECRET_ACCESS_KEY !== undefined &&
        env.STORAGE_PUBLIC_BASE_URL !== undefined),
    hasSignedPrivateReads:
      env.STORAGE_PROVIDER === "s3" ||
      (env.STORAGE_PROVIDER === "local" && env.STORAGE_SIGNING_SECRET !== undefined),
  };
}

/**
 * The Phase 9 workspace picker is a demo affordance only. Even if the flag is
 * set, it stays off in production so no deployment can present a "choose who
 * you are" control next to real accounts.
 */
export function demoWorkspaceEnabled(): boolean {
  const env = serverEnv();
  return env.DEMO_TEACHER_WORKSPACE === "1" && env.NODE_ENV !== "production";
}
