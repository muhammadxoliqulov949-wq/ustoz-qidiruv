import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight process health alias; use /api/health/ready for DB readiness. */
export function GET(): NextResponse {
  return NextResponse.json(
    { status: "ok" },
    { status: 200, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
