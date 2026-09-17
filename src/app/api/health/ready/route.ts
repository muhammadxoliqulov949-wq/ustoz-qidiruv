import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dependency readiness. The response intentionally contains no connection URL,
 * storage key, credential, provider detail or stack trace. A load balancer gets
 * only the distinction it needs: ready or not ready.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json(
      { status: "ready" },
      { status: 200, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
    );
  } catch (error) {
    console.error("readiness check failed", { code: (error as { code?: string }).code ?? "unknown" });
    return NextResponse.json(
      { status: "not_ready" },
      { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
    );
  }
}
