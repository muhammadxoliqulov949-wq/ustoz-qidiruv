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

/** Roles a product surface can require. `admin` is deliberately excluded: an
 *  admin surface uses `requireAdminPage` / `requireAdmin`, not `requireRole`. */
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
    /*
     * Phase 15: an ADMIN is never bounced between the student and teacher
     * cabinets. Admins have exactly one area, so they are sent to it.
     * An admin account has no student/teacher profile row at all, so letting
     * them through here would render an empty, misleading dashboard.
     */
    if (user.role === "admin") redirect("/admin");
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

/* --------------------------------- admin ---------------------------------- */

/* -------------------------------------------------------------------------- */
/* ADMIN AUTHORIZATION — Phase 15.                                             */
/*                                                                             */
/* An admin is an account whose `users.role` row says `admin`, resolved from    */
/* the session cookie on every request. There is no client role claim to trust: */
/* `roleSchema` (validation.ts) accepts only student/teacher, so no form, JSON  */
/* body, hidden input or URL parameter can produce an admin identity — the only */
/* way to obtain one is the out-of-band operator CLI in scripts/admin.ts.       */
/*                                                                             */
/* `requireAdminPage` returns null instead of redirecting. The caller renders   */
/* the honest "this area is for admins" notice in-shell. Bouncing a student or  */
/* teacher into their own dashboard would silently swallow a wrong-area request */
/* and teach them nothing; an explicit refusal is both clearer and safer.       */
/* -------------------------------------------------------------------------- */

/** Page guard for /admin: returns the admin session user, or null if not one. */
export async function requireAdminPage(
  currentPath: string,
): Promise<SessionUser | null> {
  const user = await requireUserPage(currentPath);
  return user.role === "admin" ? user : null;
}

/** Mutation guard: throws a typed error for anonymous and non-admin callers. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new AuthError("forbidden", "Bu amal faqat administrator uchun.");
  }
  return user;
}
