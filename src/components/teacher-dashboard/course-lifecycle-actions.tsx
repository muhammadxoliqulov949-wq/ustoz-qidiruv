"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { transitionCourseLifecycleAction } from "@/server/actions/course-lifecycle";
import { COURSE_LIFECYCLE_ACTION_LABEL, type CourseLifecycleAction, type CourseState } from "@/lib/course-moderation";

export function CourseLifecycleActions({ courseId, status }: { courseId: string; status: CourseState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // A live listing must be paused before terminal archival, which makes the
  // visibility change explicit and gives existing enrollment handling one
  // documented transition instead of a hidden jump.
  const actions: CourseLifecycleAction[] = status === "published" ? ["pause"] : status === "paused" ? ["resume", "archive"] : status === "draft" ? ["archive"] : [];
  if (actions.length === 0) return null;

  function run(action: CourseLifecycleAction) {
    const warning = action === "archive"
      ? "Kurs arxivlanadi va katalogga qaytmaydi. Yozilishlar hamda to‘lov tarixi saqlanadi. Davom etilsinmi?"
      : action === "pause"
        ? "Kurs katalogdan vaqtincha yashiriladi. Davom etilsinmi?"
        : "Kurs katalogga qaytariladi. Davom etilsinmi?";
    if (!window.confirm(warning)) return;
    const form = new FormData();
    form.set("courseId", courseId);
    form.set("action", action);
    setError(null);
    startTransition(async () => {
      const result = await transitionCourseLifecycleAction(form);
      if (result.ok) router.refresh();
      else setError(result.message ?? "Kurs holati saqlanmadi.");
    });
  }

  return <div className="flex flex-wrap items-center gap-2">{actions.map((action) => <Button key={action} type="button" size="sm" variant={action === "archive" ? "danger" : "outline"} disabled={pending} onClick={() => run(action)}>{pending ? "Saqlanmoqda…" : COURSE_LIFECYCLE_ACTION_LABEL[action]}</Button>)}{error ? <span role="alert" className="text-sm text-danger-ink">{error}</span> : null}</div>;
}
