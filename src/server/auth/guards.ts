import "server-only";
import { redirect } from "next/navigation";
import { withNext } from "@/lib/safe-next";
import { getCurrentUser, type SessionUser } from "./session";

/* -------------------------------------------------------------------------- */
/* Authorization guards — Phase 11.                                            */
/*                                                                              */
/* THE ONLY SOURCE OF IDENTITY IS THE SESSION COOKIE.                          */
/* Nothing in this module accepts a user id, role or teacher id from a client:  */
/* not from localStorage, not from a hidden input, not from the URL, not from   */
/* React state. Every server action and every protected page funnels through    */
/* these helpers, so an IDOR would require forging a server-verified session.   */
/*                                                                              */
/* Redirect targets are built with the existing safe-next parser, so the auth   */
/* handoff cannot be turned into an open redirect.                              */
/* -------------------------------------------------------------------------- */

export type Role = "student" | "teacher";

export class AuthError extends Error {
  constructor(
    readonly code: "unauthenticated" | "forbidden",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Page guard: anonymous → /login?next=<safe current path>. */
export async function requireUserPage(currentPath: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user === null) redirect(withNext("/login", currentPath));
  return user;
}

/** Page guard with a role requirement; wrong role → the honest role notice. */
export async function requireRolePage(
  role: Role,
  currentPath: string,
): Promise<SessionUser> {
  const user = await requireUserPage(currentPath);
  if (user.role !== role) {
    redirect(role === "teacher" ? "/dashboard?role=teacher-required" : "/teacher/dashboard?role=student-required");
  }
  return user;
}

/** Mutation guard: throws a typed error instead of redirecting. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user === null) {
    throw new AuthError("unauthenticated", "Bu amal uchun tizimga kirish kerak.");
  }
  return user;
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) {
    throw new AuthError(
      "forbidden",
      role === "teacher"
        ? "Bu amal faqat ustoz hisobida bajariladi."
        : "Bu amal faqat o‘quvchi hisobida bajariladi.",
    );
  }
  return user;
}
