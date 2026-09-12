"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireUser } from "../auth/guards";
import { markAllNotificationsRead, markNotificationRead } from "../notification-service";
import { notificationReadSchema, type ActionResult } from "../validation";

/* -------------------------------------------------------------------------- */
/* Notification actions — Phase 13.                                            */
/*                                                                              */
/* Both roles have notifications, so these require a signed-in USER rather than */
/* a specific role. The recipient is always the session user: the service       */
/* matches on (notification id AND user id), so submitting somebody else's id   */
/* updates zero rows. Both actions are idempotent.                              */
/* -------------------------------------------------------------------------- */

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Amal bajarilmadi." };
}

export async function markNotificationReadAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = notificationReadSchema.safeParse({
      notificationId: String(form.get("notificationId") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Noto‘g‘ri bildirishnoma." };
    }

    await markNotificationRead(parsed.data.notificationId, user.id);
    revalidatePath("/notifications");
    return { ok: true };
  } catch (error) {
    return failure("markNotificationReadAction", error);
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await markAllNotificationsRead(user.id);
    revalidatePath("/notifications");
    return { ok: true };
  } catch (error) {
    return failure("markAllNotificationsReadAction", error);
  }
}
