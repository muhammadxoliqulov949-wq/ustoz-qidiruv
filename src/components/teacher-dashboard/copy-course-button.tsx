"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui";
import { copyCourseToDraftAction } from "@/server/actions/course-manage";

/**
 * "Copy into a new draft". Sends only the course id; the server verifies
 * ownership, creates a private draft with a fresh slug and never touches the
 * original. On success we go straight to the new draft's editor.
 */
export function CopyCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    startTransition(async () => {
      const form = new FormData();
      form.set("courseId", courseId);
      const result = await copyCourseToDraftAction(form);
      if (result.ok && result.data) {
        router.push(`/teacher/dashboard/courses/${result.data.courseId}/edit`);
        return;
      }
      setError(result.ok ? null : (result.message ?? "Nusxa olinmadi."));
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={pending}>
        <Copy aria-hidden="true" className="me-1 size-4" />
        Nusxadan yangi qoralama
      </Button>
      {error ? (
        <span role="alert" className="text-sm text-red-700">
          {error}
        </span>
      ) : null}
    </>
  );
}
