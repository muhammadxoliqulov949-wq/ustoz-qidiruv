import type { NextConfig } from "next";

/* -------------------------------------------------------------------------- */
/* Phase 18: image delivery + upload body limit.                                */
/*                                                                              */
/* REMOTE PATTERNS ARE DERIVED FROM THE CONFIGURED STORAGE ORIGIN — never       */
/* `hostname: "*"`. A wildcard would let a teacher image URL point anywhere,     */
/* which is exactly the open-proxy behavior Phase 18 is meant to remove. When    */
/* no public storage origin is configured (local development, or any deployment  */
/* that has not enabled uploads) NO remote pattern is added at all, and every    */
/* image keeps being served from the app itself.                                */
/* -------------------------------------------------------------------------- */

function publicStoragePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const raw = process.env.STORAGE_PUBLIC_BASE_URL;
  if (!raw) return [];
  try {
    const url = new URL(raw);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        // Same port only when the base URL declares one explicitly (MinIO/dev).
        ...(url.port ? { port: url.port } : {}),
        // Keys always live under `public/`, so the optimizer will not fetch
        // anything else from this origin even if a URL is crafted by hand.
        pathname: `${url.pathname.replace(/\/$/, "")}/public/**`,
      },
    ];
  } catch {
    // A malformed value must not break the BUILD; the storage factory refuses
    // to serve anything in that case, and uploads stay disabled.
    return [];
  }
}

const nextConfig: NextConfig = {
  /**
   * Database drivers must stay OUT of the bundler and be required at runtime
   * from node_modules:
   *  • @electric-sql/pglite ships a .wasm + .data pair it resolves relative to
   *    its own package path — bundling rewrites that path and the engine fails
   *    to boot at runtime;
   *  • pg and @node-rs/argon2 load native/optional bindings the same way.
   * Marking them external is the supported way to keep those resolutions intact.
   */
  serverExternalPackages: ["@electric-sql/pglite", "pg", "@node-rs/argon2", "@aws-sdk/client-s3"],
  images: {
    remotePatterns: publicStoragePatterns(),
  },
  /**
   * Development-only. The preview environment proxies this dev server under a
   * different host, and Next refuses cross-origin dev asset/HMR requests unless
   * the host is declared. Production is unaffected (this key is dev-only).
   */
  allowedDevOrigins: ["*.e2b.app"],
  experimental: {
    serverActions: {
      /**
       * Server-mediated uploads carry the bytes through a server action, so the
       * default 1 MB limit would reject a legitimate 5 MB cover. 12 MB covers
       * the largest allowed file (10 MB verification document) plus form
       * overhead; the per-purpose limits in `src/lib/media.ts` stay the real
       * authority and are enforced on the server.
       */
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
