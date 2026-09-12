import "server-only";

/* -------------------------------------------------------------------------- */
/* Payment provider contract — Phase 14.                                       */
/*                                                                              */
/* This file is the BOUNDARY. Everything above it (payment-service, server      */
/* actions, UI) speaks only the vocabulary defined here; everything below it    */
/* (payme-adapter) is free to be as provider-specific as the protocol demands.  */
/*                                                                              */
/* Nothing Payme-shaped may appear in this file: no JSON-RPC, no numeric        */
/* transaction states, no -31008 error codes. If a future CLICK adapter cannot  */
/* be expressed in these terms, the abstraction is wrong and should be widened  */
/* deliberately -- not bypassed.                                                */
/*                                                                              */
/* CLICK (future, NOT implemented): CLICK's Shop API uses a two-step            */
/* Prepare/Complete flow with an md5 signature instead of Basic auth and        */
/* JSON-RPC. Both steps still reduce to "authenticate the caller", "check this  */
/* obligation may be paid", and "settle it exactly once", which is what this    */
/* interface expresses. A CLICK adapter would therefore implement               */
/* `buildCheckoutUrl` plus its own callback route, and reuse the same           */
/* payment-service functions for the domain effects.                            */
/* -------------------------------------------------------------------------- */

/** Providers the payment domain knows about. Only `payme` is implemented. */
export type ProviderId = "payme";

/**
 * Stable, provider-agnostic failure reasons.
 *
 * Adapters map their own protocol errors onto these; the product UI maps these
 * onto human messages. A raw provider code never reaches a student, and a raw
 * database error never reaches a provider.
 */
export type PaymentErrorCode =
  | "not_found"
  | "not_payable"
  | "wrong_amount"
  | "already_paid"
  | "already_cancelled"
  | "invalid_state"
  | "provider_unavailable"
  | "not_configured"
  | "forbidden"
  | "server_error";

export interface PaymentFailure {
  ok: false;
  code: PaymentErrorCode;
  /** Product-level message, safe to show a student. Never a provider dump. */
  message: string;
}

export type PaymentResult<T> = ({ ok: true } & T) | PaymentFailure;

export function paymentFailure(
  code: PaymentErrorCode,
  message: string,
): PaymentFailure {
  return { ok: false, code, message };
}

/**
 * What a provider adapter must be able to do for the payment domain.
 *
 * Deliberately small: the inbound protocol (callbacks) is the adapter's own
 * business and is routed to it by its own endpoint. What the DOMAIN needs from
 * a provider is only the ability to send a student somewhere to pay.
 */
export interface PaymentProvider {
  readonly id: ProviderId;

  /** Whether this provider is configured well enough to accept a payment. */
  isConfigured(): boolean;

  /**
   * Build the URL a student is sent to in order to pay.
   *
   * The amount comes from the stored payment snapshot, never from a caller
   * argument that a browser could influence, and the return URL is built
   * server-side from configuration -- never accepted from the client.
   */
  buildCheckoutUrl(input: {
    paymentId: string;
    amountTiyin: bigint;
    returnUrl: string | null;
    language?: "uz" | "ru" | "en";
  }): string;
}
