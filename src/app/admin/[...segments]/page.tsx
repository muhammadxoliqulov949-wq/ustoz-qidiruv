import { notFound } from "next/navigation";

/* Catch-all for unknown nested admin routes: without it an unmatched
 * /admin/<anything> leaves the segment, escapes this layout and renders the
 * global 404 without the admin shell — the navigation would vanish and the
 * wrong URL would look like the whole site failed. Same pattern as the student
 * and teacher areas. */
export default function AdminCatchAll(): never {
  notFound();
}
