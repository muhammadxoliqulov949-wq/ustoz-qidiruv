# Phase 14 — payment foundation + Payme integration: audit and decisions

## A. Audit of the existing system (before any code was written)

| Area | Finding | Consequence for Phase 14 |
| --- | --- | --- |
| Enrollment lifecycle | `submitted → accepted / rejected → cancelled`, contract in `src/lib/enrollment-status.ts` | Payment is a **separate domain**. No `paid` status is added. |
| Accepted paid UX | Student card says `To'lov tizimi hali ulanmagan.` | Replaced with real payment states; the string stays as the *fallback* when payments are not configured. |
| Price model | `courses.price_uzs` — `integer`, whole **so'm**, `0` means free, CHECK `0 … 100_000_000` | Needs a tiyin conversion layer. Max price 100M so'm = 10^10 tiyin, which **overflows int32** → payment amount must be `bigint`. |
| Currency | Implicit UZS everywhere; `price_period` is display-only (`month`/`course`) | Store an explicit `currency` on payments, constrained to `UZS`. |
| Auth/session | Opaque cookie → SHA-256 hash in `sessions`; `requireUser` / `requireRole` | Student initiation uses the session. The Payme callback **must not** require a session — it authenticates with Basic auth instead. |
| Notifications | `notifications` + `notification_type` enum, inserted in the same tx as the change | Add one payment type and reuse the mechanism. |
| Server actions | Thin, intent-shaped, Zod `.strict()`, typed `ActionResult` | Payment initiation follows exactly this shape. |
| Env/secrets | `src/server/env.ts` imports `server-only`, lazy Zod validation, `describeEnv()` never returns values | Payme credentials go here. `server-only` is the mechanical guarantee they cannot reach the browser bundle. |
| Runtime | PGlite (dev/test) or real Postgres; `serverExternalPackages` configured | The callback route must run on the Node runtime, not Edge. |

## B. Payme Business Merchant API — verified against current official docs

Fetched from `developer.help.paycom.uz` during this phase (not from memory):

| Item | Verified value |
| --- | --- |
| Methods | `CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`, `CheckTransaction`, `GetStatement` |
| Transport | JSON-RPC over HTTPS POST |
| Authentication | HTTP **Basic**, `Authorization: Basic base64(login:password)`. Login is typically `Paycom`; password is the cashbox key. |
| Amount unit | **tiyin** (1 so'm = 100 tiyin) |
| Transaction states | `1` created / awaiting confirmation · `2` performed · `-1` cancelled from state 1 · `-2` cancelled after being performed |
| Cancel reasons | `1` receiver not found/inactive · `2` debit error · `3` execution error · `4` timeout · `5` refund · `10` unknown |
| Timeout cancellation | 12 hours = `43_200_000` ms after creation; becomes state `-1`, reason `4` |
| Timestamps | Unix **milliseconds** |
| Retries | Payme repeats `CreateTransaction` / `PerformTransaction` / `CancelTransaction` with the same params; **the repeat must return the same result as the first call** |
| General errors | `-32300` non-POST · `-32700` JSON parse · `-32600` bad RPC fields · `-32601` unknown method · `-32504` insufficient privileges (auth) · `-32400` internal |
| Merchant errors | `-31001` wrong amount · `-31003` transaction not found · `-31007` cannot cancel, service already delivered · `-31008` operation not possible in this state · `-31050…-31099` account errors (localized `message` required, `data` = account subfield name) |
| Checkout (GET) | `<checkout_url>/base64(params)`, `;` separated, `key=value`: `m` merchant id · `ac.<field>` account object · `a` amount in tiyin · `l` language · `c` return URL · `ct` callback timeout · `cr` ISO currency |
| Checkout hosts | production `https://checkout.paycom.uz`; test cabinet `https://checkout.test.paycom.uz` |
| Source IPs | `185.234.113.1` … `185.234.113.15` (documented; enforcement belongs at the edge/proxy, not in app code) |
| Fiscalization | Optional `detail.items[]` with `code` (IKPU), `package_code`, `vat_percent`, `units` — **required only when the merchant is configured for fiscalization** |

## C. Decisions

1. **Domain separation is absolute.** `EnrollmentStatus` is untouched. Payment has its own `payment_status` enum. `enrollment = accepted` + `payment = pending` is a normal, expected state.

2. **Payment lifecycle: `pending | succeeded | cancelled | failed`.** No extra initial state — a payment row *is* the obligation, and Payme's own transaction state lives on the attempt row, not here. No refund status, because refunds do not exist.

3. **Two tables.** `payments` (our obligation, provider-agnostic) and `payment_transactions` (one row per Payme transaction, holding `provider_transaction_id`, Payme `state`, and cancel `reason`). Collapsing them would make Payme's state machine leak into the payment domain.

4. **Money is `bigint` tiyin.** `courses.price_uzs` is int32 so'm; ×100 overflows int32, so `amount_tiyin` is `bigint`. Conversion helpers in `src/lib/money.ts` are pure, integer-only and unit-tested. Amount is **never** accepted from the browser.

5. **Price snapshot.** `payments.amount_tiyin` is written once at creation from the course price and never recomputed. A later price edit cannot change an existing payment. Tested explicitly.

6. **Account field is `payment_id`.** Payme's `account` object carries our `payments.id`. It is validated against our own records on every call — never trusted.

7. **`FOR UPDATE` on the payment row** is the serialisation point for `PerformTransaction` and `CancelTransaction`, exactly as Phase 13 does for group capacity.

8. **Idempotency is structural, not conditional.** `provider_transaction_id` is UNIQUE; a partial unique index allows at most one live (`pending`/`succeeded`) payment per enrollment. Repeats re-read and return the stored result rather than re-applying effects.

9. **Cancellation after successful payment is blocked** (req 21) because refunds are not implemented. Honest message; no silent cancel, no fake refund.

10. **Payment never touches capacity.** Seats are owned by `enrollment.status = 'accepted'` only. A failed payment does not free a seat.

11. **Production is disabled unless explicitly configured.** `PAYMENT_MODE=disabled|test|production`. `production` requires credentials **and** `NODE_ENV=production`, or boot validation fails. There is no self-made "Payme success" endpoint: tests drive the adapter/service directly.

12. **Fiscalization seam, not fabricated codes.** `detail.items` is emitted only when real IKPU/package/VAT configuration is supplied via env. No invented IKPU codes. Undocumented → omitted.
