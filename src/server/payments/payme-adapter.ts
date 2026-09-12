import "server-only";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { paymeConfig, type PaymeConfig } from "../env";
import { parseProviderAmount, tiyinToProviderAmount } from "@/lib/money";
import type { PaymentProvider } from "./provider";
import {
  PAYME_ACCOUNT_FIELD,
  PAYME_ERROR,
  PAYME_STATE,
  isPaymeMethod,
  paymeError,
  paymeResult,
  readAccountPaymentId,
  readTimestamp,
  readTransactionId,
  type PaymeRpcResponse,
} from "./payme-protocol";
import {
  createProviderTransaction,
  findActiveTransactionForPayment,
  findProviderTransaction,
  listTransactionsBetween,
  markCancelled,
  markPerformed,
} from "./payment-service";

/* -------------------------------------------------------------------------- */
/* Payme adapter — Phase 14.                                                   */
/*                                                                              */
/* Translates the Payme Merchant API into payment-domain operations and back.  */
/* Everything Payme-specific stops here: JSON-RPC shapes, numeric states and   */
/* -31xxx codes never travel further into the application.                      */
/*                                                                              */
/* AUTHENTICATION                                                               */
/* Payme authenticates with HTTP Basic (`Authorization: Basic base64(l:p)`).   */
/* Note what this means: the caller is PAYME, not a logged-in user. There is no */
/* session cookie on these requests, and requiring one would break the          */
/* integration. The merchant key IS the credential, so it is compared in        */
/* constant time and never logged.                                              */
/*                                                                              */
/* IDEMPOTENCY                                                                  */
/* Payme repeats CreateTransaction/PerformTransaction/CancelTransaction after a */
/* lost response and REQUIRES the repeat to return the same result as the       */
/* first call. Each handler below therefore reads existing state first and      */
/* returns the stored answer rather than re-applying an effect.                 */
/* -------------------------------------------------------------------------- */

/* ------------------------------ authentication ------------------------------ */

/** Constant-time string comparison that does not leak length via early exit. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the timing profile does not distinguish
    // "wrong length" from "wrong value".
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify the Basic credentials Payme sent.
 *
 * Returns false for every failure mode — missing header, wrong scheme,
 * undecodable payload, wrong login, wrong key — and never explains which,
 * either to the caller or to the log.
 */
export function verifyPaymeAuth(
  authorizationHeader: string | null,
  config: PaymeConfig,
): boolean {
  if (!authorizationHeader) return false;
  const [scheme, encoded] = authorizationHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "basic" || !encoded) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return false;
  }

  // Only the FIRST colon separates login from password: the key may contain one.
  const separator = decoded.indexOf(":");
  if (separator === -1) return false;
  const login = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  const loginOk = safeEqual(login, config.merchantLogin);
  const keyOk = safeEqual(password, config.merchantKey);
  // Evaluate both before returning, so timing does not reveal which failed.
  return loginOk && keyOk;
}

/* -------------------------------- handlers ---------------------------------- */

type Rpc = { id: number | string | null; params: Record<string, unknown> };

