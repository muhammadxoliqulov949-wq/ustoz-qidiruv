import { notFound } from "next/navigation";

/* Catch-all for unknown nested dashboard routes. Without it an unmatched
 * /dashboard/<anything> escapes the dashboard segment and renders the global
 * 404 without the shell; this keeps the honest in-shell not-found (and the
 * real 404 status) for every wrong URL under the student cabinet. */
export default function DashboardCatchAll(): never {
  notFound();
}
