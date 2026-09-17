"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireAdmin, requireUser } from "../auth/guards";
import { createSupportTicket, transitionSupportTicket } from "../support-service";
import {
  fieldErrorsFrom,
  supportTicketSchema,
  supportTicketTransitionSchema,
  type ActionResult,
} from "../validation";

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Murojaat amali bajarilmadi." };
}

export async function createSupportTicketAction(form: FormData): Promise<ActionResult<{ ticketId: string }>> {
  try {
    const user = await requireUser();
    const relatedTypeRaw = String(form.get("relatedEntityType") ?? "");
    const relatedIdRaw = String(form.get("relatedEntityId") ?? "").trim();
    const parsed = supportTicketSchema.safeParse({
      category: String(form.get("category") ?? ""),
      message: String(form.get("message") ?? ""),
      relatedEntityType: relatedTypeRaw === "" ? null : relatedTypeRaw,
      relatedEntityId: relatedIdRaw === "" ? null : relatedIdRaw,
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: parsed.error.issues[0]?.message ?? "Murojaat ma’lumotlarini tekshiring.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }
    const result = await createSupportTicket({
      reporterUserId: user.id,
      ...parsed.data,
    });
    if (!result.ok) return result;
    revalidatePath("/support");
    revalidatePath("/admin");
    revalidatePath("/admin/support");
    revalidatePath("/notifications");
    return { ok: true, data: result.data };
  } catch (error) {
    return failure("createSupportTicketAction", error) as ActionResult<{ ticketId: string }>;
  }
}

export async function transitionSupportTicketAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = supportTicketTransitionSchema.safeParse({
      ticketId: String(form.get("ticketId") ?? ""),
      status: String(form.get("status") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Murojaat holati noto‘g‘ri." };
    }
    const result = await transitionSupportTicket({
      ticketId: parsed.data.ticketId,
      status: parsed.data.status,
      adminUserId: admin.id,
    });
    if (!result.ok) return result;
    revalidatePath("/admin");
    revalidatePath("/admin/support");
    revalidatePath(`/admin/support/${parsed.data.ticketId}`);
    revalidatePath("/support");
    revalidatePath("/notifications");
    return { ok: true };
  } catch (error) {
    return failure("transitionSupportTicketAction", error);
  }
}