/** Load a payment together with the enrollment status it depends on. */
async function loadPayment(paymentId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.payments.id,
      amountTiyin: schema.payments.amountTiyin,
      status: schema.payments.status,
      enrollmentStatus: schema.enrollmentRequests.status,
    })
    .from(schema.payments)
    .innerJoin(
      schema.enrollmentRequests,
      eq(schema.enrollmentRequests.id, schema.payments.enrollmentRequestId),
    )
    .where(eq(schema.payments.id, paymentId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * CheckPerformTransaction — may a transaction be created for this account?
 *
 * Validates the account against OUR records (never trusting the identifier)
 * and the amount against the immutable snapshot.
 */
async function checkPerformTransaction({ id, params }: Rpc): Promise<PaymeRpcResponse> {
  const paymentId = readAccountPaymentId(params);
  if (!paymentId) {
    return paymeError(id, PAYME_ERROR.ACCOUNT_NOT_FOUND, PAYME_ACCOUNT_FIELD);
  }
  const amount = parseProviderAmount(params.amount);
  if (amount === null) return paymeError(id, PAYME_ERROR.WRONG_AMOUNT);

  const payment = await loadPayment(paymentId);
  if (!payment) {
    return paymeError(id, PAYME_ERROR.ACCOUNT_NOT_FOUND, PAYME_ACCOUNT_FIELD);
  }
  // The place must still be accepted, and the obligation still open.
  if (payment.enrollmentStatus !== "accepted") {
    return paymeError(id, PAYME_ERROR.ACCOUNT_NOT_FOUND, PAYME_ACCOUNT_FIELD);
  }
  if (payment.status !== "pending") {
    return paymeError(id, PAYME_ERROR.CANNOT_PERFORM);
  }
  if (payment.amountTiyin !== amount) {
    return paymeError(id, PAYME_ERROR.WRONG_AMOUNT);
  }

  /*
   * FISCALIZATION SEAM. When the cashbox is configured for fiscalization the
   * protocol expects `detail.items[]` with real IKPU (`code`), `package_code`
   * and `vat_percent`. Those are merchant-registration data this project does
   * not have, and inventing them would produce invalid fiscal receipts, so the
   * `detail` object is deliberately omitted until the values are configured.
   * See README "Fiscalization boundary".
   */
  return paymeResult(id, { allow: true });
}

/**
 * CreateTransaction — register a Payme transaction against our obligation.
 *
 * Repeat calls with the same id must return the same result, so an existing
 * transaction is re-read and echoed rather than recreated.
 */
async function createTransaction({ id, params }: Rpc): Promise<PaymeRpcResponse> {
  const transactionId = readTransactionId(params);
  if (!transactionId) return paymeError(id, PAYME_ERROR.INVALID_REQUEST);
  const time = readTimestamp(params.time);
  if (time === null) return paymeError(id, PAYME_ERROR.INVALID_REQUEST);

  // Already known? Echo the stored state — this is the retry path.
  const existing = await findProviderTransaction(transactionId);
  if (existing) {
    if (existing.state !== PAYME_STATE.CREATED) {
      // It exists but has moved on; it can no longer be "created".
      return paymeError(id, PAYME_ERROR.CANNOT_PERFORM);
    }
    return paymeResult(id, {
      create_time: Number(existing.providerCreatedAt),
      transaction: existing.id,
      state: PAYME_STATE.CREATED,
    });
  }

  const paymentId = readAccountPaymentId(params);
  if (!paymentId) {
    return paymeError(id, PAYME_ERROR.ACCOUNT_NOT_FOUND, PAYME_ACCOUNT_FIELD);
  }
  const amount = parseProviderAmount(params.amount);
  if (amount === null) return paymeError(id, PAYME_ERROR.WRONG_AMOUNT);

  const payment = await loadPayment(paymentId);
  if (!payment || payment.enrollmentStatus !== "accepted") {
    return paymeError(id, PAYME_ERROR.ACCOUNT_NOT_FOUND, PAYME_ACCOUNT_FIELD);
  }
  if (payment.amountTiyin !== amount) return paymeError(id, PAYME_ERROR.WRONG_AMOUNT);
  if (payment.status !== "pending") return paymeError(id, PAYME_ERROR.CANNOT_PERFORM);

  // One live provider transaction at a time per obligation.
  const active = await findActiveTransactionForPayment(payment.id);
  if (active) return paymeError(id, PAYME_ERROR.CANNOT_PERFORM);

  const created = await createProviderTransaction({
    paymentId: payment.id,
    providerTransactionId: transactionId,
    providerCreatedAt: time,
  });
  if (!created.ok) return paymeError(id, PAYME_ERROR.INTERNAL);

  return paymeResult(id, {
    create_time: Number(created.transaction.providerCreatedAt),
    transaction: created.transaction.id,
    state: PAYME_STATE.CREATED,
  });
}

/** PerformTransaction — settle. The only path that can mark a payment paid. */
async function performTransaction({ id, params }: Rpc): Promise<PaymeRpcResponse> {
  const transactionId = readTransactionId(params);
  if (!transactionId) return paymeError(id, PAYME_ERROR.INVALID_REQUEST);

  const existing = await findProviderTransaction(transactionId);
  if (!existing) return paymeError(id, PAYME_ERROR.TRANSACTION_NOT_FOUND);

  const result = await markPerformed(transactionId, Date.now());
  if (!result.ok) {
    if (result.code === "not_found") {
      return paymeError(id, PAYME_ERROR.TRANSACTION_NOT_FOUND);
    }
    if (result.code === "invalid_state") return paymeError(id, PAYME_ERROR.CANNOT_PERFORM);
    return paymeError(id, PAYME_ERROR.INTERNAL);
  }

  return paymeResult(id, {
    transaction: result.transaction.id,
    perform_time: Number(result.transaction.performedAt ?? 0),
    state: PAYME_STATE.PERFORMED,
  });
}

/** CancelTransaction — cancel a created or an already performed transaction. */
async function cancelTransaction({ id, params }: Rpc): Promise<PaymeRpcResponse> {
  const transactionId = readTransactionId(params);
  if (!transactionId) return paymeError(id, PAYME_ERROR.INVALID_REQUEST);
  const reason = typeof params.reason === "number" ? params.reason : null;

  const existing = await findProviderTransaction(transactionId);
  if (!existing) return paymeError(id, PAYME_ERROR.TRANSACTION_NOT_FOUND);

  const result = await markCancelled(transactionId, Date.now(), reason);
  if (!result.ok) {
    if (result.code === "not_found") {
      return paymeError(id, PAYME_ERROR.TRANSACTION_NOT_FOUND);
    }
    return paymeError(id, PAYME_ERROR.INTERNAL);
  }

  return paymeResult(id, {
    transaction: result.transaction.id,
    cancel_time: Number(result.transaction.cancelledAt ?? 0),
    state: result.transaction.state,
  });
}

/** CheckTransaction — report the current state. */
async function checkTransaction({ id, params }: Rpc): Promise<PaymeRpcResponse> {
  const transactionId = readTransactionId(params);
  if (!transactionId) return paymeError(id, PAYME_ERROR.INVALID_REQUEST);

  const found = await findProviderTransaction(transactionId);
  if (!found) return paymeError(id, PAYME_ERROR.TRANSACTION_NOT_FOUND);

  return paymeResult(id, {
    create_time: Number(found.providerCreatedAt),
    perform_time: Number(found.performedAt ?? 0),
    cancel_time: Number(found.cancelledAt ?? 0),
    transaction: found.id,
    state: found.state,
    reason: found.reasonCode,
  });
}

/** GetStatement — transactions in a window, for reconciliation. */
async function getStatement({ id, params }: Rpc): Promise<PaymeRpcResponse> {
  const from = readTimestamp(params.from);
  const to = readTimestamp(params.to);
  if (from === null || to === null) return paymeError(id, PAYME_ERROR.INVALID_REQUEST);

  const rows = await listTransactionsBetween(from, to);
  return paymeResult(id, {
    transactions: rows.map((row) => ({
      id: row.providerTransactionId,
      time: Number(row.providerCreatedAt),
      amount: tiyinToProviderAmount(row.amountTiyin),
      account: { [PAYME_ACCOUNT_FIELD]: row.paymentId },
      create_time: Number(row.providerCreatedAt),
      perform_time: Number(row.performedAt ?? 0),
      cancel_time: Number(row.cancelledAt ?? 0),
      transaction: row.paymentId,
      state: row.state,
      reason: row.reasonCode,
    })),
  });
}

/* -------------------------------- dispatcher -------------------------------- */

/**
 * Route one authenticated JSON-RPC call.
 *
 * Authentication is the caller's responsibility (the route does it first);
 * this function assumes an authenticated request and focuses on the protocol.
 */
export async function handlePaymeRequest(body: unknown): Promise<PaymeRpcResponse> {
  if (typeof body !== "object" || body === null) {
    return paymeError(null, PAYME_ERROR.INVALID_REQUEST);
  }
  const request = body as Record<string, unknown>;
  const rpcId =
    typeof request.id === "number" || typeof request.id === "string" ? request.id : null;

  const method = request.method;
  if (typeof method !== "string") {
    return paymeError(rpcId, PAYME_ERROR.INVALID_REQUEST);
  }
  // Method WHITELIST: anything not in the protocol is rejected by name.
  if (!isPaymeMethod(method)) {
    return paymeError(rpcId, PAYME_ERROR.METHOD_NOT_FOUND, method);
  }
  const params =
    typeof request.params === "object" && request.params !== null
      ? (request.params as Record<string, unknown>)
      : {};

  const rpc: Rpc = { id: rpcId, params };

  try {
    switch (method) {
      case "CheckPerformTransaction":
        return await checkPerformTransaction(rpc);
      case "CreateTransaction":
        return await createTransaction(rpc);
      case "PerformTransaction":
        return await performTransaction(rpc);
      case "CancelTransaction":
        return await cancelTransaction(rpc);
      case "CheckTransaction":
        return await checkTransaction(rpc);
      case "GetStatement":
        return await getStatement(rpc);
    }
  } catch (error) {
    // Internal detail NEVER reaches the provider; log a code, not a secret.
    console.error("payme handler failed", {
      method,
      code: (error as { code?: string }).code ?? "unknown",
    });
    return paymeError(rpcId, PAYME_ERROR.INTERNAL);
  }
}

/* --------------------------- the provider interface -------------------------- */

export const paymeProvider: PaymentProvider = {
  id: "payme",

  isConfigured(): boolean {
    return paymeConfig() !== null;
  },

  /**
   * Build the Payme checkout URL.
   *
   * Format (verified against the current docs):
   *   <checkout_url>/base64("m=<id>;ac.<field>=<value>;a=<tiyin>;c=<return>")
   *
   * The amount comes from the stored snapshot and the return URL from server
   * configuration — a browser can influence neither.
   */
  buildCheckoutUrl(input): string {
    const config = paymeConfig();
    if (!config) throw new Error("Payme is not configured");

    const parts = [
      `m=${config.merchantId}`,
      `ac.${PAYME_ACCOUNT_FIELD}=${input.paymentId}`,
      `a=${tiyinToProviderAmount(input.amountTiyin)}`,
      `l=${input.language ?? "uz"}`,
    ];
    if (input.returnUrl) parts.push(`c=${input.returnUrl}`);

    const encoded = Buffer.from(parts.join(";"), "utf8").toString("base64");
    return `${config.checkoutUrl.replace(/\/+$/, "")}/${encoded}`;
  },
};
