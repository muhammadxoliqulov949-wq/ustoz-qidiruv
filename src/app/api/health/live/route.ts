import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Process-level liveness. Deliberately does not touch the database or storage. */
export function GET(): NextResponse {
  return NextResponse.json(
    { status: "ok" },
    { status: 200, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
