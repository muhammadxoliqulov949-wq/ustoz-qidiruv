/* -------------------------------------------------------------------------- */
/* HTTP security headers — Phase 22. PURE, dependency-free, shared.             */
/*                                                                              */
/* This module is imported by `next.config.ts` (runtime header wiring) AND by   */
/* the Phase 22 test suite, so the shipped policy is asserted, not assumed.     */
/* It has no Node APIs and no secrets — safe to import anywhere.                */
/*                                                                              */
/* WHAT IS SET (production)                                                     */
/*   • Content-Security-Policy — a conservative allowlist (see below);           */
/*   • X-Content-Type-Options: nosniff — never sniff a response into a script;   */
/*   • Referrer-Policy — origin-only on cross-origin navigations (the Payme      */
/*     checkout redirect carries no path or query);                             */
/*   • X-Frame-Options: DENY + frame-ancestors 'none' — the app is never         */
/*     framed, so no clickjacking surface;                                      */
/*   • Permissions-Policy — camera, microphone, geolocation and the Payment     */
/*     Request API are disabled (Payme is a redirect, not a browser API);       */
/*   • Cross-Origin-Opener-Policy: same-origin — a cross-origin popup can never  */
/*     share a browsing context with the app (there are no popups at all);      */
/*   • Strict-Transport-Security — https only, subdomains included.              */
/*                                                                              */
/* WHY `script-src` KEEPS 'unsafe-inline'. The Next.js App Router streams React  */
/* Server Component payloads through inline `<script>` tags (`self.__next_f`),  */
/* so a nonce-free `script-src 'self'` would break every page. A nonce-based    */
/* policy needs per-request middleware plumbing that this codebase deliberately  */
/* does not have yet (no middleware file exists); until then the CSP still      */
/* restricts frames, plugins, base tags, form targets, images and fonts, and    */
/* `object-src 'none'` keeps plugin content out entirely.                       */
/*                                                                              */
/* DEVELOPMENT differs in exactly three ways, all required by the dev loop:     */
/*   1. `frame-ancestors` permits the sandbox preview host (`*.e2b.app`) and     */
/*      localhost, so the live preview iframe keeps working — and the legacy    */
/*      X-Frame-Options header is omitted (it cannot express an allowlist, and   */
/*      sending DENY alongside a permissive CSP would still block);             */
/*   2. `script-src` additionally allows 'unsafe-eval' for devtool HMR;          */
/*   3. `upgrade-insecure-requests` and HSTS are omitted (dev serves plain http). */
/* Preview and production deployments both run with NODE_ENV=production, so      */
/* they always receive the strict policy.                                       */
/*                                                                              */
/* PRIVATE ROUTES additionally send `Cache-Control: no-store` (see               */
/* PRIVATE_NO_STORE_SOURCES): account areas render per-session data and must     */
/* never sit in a shared cache. Public marketing routes are dynamic SSR without  */
/* a public cache directive, which is the deliberate Phase 12 choice — live      */
/* seats and prices over cached snapshots — so correctness never depends on a    */
/* cache that could go stale.                                                   */
/* -------------------------------------------------------------------------- */

export interface HeaderEntry {
  key: string;
  value: string;
}

export interface HeaderRule {
  source: string;
  headers: HeaderEntry[];
}

/** Payme checkout hosts the app may submit/redirect a payer to. */
export const PAYME_CHECKOUT_HOSTS = [
  "https://checkout.paycom.uz",
  "https://checkout.test.paycom.uz",
] as const;

/** Sandbox preview + loopback framing allowed in development ONLY. */
const DEV_FRAME_ANCESTORS = [
  "'self'",
  "https://*.e2b.app",
  "http://localhost:*",
  "https://localhost:*",
  "http://127.0.0.1:*",
  "https://127.0.0.1:*",
].join(" ");

export function buildContentSecurityPolicy(isProduction: boolean): string {
  const scriptSrc = isProduction
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";
  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    // Covers, avatars and the optimizer: self + any https origin (the R2
    // public domain is temporary this phase) + data/blob for local previews.
    "img-src 'self' https: data: blob:",
    // Self-hosted Fontsource files; data: for inlined woff2.
    "font-src 'self' data:",
    // Server actions and same-origin navigation only.
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${PAYME_CHECKOUT_HOSTS.join(" ")}`,
    `frame-ancestors ${isProduction ? "'none'" : DEV_FRAME_ANCESTORS}`,
  ];
  if (isProduction) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** Global (every-route) security headers for this environment. */
export function buildGlobalSecurityHeaders(isProduction: boolean): HeaderEntry[] {
  const headers: HeaderEntry[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(isProduction),
    },
  ];
  if (isProduction) {
    headers.push(
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      },
    );
  }
  return headers;
}

/**
 * Private, per-session routes that must never be stored by a shared cache.
 * Both the section root and everything under it are listed, because
 * `/dashboard/:path*` does not match `/dashboard` itself.
 */
export const PRIVATE_NO_STORE_SOURCES = [
  "/dashboard",
  "/dashboard/:path*",
  "/teacher/dashboard",
  "/teacher/dashboard/:path*",
  "/admin",
  "/admin/:path*",
  "/notifications",
  "/enroll/:path*",
] as const;

export const NO_STORE_HEADER: HeaderEntry = {
  key: "Cache-Control",
  value: "no-store",
};

/** The complete `headers()` table for next.config.ts. */
export function buildHeaderRules(isProduction: boolean): HeaderRule[] {
  const global = buildGlobalSecurityHeaders(isProduction);
  return [
    { source: "/:path*", headers: global },
    ...PRIVATE_NO_STORE_SOURCES.map((source) => ({
      source,
      headers: [NO_STORE_HEADER],
    })),
  ];
}
