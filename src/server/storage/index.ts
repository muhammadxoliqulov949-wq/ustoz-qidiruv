import "server-only";
import path from "node:path";
import { serverEnv } from "../env";
import { LocalStorageProvider } from "./local-provider";
import { S3StorageProvider } from "./s3-provider";
import { StorageConfigError, type StorageProvider } from "./types";

/* -------------------------------------------------------------------------- */
/* Storage factory — Phase 18.                                                 */
/*                                                                              */
/* ONE decision point for "which provider is this deployment using", so no      */
/* feature code ever constructs a client or reads a credential.                 */
/*                                                                              */
/* FAIL SAFE, NOT OPEN: an unconfigured deployment is NOT silently degraded to  */
/* the filesystem — uploads are simply DISABLED, and the UI says so instead of  */
/* offering a control that cannot work. `local` is refused outright in          */
/* production, so there is no path from a missing credential to local disk.     */
/* -------------------------------------------------------------------------- */

export const MEDIA_URL_PREFIX = "/api/media";

let cached: StorageProvider | null = null;

export interface StorageStatus {
  enabled: boolean;
  provider: string;
  /** Whether public objects can be addressed (CDN/base URL or the dev route). */
  publicDelivery: boolean;
  /** Human-readable reason uploads are unavailable. Never contains a secret. */
  error: string | null;
}

function build(): StorageProvider {
  const env = serverEnv();

  if (env.STORAGE_PROVIDER === "disabled") {
    throw new StorageConfigError("Storage is disabled (STORAGE_PROVIDER is not set).");
  }

  if (env.STORAGE_PROVIDER === "local") {
    /*
     * The filesystem provider exists so the flow can be exercised on a laptop
     * and shared with a reviewer. It must never be a production fallback: in
     * production the objects would live on an ephemeral, non-durable disk.
     */
    if (env.NODE_ENV === "production") {
      throw new StorageConfigError(
        "STORAGE_PROVIDER=local is not allowed in production; configure an object-storage provider.",
      );
    }
    const directory = env.STORAGE_LOCAL_DIR;
    return new LocalStorageProvider({
      directory: path.resolve(directory),
      signingSecret: env.STORAGE_SIGNING_SECRET ?? "dev-local-storage-signing-secret",
      publicPathPrefix: MEDIA_URL_PREFIX,
    });
  }

  // s3
  const missing: string[] = [];
  if (!env.STORAGE_S3_BUCKET) missing.push("STORAGE_S3_BUCKET");
  if (env.NODE_ENV === "production" && !env.STORAGE_S3_PUBLIC_BUCKET) {
    missing.push("STORAGE_S3_PUBLIC_BUCKET");
  }
  if (!env.STORAGE_S3_ACCESS_KEY_ID) missing.push("STORAGE_S3_ACCESS_KEY_ID");
  if (!env.STORAGE_S3_SECRET_ACCESS_KEY) missing.push("STORAGE_S3_SECRET_ACCESS_KEY");
  if (!env.STORAGE_PUBLIC_BASE_URL) missing.push("STORAGE_PUBLIC_BASE_URL");
  if (missing.length > 0) {
    // Names only — never values.
    throw new StorageConfigError(
      `STORAGE_PROVIDER=s3 requires: ${missing.join(", ")}`,
    );
  }

  if (
    env.NODE_ENV === "production" &&
    env.STORAGE_S3_PUBLIC_BUCKET &&
    env.STORAGE_S3_BUCKET === env.STORAGE_S3_PUBLIC_BUCKET
  ) {
    throw new StorageConfigError(
      "STORAGE_PROVIDER=s3 requires distinct STORAGE_S3_BUCKET (private) and STORAGE_S3_PUBLIC_BUCKET (public) in production.",
    );
  }

  return new S3StorageProvider({
    bucket: env.STORAGE_S3_BUCKET as string,
    publicBucket: env.STORAGE_S3_PUBLIC_BUCKET ?? undefined,
    region: env.STORAGE_S3_REGION,
    endpoint: env.STORAGE_S3_ENDPOINT ?? undefined,
    accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID as string,
    secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY as string,
    forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE === "1",
    publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
  });
}

/**
 * The provider for this deployment, or a thrown StorageConfigError explaining
 * what is missing. Callers that must render a page rather than fail should ask
 * `storageStatus()` first.
 */
export function getStorageProvider(): StorageProvider {
  if (cached) return cached;
  /*
   * Nothing is memoised on failure: a misconfigured deployment throws the SAME
   * typed error on every call (the message names variables, never values), and a
   * fixed environment takes effect without a restart of a cached error object.
   */
  cached = build();
  return cached;
}

/** Non-throwing capability probe for UI and diagnostics. */
export function storageStatus(): StorageStatus {
  const env = serverEnv();
  if (cached) {
    return {
      enabled: true,
      provider: cached.name,
      publicDelivery: env.STORAGE_PROVIDER === "local" || Boolean(env.STORAGE_PUBLIC_BASE_URL),
      error: null,
    };
  }
  try {
    const provider = getStorageProvider();
    return {
      enabled: true,
      provider: provider.name,
      publicDelivery: env.STORAGE_PROVIDER === "local" || Boolean(env.STORAGE_PUBLIC_BASE_URL),
      error: null,
    };
  } catch (error) {
    return {
      enabled: false,
      provider: env.STORAGE_PROVIDER,
      publicDelivery: false,
      error:
        error instanceof StorageConfigError
          ? error.message
          : "Storage is misconfigured.",
    };
  }
}

export function storageEnabled(): boolean {
  return storageStatus().enabled;
}

/* --------------------------- test/CLI injection ---------------------------- */

/**
 * Swap the provider for tests and the maintenance CLI. Deliberately NOT exported
 * from a module reachable by the app: the only caller is a test harness or a
 * script that already holds server credentials.
 */
export function __setStorageProviderForTesting(provider: StorageProvider | null): void {
  cached = provider;
}

export function __resetStorageProviderForTesting(): void {
  cached = null;
}

export { StorageConfigError } from "./types";
export { StorageOperationError } from "./types";
export type { StorageProvider } from "./types";
