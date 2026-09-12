import { NextResponse } from "next/server";
import { paymeConfig } from "@/server/env";
import { handlePaymeRequest, verifyPaymeAuth } from "@/server/payments/payme-adapter";
import { PAYME_ERROR, paymeError } from "@/server/payments/payme-protocol";

/* -------------------------------------------------------------------------- */
/* POST /api/payments/payme — the Payme Merchant API callback endpoint.        */
/*                                                                              */
/* THE CALLER IS PAYME, NOT A USER. This endpoint deliberately has no session   */
/* requirement: Payme's servers have no cookie. Authentication is HTTP Basic    */
/* with the merchant credentials, checked BEFORE anything is parsed as a        */
/* business request and before any mutation can occur.                          */
/*                                                                              */
/* This is the ONLY route in the application that can cause a payment to become */
/* `succeeded`. No browser navigation, query parameter or client action can     */
/* reach that transition.                                                       */
/*                                                                              */
/* Node runtime (not Edge): the adapter uses node:crypto for the timing-safe    */
/* credential comparison and the database driver is a Node package.             */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reject oversized bodies before parsing. A legitimate RPC call is tiny. */
const MAX_BODY_BYTES = 16 * 1024;

/** Payme expects HTTP 200 with a JSON-RPC envelope, even for protocol errors. */
function rpc(body: unknown): NextResponse {
  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      // This endpoint is machine-to-machine; keep it out of any index.
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const config = paymeConfig();
  if (!config) {
    /*
     * Payments are not configured for this deployment. Report insufficient
     * privileges rather than acknowledging an endpoint that cannot settle
     * anything — and, critically, never fabricate a success.
     */
    return rpc(paymeError(null, PAYME_ERROR.UNAUTHORIZED));
  }

  // 1. AUTHENTICATE FIRST. Nothing is parsed or mutated before this passes.
  if (!verifyPaymeAuth(request.headers.get("authorization"), config)) {
    return rpc(paymeError(null, PAYME_ERROR.UNAUTHORIZED));
  }

  // 2. Bounded read.
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return rpc(paymeError(null, PAYME_ERROR.INVALID_REQUEST));
  }

  // 3. Parse.
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return rpc(paymeError(null, PAYME_ERROR.PARSE));
  }

  // 4. Dispatch. The adapter whitelists methods and maps every failure onto a
  //    protocol-correct error; raw internals never escape.
  const response = await handlePaymeRequest(body);
  return rpc(response);
}

/**
 * The protocol defines a specific error for a non-POST request, so the other
 * verbs answer with it rather than Next's default 405 HTML.
 */
function notPost(): NextResponse {
  return rpc(paymeError(null, PAYME_ERROR.NOT_POST));
}

export const GET = notPost;
export const PUT = notPost;
export const PATCH = notPost;
export const DELETE = notPost;
