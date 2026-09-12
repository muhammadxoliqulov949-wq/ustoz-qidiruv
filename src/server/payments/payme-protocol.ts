/* -------------------------------------------------------------------------- */
/* Payme Merchant API — protocol constants and pure helpers.                   */
/*                                                                              */
/* Everything in this file is transcribed from the CURRENT official docs at     */
/* developer.help.paycom.uz (verified during Phase 14, not recalled):           */
/*                                                                              */
/*   • Methods    — CheckPerformTransaction, CreateTransaction,                 */
/*                  PerformTransaction, CancelTransaction, CheckTransaction,    */
/*                  GetStatement.                                               */
/*   • Transport  — JSON-RPC over HTTPS POST.                                   */
/*   • Auth       — HTTP Basic: `Authorization: Basic base64(login:password)`.  */
/*   • Amounts    — integer TIYIN.                                              */
/*   • Timestamps — unix MILLISECONDS.                                          */
/*   • Timeout    — Payme auto-cancels an unperformed transaction after 12h.    */
/*                                                                              */
/* This module is PURE: no database, no environment, no I/O. That keeps the     */
/* protocol independently testable and keeps secrets out of it entirely.        */
/* -------------------------------------------------------------------------- */

/** The six methods a merchant must implement. Used as the method whitelist. */
export const PAYME_METHODS = [
  "CheckPerformTransaction",
  "CreateTransaction",
  "PerformTransaction",
  "CancelTransaction",
  "CheckTransaction",
  "GetStatement",
] as const;

export type PaymeMethod = (typeof PAYME_METHODS)[number];

export function isPaymeMethod(value: unknown): value is PaymeMethod {
  return typeof value === "string" && (PAYME_METHODS as readonly string[]).includes(value);
}

/**
 * Transaction states, exactly as the protocol defines them.
 *
 * Note these are the PROVIDER's states, stored verbatim on
 * `payment_transactions.state`. They are intentionally NOT reused as our own
 * payment status — see src/lib/payment-status.ts.
 */
export const PAYME_STATE = {
  /** Created, awaiting confirmation. */
  CREATED: 1,
  /** Performed successfully. */
  PERFORMED: 2,
  /** Cancelled while still in state 1. */
  CANCELLED: -1,
  /** Cancelled after having been performed. */
  CANCELLED_AFTER_PERFORM: -2,
} as const;

export type PaymeState = (typeof PAYME_STATE)[keyof typeof PAYME_STATE];

/** Documented cancellation reasons. */
export const PAYME_REASON = {
  RECEIVER_NOT_FOUND: 1,
  DEBIT_ERROR: 2,
  EXECUTION_ERROR: 3,
  TIMEOUT: 4,
  REFUND: 5,
  UNKNOWN: 10,
} as const;

/**
 * Error codes. Improvising any of these would break certification, so they are
 * transcribed verbatim rather than invented.
 */
export const PAYME_ERROR = {
  /** Request method was not POST. */
  NOT_POST: -32300,
  /** JSON could not be parsed. */
  PARSE: -32700,
  /** Required RPC fields missing or wrong type. */
  INVALID_REQUEST: -32600,
  /** Unknown method. The method name goes in `data`. */
  METHOD_NOT_FOUND: -32601,
  /** Insufficient privileges — this is what a failed Basic auth returns. */
  UNAUTHORIZED: -32504,
  /** Internal/system error (DB down, undefined behaviour, ...). */
  INTERNAL: -32400,

  /** Transaction amount does not match the order amount. */
  WRONG_AMOUNT: -31001,
  /** Transaction not found. */
  TRANSACTION_NOT_FOUND: -31003,
  /** Cannot cancel: the service was fully delivered. */
  CANNOT_CANCEL: -31007,
  /** The transaction's state does not permit this operation. */
  CANNOT_PERFORM: -31008,
  /**
   * Account-input errors occupy -31050…-31099. The docs require a localized
   * `message` and a `data` field naming the offending `account` subfield.
   */
  ACCOUNT_NOT_FOUND: -31050,
} as const;

/**
 * The account subfield this merchant expects inside Payme's `account` object.
 * Configured on the Payme side as the cashbox's Account parameter, and checked
 * against our own records on every call — never trusted as an authorization.
 */
export const PAYME_ACCOUNT_FIELD = "payment_id";

/** Payme auto-cancels an unperformed transaction after 12 hours. */
export const PAYME_TRANSACTION_TIMEOUT_MS = 43_200_000;

/* ------------------------------ JSON-RPC types ----------------------------- */

