import "server-only";
import { randomBytes } from "node:crypto";
import { getStorageProvider, storageStatus } from "./index";
import { CACHE_CONTROL_BY_VISIBILITY } from "./policy";
import type { StorageProvider } from "./types";

/* -------------------------------------------------------------------------- */
/* Storage Smoke & Diagnostic Tool — Phase 21.                                 */
/*                                                                              */
/* Operator diagnostic to verify S3/R2/generic S3 storage configuration by      */
/* exercising temporary objects against public and private bucket roles.        */
/*                                                                              */
/* OPERATOR SAFETY:                                                             */
/*   • Tests PUT, HEAD, public/private boundary, signed read, and DELETE.       */
/*   • Always cleans up temporary probe keys in finally blocks.                 */
/*   • Returns safe metadata only — NEVER outputs access keys, secrets, signed  */
/*     query parameters (X-Amz-Signature / HMAC tokens), or raw credentials.   */
/*   • Must NOT be run automatically during build or deployment.                */
/* -------------------------------------------------------------------------- */

export interface SmokeStepResult {
  operation: "put" | "head" | "public_url" | "sign" | "delete" | "verify_cleanup";
  bucketRole: "public" | "private";
  key: string;
  success: boolean;
  safeMetadata: Record<string, string | number | boolean>;
  error?: string;
}

export interface SmokeTestReport {
  provider: string;
  success: boolean;
  steps: SmokeStepResult[];
  error?: string;
}

// Minimal valid 1x1 PNG bytes for public probe
const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

// Minimal valid PDF header/trailer bytes for private probe
const TINY_PDF = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xd0, 0xd4,
  0xc5, 0xd8, 0x0a, 0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a, 0x3c,
  0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c,
  0x6f, 0x67, 0x3e, 0x3e, 0x0a, 0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
  0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72, 0x0a, 0x3c, 0x3c, 0x2f, 0x52,
  0x6f, 0x6f, 0x74, 0x20, 0x31, 0x20, 0x30, 0x20, 0x52, 0x3e, 0x3e, 0x0a,
  0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a,
]);

