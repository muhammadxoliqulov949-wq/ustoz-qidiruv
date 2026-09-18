import { NextRequest, NextResponse } from "next/server";
import { createGoogleAuthRedirect } from "@/server/auth/oauth";
import { parseSafeNext } from "@/lib/safe-next";
import { parseRoleParam } from "@/lib/onboarding";
import { serverEnv } from "@/server/env";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = serverEnv();
  if (!env.GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: "Google autentifikatsiyasi sozlanmagan." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const roleParam = parseRoleParam(searchParams.get("role") ?? undefined);
  const nextParam = parseSafeNext(searchParams.get("next") ?? undefined);

  try {
    const authUrl = await createGoogleAuthRedirect({
      role: roleParam ?? "student",
      next: nextParam,
    });
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Failed to initiate Google OAuth", error);
    return NextResponse.redirect(new URL("/login?error=oauth_init_failed", request.url));
  }
}