export interface PaymeRpcRequest {
  /** Echoed back on the response. May be a number or a string. */
  id: number | string | null;
  method: string;
  params: Record<string, unknown>;
}

export interface PaymeRpcErrorBody {
  code: number;
  /** Localized message. Required for account errors; harmless elsewhere. */
  message: string | { ru: string; uz: string; en: string };
  /** For account errors, the offending subfield name. For -32601, the method. */
  data?: string;
}

export type PaymeRpcResponse =
  | { jsonrpc: "2.0"; id: number | string | null; result: unknown }
  | { jsonrpc: "2.0"; id: number | string | null; error: PaymeRpcErrorBody };

/**
 * Localized error messages.
 *
 * The protocol requires a localized `message` object for account errors, so
 * every error we emit carries all three languages. These strings describe the
 * PROTOCOL condition for Payme's operators — they are not product UI copy and
 * are never shown to a student.
 */
export const PAYME_MESSAGES: Record<number, { ru: string; uz: string; en: string }> = {
  [PAYME_ERROR.WRONG_AMOUNT]: {
    ru: "Неверная сумма.",
    uz: "Noto‘g‘ri summa.",
    en: "Invalid amount.",
  },
  [PAYME_ERROR.TRANSACTION_NOT_FOUND]: {
    ru: "Транзакция не найдена.",
    uz: "Tranzaksiya topilmadi.",
    en: "Transaction not found.",
  },
  [PAYME_ERROR.CANNOT_CANCEL]: {
    ru: "Невозможно отменить транзакцию.",
    uz: "Tranzaksiyani bekor qilib bo‘lmaydi.",
    en: "Unable to cancel transaction.",
  },
  [PAYME_ERROR.CANNOT_PERFORM]: {
    ru: "Невозможно выполнить операцию.",
    uz: "Amalni bajarib bo‘lmaydi.",
    en: "Unable to perform operation.",
  },
  [PAYME_ERROR.ACCOUNT_NOT_FOUND]: {
    ru: "Заказ не найден.",
    uz: "Buyurtma topilmadi.",
    en: "Order not found.",
  },
  [PAYME_ERROR.UNAUTHORIZED]: {
    ru: "Недостаточно привилегий для выполнения метода.",
    uz: "Metodni bajarish uchun huquqlar yetarli emas.",
    en: "Insufficient privileges to perform the method.",
  },
  [PAYME_ERROR.METHOD_NOT_FOUND]: {
    ru: "Запрашиваемый метод не найден.",
    uz: "So‘ralgan metod topilmadi.",
    en: "Requested method not found.",
  },
  [PAYME_ERROR.INVALID_REQUEST]: {
    ru: "Неверный запрос.",
    uz: "Noto‘g‘ri so‘rov.",
    en: "Invalid request.",
  },
  [PAYME_ERROR.PARSE]: {
    ru: "Ошибка парсинга JSON.",
    uz: "JSON tahlil qilishda xatolik.",
    en: "JSON parse error.",
  },
  [PAYME_ERROR.NOT_POST]: {
    ru: "Метод запроса должен быть POST.",
    uz: "So‘rov metodi POST bo‘lishi kerak.",
    en: "Request method must be POST.",
  },
  [PAYME_ERROR.INTERNAL]: {
    ru: "Внутренняя ошибка.",
    uz: "Ichki xatolik.",
    en: "Internal error.",
  },
};

export function paymeError(
  id: number | string | null,
  code: number,
  data?: string,
): PaymeRpcResponse {
  const message = PAYME_MESSAGES[code] ?? PAYME_MESSAGES[PAYME_ERROR.INTERNAL];
  const error: PaymeRpcErrorBody = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}

export function paymeResult(id: number | string | null, result: unknown): PaymeRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Read our payment id out of Payme's `account` object.
 *
 * Returns null when absent or malformed; the caller turns that into an
 * account error (-31050) rather than trusting whatever arrived.
 */
export function readAccountPaymentId(params: Record<string, unknown>): string | null {
  const account = params.account;
  if (typeof account !== "object" || account === null) return null;
  const value = (account as Record<string, unknown>)[PAYME_ACCOUNT_FIELD];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  // Bounded: an id is short. This also stops a megabyte string reaching the DB.
  if (trimmed.length === 0 || trimmed.length > 64) return null;
  return trimmed;
}

/** Read the provider transaction id (`params.id`). */
export function readTransactionId(params: Record<string, unknown>): string | null {
  const value = params.id;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return null;
  return trimmed;
}

/** Read a unix-millisecond timestamp supplied by Payme. */
export function readTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}