export async function smokeStorage(customProvider?: StorageProvider): Promise<SmokeTestReport> {
  const status = storageStatus();
  if (!status.enabled && !customProvider) {
    return {
      provider: status.provider,
      success: false,
      steps: [],
      error: status.error ?? "Storage is not enabled.",
    };
  }

  let provider: StorageProvider;
  try {
    provider = customProvider ?? getStorageProvider();
  } catch (err) {
    return {
      provider: status.provider,
      success: false,
      steps: [],
      error: (err as Error).message,
    };
  }

  const steps: SmokeStepResult[] = [];
  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const publicProbeKey = `public/smoke-probe-${suffix}.png`;
  const privateProbeKey = `private/smoke-probe-${suffix}.pdf`;

  let allOk = true;

  // 1. PUBLIC NAMESPACE / BUCKET ROLE PROBE
  try {
    // 1a. PUT
    const putHead = await provider.putObject({
      key: publicProbeKey,
      visibility: "public",
      body: TINY_PNG,
      contentType: "image/png",
      cacheControl: CACHE_CONTROL_BY_VISIBILITY.public,
      metadata: { probe: "smoke" },
    });
    steps.push({
      operation: "put",
      bucketRole: "public",
      key: publicProbeKey,
      success: true,
      safeMetadata: { byteSize: putHead.byteSize, contentType: putHead.contentType },
    });

    // 1b. HEAD
    const head = await provider.headObject(publicProbeKey, "public");
    const headOk = Boolean(head && head.byteSize === TINY_PNG.length && head.contentType === "image/png");
    steps.push({
      operation: "head",
      bucketRole: "public",
      key: publicProbeKey,
      success: headOk,
      safeMetadata: {
        byteSize: head?.byteSize ?? 0,
        contentType: head?.contentType ?? "unknown",
        verified: headOk,
      },
    });
    if (!headOk) allOk = false;

    // 1c. PUBLIC URL RESOLUTION
    const pubUrl = provider.getPublicUrl(publicProbeKey);
    let urlHost = "none";
    if (pubUrl) {
      try {
        urlHost = new URL(pubUrl).hostname;
      } catch {
        urlHost = "invalid-url";
      }
    }
    steps.push({
      operation: "public_url",
      bucketRole: "public",
      key: publicProbeKey,
      success: Boolean(pubUrl),
      safeMetadata: {
        hasPublicUrl: Boolean(pubUrl),
        resolvedHost: urlHost,
      },
    });

    // 1d. DELETE
    await provider.deleteObject(publicProbeKey, "public");
    steps.push({
      operation: "delete",
      bucketRole: "public",
      key: publicProbeKey,
      success: true,
      safeMetadata: { deleted: true },
    });

    // 1e. VERIFY CLEANUP
    const headAfter = await provider.headObject(publicProbeKey, "public");
    const cleanOk = headAfter === null;
    steps.push({
      operation: "verify_cleanup",
      bucketRole: "public",
      key: publicProbeKey,
      success: cleanOk,
      safeMetadata: { cleanedUp: cleanOk },
    });
    if (!cleanOk) allOk = false;
  } catch (err) {
    allOk = false;
    steps.push({
      operation: "put",
      bucketRole: "public",
      key: publicProbeKey,
      success: false,
      safeMetadata: {},
      error: (err as Error).message,
    });
  } finally {
    // Guaranteed cleanup
    try {
      await provider.deleteObject(publicProbeKey, "public");
    } catch {
      // Best effort probe cleanup
    }
  }

  // 2. PRIVATE NAMESPACE / BUCKET ROLE PROBE
  try {
    // 2a. PUT
    const putHead = await provider.putObject({
      key: privateProbeKey,
      visibility: "private",
      body: TINY_PDF,
      contentType: "application/pdf",
      cacheControl: CACHE_CONTROL_BY_VISIBILITY.private,
      metadata: { probe: "smoke" },
    });
    steps.push({
      operation: "put",
      bucketRole: "private",
      key: privateProbeKey,
      success: true,
      safeMetadata: { byteSize: putHead.byteSize, contentType: putHead.contentType },
    });

    // 2b. HEAD
    const head = await provider.headObject(privateProbeKey, "private");
    const headOk = Boolean(head && head.byteSize === TINY_PDF.length && head.contentType === "application/pdf");
    steps.push({
      operation: "head",
      bucketRole: "private",
      key: privateProbeKey,
      success: headOk,
      safeMetadata: {
        byteSize: head?.byteSize ?? 0,
        contentType: head?.contentType ?? "unknown",
        verified: headOk,
      },
    });
    if (!headOk) allOk = false;

    // 2c. ENSURE PRIVATE KEY CANNOT GENERATE PUBLIC URL
    const forbiddenPublicUrl = provider.getPublicUrl(privateProbeKey);
    const blockedOk = forbiddenPublicUrl === null;
    steps.push({
      operation: "public_url",
      bucketRole: "private",
      key: privateProbeKey,
      success: blockedOk,
      safeMetadata: { publicUrlBlocked: blockedOk },
    });
    if (!blockedOk) allOk = false;

    // 2d. SIGNED PRIVATE READ
    if (provider.supportsSignedRead) {
      const signed = await provider.createPrivateReadUrl(privateProbeKey, {
        expiresInSeconds: 300,
        downloadFileName: "probe.pdf",
      });
      const hasUrl = Boolean(signed.url);
      const isFuture = signed.expiresAt.getTime() > Date.now();
      const signOk = hasUrl && isFuture;
      // CRITICAL: NEVER output signed.url or query parameters (credentials/HMAC)
      steps.push({
        operation: "sign",
        bucketRole: "private",
        key: privateProbeKey,
        success: signOk,
        safeMetadata: {
          signedReadCapabilityGranted: signOk,
          expiresInSeconds: 300,
        },
      });
      if (!signOk) allOk = false;
    }

    // 2e. DELETE
    await provider.deleteObject(privateProbeKey, "private");
    steps.push({
      operation: "delete",
      bucketRole: "private",
      key: privateProbeKey,
      success: true,
      safeMetadata: { deleted: true },
    });

    // 2f. VERIFY CLEANUP
    const headAfter = await provider.headObject(privateProbeKey, "private");
    const cleanOk = headAfter === null;
    steps.push({
      operation: "verify_cleanup",
      bucketRole: "private",
      key: privateProbeKey,
      success: cleanOk,
      safeMetadata: { cleanedUp: cleanOk },
    });
    if (!cleanOk) allOk = false;
  } catch (err) {
    allOk = false;
    steps.push({
      operation: "put",
      bucketRole: "private",
      key: privateProbeKey,
      success: false,
      safeMetadata: {},
      error: (err as Error).message,
    });
  } finally {
    // Guaranteed cleanup
    try {
      await provider.deleteObject(privateProbeKey, "private");
    } catch {
      // Best effort probe cleanup
    }
  }

  return {
    provider: provider.name,
    success: allOk,
    steps,
  };
}
