"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireRole } from "../auth/guards";
import { transitionOwnedCourse } from "../course-lifecycle-service";
import { courseLifecycleSchema, type ActionResult } from "../validation";

export async function transitionCourseLifecycleAction(form: FormData): Promise<ActionResult<{ status: string }>> {
  try {
    const user = await requireRole("teacher");
    const parsed = courseLifecycleSchema.safeParse({
      courseId: String(form.get("courseId") ?? ""),
      action: String(form.get("action") ?? ""),
    });
    if (!parsed.success) return { ok: false, code: "invalid_input", message: "Kurs amali noto‘g‘ri." };
    const result = await transitionOwnedCourse({
      courseId: parsed.data.courseId,
      teacherUserId: user.id,
      action: parsed.data.action,
    });
    if (!result.ok) return result;
    revalidatePath("/teacher/dashboard/courses");
    revalidatePath("/courses");
    revalidatePath("/teachers");
    return { ok: true, data: { status: result.data.status } };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
    console.error("transitionCourseLifecycleAction failed", { code: (error as { code?: string }).code ?? "unknown" });
    return { ok: false, code: "server_error", message: "Kurs amali bajarilmadi." };
  }
}
