import { notFound } from "next/navigation";

/* Catch-all for unknown nested teacher-dashboard routes: without it an
 * unmatched /teacher/dashboard/<anything> escapes the segment and renders the
 * global 404 without the shell. Same pattern as the Phase 8 student cabinet. */
export default function TeacherDashboardCatchAll(): never {
  notFound();
}
