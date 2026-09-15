"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError, requireUser } from "../auth/guards";
import {
  getOrCreateEnrollmentConversation,
  sendMessage,
} from "../messaging-service";
import {
  openConversationSchema,
  sendMessageSchema,
  type ActionResult,
} from "../validation";
import { conversationHref, conversationsHref } from "@/lib/messaging";

/* -------------------------------------------------------------------------- */
/* Messaging actions — Phase 16.                                               */
/*                                                                              */
/* THIN ON PURPOSE. Each one authenticates, validates an intent-shaped payload  */
/* and delegates to messaging-service.ts, which owns the lock, the participant  */
/* derivation, the writability check and the notification. Nothing about WHO    */
/* the caller is comes from the payload: identity is the session cookie.        */
/* -------------------------------------------------------------------------- */

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Amalni bajarib bo‘lmadi." };
}

/**
 * Both dashboards change when a message lands: the two conversation lists, the
 * thread itself, the nav unread badges and the notification surface.
 */
function revalidateMessagingSurfaces(conversationId: string): void {
  revalidatePath("/dashboard/messages");
  revalidatePath(`/dashboard/messages/${conversationId}`);
  revalidatePath("/teacher/dashboard/messages");
  revalidatePath(`/teacher/dashboard/messages/${conversationId}`);
  revalidatePath("/dashboard");
  revalidatePath("/teacher/dashboard");
  revalidatePath("/notifications");
}

/**
 * Open (or fetch) the conversation for an enrollment request, then go there.
 *
 * This is the ONLY way a conversation comes into existence, and it cannot be
 * aimed at a person: the payload names an enrollment the caller already
 * belongs to, and the service derives both participants from it.
 */
export async function openConversationAction(form: FormData): Promise<ActionResult> {
  let target: string | null = null;
  try {
    const user = await requireUser();
    const parsed = openConversationSchema.safeParse({
      enrollmentRequestId: String(form.get("enrollmentRequestId") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Noto‘g‘ri so‘rov identifikatori." };
    }

    const result = await getOrCreateEnrollmentConversation(parsed.data.enrollmentRequestId, user.id);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    const { conversationId, created, role } = result.data!;
    target = conversationHref(role, conversationId);
    if (!target) throw new Error("unreachable");
    if (created) {
      // A brand-new thread changes both lists.
      revalidatePath(conversationsHref(role));
      revalidatePath("/dashboard");
      revalidatePath("/teacher/dashboard");
    }
  } catch (error) {
    return failure("openConversationAction", error);
  }

  // Outside the try/catch: `redirect()` signals by throwing.
  redirect(target);
}

/**
 * Send one message from the composer island.
 *
 * Returns a typed result the island turns into a live-region announcement; the
 * page itself re-renders from the database on the next request, and the
 * revalidation above makes that immediate.
 */
export async function sendMessageAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = sendMessageSchema.safeParse({
      conversationId: String(form.get("conversationId") ?? ""),
      body: String(form.get("body") ?? ""),
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Xabar matnini kiriting.";
      return { ok: false, code: "invalid_input", message, fieldErrors: { body: message } };
    }

    const result = await sendMessage(parsed.data.conversationId, user.id, parsed.data.body);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateMessagingSurfaces(parsed.data.conversationId);
    return { ok: true };
  } catch (error) {
    return failure("sendMessageAction", error);
  }
}
