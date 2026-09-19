import "server-only";
import { isProduction, serverEnv } from "../env";
import { logError } from "../log";

/* -------------------------------------------------------------------------- */
/* Transactional Email Provider — Phase 23.5.                                  */
/*                                                                              */
/* Abstraction for sending auth and verification emails.                        */
/*   • DevEmailProvider: in development/test or when RESEND_API_KEY is unset,  */
/*     stores sent emails in-memory with zero network calls.                    */
/*   • ResendEmailProvider: in production (or configured dev), calls Resend    */
/*     REST API using server-only credentials.                                  */
/*                                                                              */
/* SENDER DOMAIN SAFETY:                                                        */
/* Never hard-codes any unowned platform domain. Default is                     */
/* `onboarding@resend.dev` for test environments, or the explicitly configured   */
/* `AUTH_EMAIL_FROM`.                                                           */
/* -------------------------------------------------------------------------- */

export interface EmailData {
  name: string;
  verifyUrl: string;
}

export interface EmailProvider {
  sendVerificationEmail(to: string, data: EmailData): Promise<{ success: boolean; error?: string }>;
}

export interface SentEmailRecord {
  to: string;
  name: string;
  verifyUrl: string;
  sentAt: Date;
}

export class DevEmailProvider implements EmailProvider {
  /** In-memory log of sent messages for testing and local inspection. */
  public static sentEmails: SentEmailRecord[] = [];

  public static clear(): void {
    DevEmailProvider.sentEmails = [];
  }

  async sendVerificationEmail(to: string, data: EmailData): Promise<{ success: boolean; error?: string }> {
    DevEmailProvider.sentEmails.push({
      to,
      name: data.name,
      verifyUrl: data.verifyUrl,
      sentAt: new Date(),
    });

    if (!isProduction()) {
      console.log(`[DevEmailProvider] Verification link for ${to}: ${data.verifyUrl}`);
    }

    return { success: true };
  }
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async sendVerificationEmail(to: string, data: EmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [to],
          subject: "USTOZ — Email manzilingizni tasdiqlang",
          text: [
            `Salom, ${data.name}!`,
            "",
            "USTOZ platformasidagi hisobingizni tasdiqlash uchun quyidagi havolani bosing:",
            data.verifyUrl,
            "",
            "Ushbu havola 24 soat davomida amal qiladi.",
            "Agar siz ro‘yxatdan o‘tmagan bo‘lsangiz, ushbu xatni e’tiborsiz qoldiring.",
          ].join("\n"),
          html: [
            `<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">`,
            `  <h2 style="color: #1e293b; margin-bottom: 16px;">Salom, ${data.name}!</h2>`,
            `  <p style="color: #475569; font-size: 16px; line-height: 1.5;">`,
            `    USTOZ platformasidagi hisobingizni tasdiqlash uchun quyidagi tugmani bosing:`,
            `  </p>`,
            `  <div style="margin: 28px 0;">`,
            `    <a href="${data.verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block;">`,
            `      Emailni tasdiqlash`,
            `    </a>`,
            `  </div>`,
            `  <p style="color: #64748b; font-size: 14px; line-height: 1.5;">`,
            `    Yoki havolani brauzeringizga nusxalang:<br>`,
            `    <a href="${data.verifyUrl}" style="color: #2563eb; word-break: break-all;">${data.verifyUrl}</a>`,
            `  </p>`,
            `  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />`,
            `  <p style="color: #94a3b8; font-size: 12px;">`,
            `    Ushbu havola 24 soat davomida amal qiladi. Agar siz ro‘yxatdan o‘tmagan bo‘lsangiz, bu xatni o‘chirib tashlashingiz mumkin.`,
            `  </p>`,
            `</div>`,
          ].join("\n"),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError("Resend delivery failed", { status: response.status, body: errorText });
        return { success: false, error: "email_delivery_failed" };
      }

      return { success: true };
    } catch (error) {
      logError("ResendEmailProvider request failed", error);
      return { success: false, error: "email_delivery_error" };
    }
  }
}

export class UnavailableEmailProvider implements EmailProvider {
  async sendVerificationEmail(): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: "email_service_unavailable" };
  }
}

let customProvider: EmailProvider | null = null;

/** Override provider for unit tests. */
export function setEmailProviderForTesting(provider: EmailProvider | null): void {
  customProvider = provider;
}

/**
 * Returns true if an email provider is configured to deliver emails.
 *   • test / dev: DevEmailProvider allowed when RESEND_API_KEY is unset.
 *   • production: strictly requires RESEND_API_KEY.
 */
export function isEmailDeliveryAvailable(): boolean {
  if (customProvider !== null) return true;
  const env = serverEnv();
  if (env.RESEND_API_KEY) return true;
  return env.NODE_ENV === "test" || env.NODE_ENV === "development";
}

export function getEmailProvider(): EmailProvider {
  if (customProvider !== null) return customProvider;
  const env = serverEnv();
  if (env.RESEND_API_KEY) {
    return new ResendEmailProvider(env.RESEND_API_KEY, env.AUTH_EMAIL_FROM);
  }
  if (env.NODE_ENV === "test" || env.NODE_ENV === "development") {
    return new DevEmailProvider();
  }
  return new UnavailableEmailProvider();
}
