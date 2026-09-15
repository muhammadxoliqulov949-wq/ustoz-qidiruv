import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageVisibility } from "@/lib/media";
import { isSafeStorageKey, visibilityOfKey } from "./keys";
import {
  clampPrivateReadSeconds,
  MEDIA_URL_PARAM_EXPIRES,
  MEDIA_URL_PARAM_SIGNATURE,
  signPrivateKey,
} from "./signing";
import {
  StorageOperationError,
  type PrivateReadUrl,
  type StorageProvider,
  type StoredObjectHead,
  type PutObjectInput,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Local filesystem provider — DEVELOPMENT ONLY.                               */
/*                                                                              */
/* WHY IT EXISTS: the production provider needs cloud credentials, so without a */
/* local implementation nobody could run the upload flow on a laptop, and tests */
/* would either hit the network or be skipped.                                 */
/*                                                                              */
/* WHY IT IS SAFE:                                                                 */
/*   • the factory REFUSES this provider when NODE_ENV is production, so it can  */
/*     never be a silent production fallback;                                    */
/*   • objects live under a gitignored directory (.data/storage by default);     */
/*   • it serves the SAME authorization contract as S3: public objects are       */
/*     readable by key, private objects require an HMAC capability that expires; */
/*   • metadata is written beside the object (`.meta.json`), so the serving      */
/*     route never has to trust the file extension for a content type.           */
/* -------------------------------------------------------------------------- */

export interface LocalStorageOptions {
  /** Root directory for objects. Must be a gitignored, non-served path. */
  directory: string;
  /** Secret used to sign private read capabilities. */
  signingSecret: string;
  /** App path that serves objects (the media route). */
  publicPathPrefix: string;
  /** Injectable clock, so expiry is testable without waiting. */
  now?: () => number;
}

interface SidecarMeta {
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  metadata: Record<string, string>;
}

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  readonly supportsSignedRead = true;

  constructor(private readonly options: LocalStorageOptions) {}

  /** Absolute path for a key, refusing anything that could escape the root. */
  private objectPath(key: string): string {
    if (!isSafeStorageKey(key)) {
      throw new StorageOperationError("put", "Unsafe storage key.");
    }
    const resolved = path.resolve(this.options.directory, key);
    const root = path.resolve(this.options.directory);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
      throw new StorageOperationError("put", "Unsafe storage key.");
    }
    return resolved;
  }

  async putObject(input: PutObjectInput): Promise<StoredObjectHead> {
    const file = this.objectPath(input.key);
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, input.body);
      const checksum = sha256(input.body);
      const sidecar: SidecarMeta = {
        contentType: input.contentType,
        byteSize: input.body.length,
        checksumSha256: checksum,
        metadata: input.metadata ?? {},
      };
      await writeFile(`${file}.meta.json`, JSON.stringify(sidecar), "utf8");
      return {
        key: input.key,
        byteSize: input.body.length,
        contentType: input.contentType,
        etag: checksum.slice(0, 32),
        metadata: sidecar.metadata,
      };
    } catch (error) {
      throw new StorageOperationError("put", (error as Error).message);
    }
  }

  async headObject(key: string, visibility: StorageVisibility): Promise<StoredObjectHead | null> {
    // Same rule as the object-store provider: a key that belongs to the other
    // namespace simply does not exist for this caller.
    if (!isSafeStorageKey(key) || visibilityOfKey(key) !== visibility) return null;
    const file = this.objectPath(key);
    try {
      const info = await stat(file);
      const sidecar = await this.readSidecar(file);
      return {
        key,
        byteSize: info.size,
        contentType: sidecar?.contentType ?? "application/octet-stream",
        etag: sidecar?.checksumSha256.slice(0, 32) ?? null,
        metadata: sidecar?.metadata ?? {},
      };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string, visibility: StorageVisibility): Promise<void> {
    if (!isSafeStorageKey(key)) return;
    if (visibilityOfKey(key) !== visibility) {
      throw new StorageOperationError("delete", "Key namespace does not match visibility.");
    }
    const file = this.objectPath(key);
    try {
      await rm(file, { force: true });
      await rm(`${file}.meta.json`, { force: true });
    } catch (error) {
      throw new StorageOperationError("delete", (error as Error).message);
    }
  }

  getPublicUrl(key: string): string | null {
    if (!isSafeStorageKey(key) || !key.startsWith("public/")) return null;
    return `${this.options.publicPathPrefix}/${key}`;
  }

  async createPrivateReadUrl(
    key: string,
    options: { expiresInSeconds: number; downloadFileName?: string | null },
  ): Promise<PrivateReadUrl> {
    if (!isSafeStorageKey(key) || !key.startsWith("private/")) {
      throw new StorageOperationError("sign", "Only private keys can be signed.");
    }
    const seconds = clampPrivateReadSeconds(options.expiresInSeconds);
    const now = this.options.now?.() ?? Date.now();
    const expiresAtEpochSeconds = Math.floor(now / 1000) + seconds;
    const signature = signPrivateKey({
      key,
      expiresAtEpochSeconds,
      secret: this.options.signingSecret,
    });
    const query = new URLSearchParams({
      [MEDIA_URL_PARAM_EXPIRES]: String(expiresAtEpochSeconds),
      [MEDIA_URL_PARAM_SIGNATURE]: signature,
    });
    return {
      url: `${this.options.publicPathPrefix}/${key}?${query.toString()}`,
      expiresAt: new Date(expiresAtEpochSeconds * 1000),
    };
  }

  /** Used by the media route: read the bytes and the authoritative metadata. */
  async readObject(key: string): Promise<{ body: Uint8Array; meta: SidecarMeta } | null> {
    const file = this.objectPath(key);
    try {
      const body = await readFile(file);
      const sidecar = await this.readSidecar(file);
      if (!sidecar) return null;
      return { body: new Uint8Array(body), meta: sidecar };
    } catch {
      return null;
    }
  }

  /**
   * The secret the capability URLs are signed with. Exposed so the DEV media
   * route verifies with the exact same value the provider signs with — one
   * source of truth, no duplicated env lookup.
   */
  get signingSecret(): string {
    return this.options.signingSecret;
  }

  private async readSidecar(file: string): Promise<SidecarMeta | null> {
    try {
      const raw = await readFile(`${file}.meta.json`, "utf8");
      return JSON.parse(raw) as SidecarMeta;
    } catch {
      return null;
    }
  }
}
