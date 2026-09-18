import { NextRequest, NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  type GoogleOAuthState,
  exchangeGoogleCode,
  resolveGoogleUser,
  validateGoogleIdToken,
} from "@/server/auth/oauth";
import { createSession } from "@/server/auth/session";
import { safeEqual } from "@/server/auth/ids";
import { serverEnv } from "@/server/env";
import { parseSafeNext } from "@/lib/safe-next";
import { logError } from "@/server/log";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const baseUrl = serverEnv().APP_BASE_URL ?? new URL(request.url).origin;
  const loginUrl = new URL("/login", baseUrl);

  // Retrieve and clear oauth state cookie
  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const responseRedirect = (url: URL) => {
    const res = NextResponse.redirect(url);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  };

  if (errorParam) {
    loginUrl.searchParams.set("error", "google_cancelled");
    return responseRedirect(loginUrl);
  }

  if (!code || !state || !stateCookie) {
    loginUrl.searchParams.set("error", "invalid_oauth_state");
    return responseRedirect(loginUrl);
  }

  let oauthState: GoogleOAuthState;
  try {
    oauthState = JSON.parse(stateCookie) as GoogleOAuthState;
  } catch {
    loginUrl.searchParams.set("error", "corrupted_oauth_state");
    return responseRedirect(loginUrl);
  }

  // Constant-time state validation
  if (!safeEqual(state, oauthState.state)) {
    loginUrl.searchParams.set("error", "state_mismatch");
    return responseRedirect(loginUrl);
  }

  const env = serverEnv();
  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    loginUrl.searchParams.set("error", "oauth_not_configured");
    return responseRedirect(loginUrl);
  }

  const redirectUri = env.GOOGLE_REDIRECT_URI ?? `${baseUrl}/api/auth/google/callback`;

  try {
    // 1. Exchange authorization code for tokens
    const { id_token } = await exchangeGoogleCode(
      code,
      oauthState.codeVerifier,
      redirectUri,
    );

    // 2. Validate ID token cryptographic signature & claims
    const validation = await validateGoogleIdToken(id_token, oauthState.nonce, clientId);
    if (!validation.ok) {
      logError("Google ID token validation failed", { code: validation.code });
      loginUrl.searchParams.set("error", validation.code);
      return responseRedirect(loginUrl);
    }

    // 3. Resolve or link user transactionally
    const authResult = await resolveGoogleUser(
      validation.claims,
      oauthState.role ?? "student",
    );

    if (!authResult.ok) {
      logError("resolveGoogleUser failed", { code: authResult.code });
      loginUrl.searchParams.set("error", authResult.code);
      return responseRedirect(loginUrl);
    }

    // 4. Issue authenticated session
    await createSession(authResult.userId);

    // 5. Direct user to safe return URL or role cabinet
    const safeNext = parseSafeNext(oauthState.next ?? undefined);
    const targetPath =
      safeNext ??
      (authResult.role === "admin"
        ? "/admin"
        : authResult.role === "teacher"
          ? "/teacher/dashboard"
          : "/dashboard");

    const targetUrl = new URL(targetPath, baseUrl);
    return responseRedirect(targetUrl);
  } catch (err) {
    logError("Google OAuth callback exception", err);
    loginUrl.searchParams.set("error", "oauth_callback_failed");
    return responseRedirect(loginUrl);
  }
}
