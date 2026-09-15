import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { isSafeStorageKey } from "@/server/storage/keys";
import { LocalStorageProvider } from "@/server/storage/local-provider";
import {
  INLINE_SAFE_MIME_TYPES,
  PRIVATE_RESPONSE_HEADERS,
  CACHE_CONTROL_BY_VISIBILITY,
} from "@/server/storage/policy";
import {
  MEDIA_URL_PARAM_EXPIRES,
  MEDIA_URL_PARAM_SIGNATURE,
  verifyPrivateKey,
} from "@/server/storage/signing";
import { sanitizeDisplayFileName } from "@/lib/media";

/* -------------------------------------------------------------------------- */
/* Media delivery route — DEVELOPMENT / LOCAL PROVIDER ONLY.                    */
/*                                                                              */
/* In production the objects are served by the object store itself (a CDN URL    */
/* for public assets, a presigned URL for private ones), so this route refuses   */
/* to serve anything unless the LOCAL provider is the active one. That is what   */
/* stops a "temporary dev helper" from becoming a permanent unauthenticated      */
/* file server in production.                                                   */
/*                                                                              */
/* Both namespaces enforce the SAME rule as S3:                                 */
/*   • `public/*`  — readable by key, cacheable forever (a replacement writes a  */
/*                   NEW key, so `immutable` is honest);                        */
/*   • `private/*` — requires a valid, unexpired HMAC capability, is never       */
/*                   cached by a shared cache, and is always served `nosniff`.  */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

function notFound(): NextResponse {
  // One answer for "no such key", "not active" and "bad signature": the
  // response must not help anyone map the bucket.
  return new NextResponse("Topilmadi", {
    status: 404,
    headers: { "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  let provider;
  try {
    provider = getStorageProvider();
  } catch {
    return notFound();
  }
  if (!(provider instanceof LocalStorageProvider)) return notFound();

  const { key: segments } = await context.params;
  const key = segments.map((segment) => decodeURIComponent(segment)).join("/");
  if (!isSafeStorageKey(key)) return notFound();

  const isPrivate = key.startsWith("private/");
  const url = new URL(request.url);

  if (isPrivate) {
    const verdict = verifyPrivateKey({
      key,
      expiresAtEpochSeconds: Number(url.searchParams.get(MEDIA_URL_PARAM_EXPIRES) ?? "NaN") || null,
      signature: url.searchParams.get(MEDIA_URL_PARAM_SIGNATURE),
      secret: provider.signingSecret,
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    if (verdict !== "valid") return notFound();
  }

  /*
   * The DATABASE decides whether the object is still a live asset. A row that
   * was deleted or superseded stops being served even though the bytes may still
   * be on disk waiting for the cleanup command.
   */
  const db = getDb();
  const rows = await db
    .select({
      status: schema.fileAssets.status,
      visibility: schema.fileAssets.visibility,
      mimeType: schema.fileAssets.mimeType,
      storageKey: schema.fileAssets.storageKey,
      originalFileName: schema.fileAssets.originalFileName,
    })
    .from(schema.fileAssets)
    .where(and(eq(schema.fileAssets.storageKey, key), eq(schema.fileAssets.status, "active")))
    .limit(1);

  const asset = rows[0];
  if (!asset) return notFound();
  if (isPrivate !== (asset.visibility === "private")) return notFound();

  const object = await provider.readObject(key);
  if (!object) return notFound();

  // The stored content type is authority; the extension is not consulted.
  const contentType = INLINE_SAFE_MIME_TYPES.includes(asset.mimeType)
    ? asset.mimeType
    : "application/octet-stream";

  const headers = new Headers(
    isPrivate
      ? PRIVATE_RESPONSE_HEADERS
      : {
          "Cache-Control": CACHE_CONTROL_BY_VISIBILITY.public,
          "X-Content-Type-Options": "nosniff",
        },
  );
  headers.set("Content-Type", contentType);
  headers.set("Accept-Ranges", "bytes");

  if (isPrivate) {
    const fileName = sanitizeDisplayFileName(asset.originalFileName);
    const disposition = INLINE_SAFE_MIME_TYPES.includes(asset.mimeType) ? "inline" : "attachment";
    headers.set("Content-Disposition", `${disposition}; filename="${fileName}"`);
  }

  const body = object.body;
  const total = body.byteLength;
  const range = request.headers.get("range");

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
      if (Number.isFinite(start) && start <= end && start < total) {
        const slice = body.subarray(start, end + 1);
        headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
        headers.set("Content-Length", String(slice.byteLength));
        return new NextResponse(new Uint8Array(slice), { status: 206, headers });
      }
    }
    headers.set("Content-Range", `bytes */${total}`);
    return new NextResponse(null, { status: 416, headers });
  }

  headers.set("Content-Length", String(total));
  return new NextResponse(new Uint8Array(body), { status: 200, headers });
}
