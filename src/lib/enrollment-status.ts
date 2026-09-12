/* -------------------------------------------------------------------------- */
/* Enrollment status contract — Phase 13.                                      */
/*                                                                              */
/* THE SINGLE SOURCE OF TRUTH for what may happen to an enrollment request.    */
/* Pure, dependency-free and usable from both server actions and UI:           */
/*                                                                              */
/*   • server actions call `canTransition()` before writing, so an illegal      */
/*     move is refused at the mutation boundary;                                */
/*   • UI calls the same helpers purely to decide what to RENDER.               */
/*                                                                              */
/* No component is allowed to decide legality on its own — if a control is      */
/* shown, it is because this table says the transition exists.                  */
/* -------------------------------------------------------------------------- */

export type EnrollmentStatus = "submitted" | "accepted" | "rejected" | "cancelled";

/** Who is attempting the transition. Derived from the session, never posted. */
export type EnrollmentActor = "student" | "teacher";

/**
 * The complete transition table.
 *
 * Student may withdraw from `submitted` AND from `accepted` — withdrawing an
 * accepted place is a real thing students do, and because seat occupancy is
 * DERIVED from accepted rows, the seat is released automatically.
 *
 * Teacher may only decide on a `submitted` request. Everything absent here is
 * forbidden, including `rejected → accepted`, `cancelled → *` and
 * `accepted → rejected` (revoking an accepted place would need its own
 * product workflow and notification, which this phase does not ship).
 */
const TRANSITIONS: Record<EnrollmentActor, Partial<Record<EnrollmentStatus, EnrollmentStatus[]>>> = {
  student: {
    submitted: ["cancelled"],
    accepted: ["cancelled"],
  },
  teacher: {
    submitted: ["accepted", "rejected"],
  },
};

/** True when `actor` may move a request from `from` to `to`. */
export function canTransition(
  actor: EnrollmentActor,
  from: EnrollmentStatus,
  to: EnrollmentStatus,
): boolean {
  return TRANSITIONS[actor][from]?.includes(to) ?? false;
}

/** Every status `actor` may move a request in `from` to. */
export function allowedTransitions(
  actor: EnrollmentActor,
  from: EnrollmentStatus,
): readonly EnrollmentStatus[] {
  return TRANSITIONS[actor][from] ?? [];
}

/** A request no longer awaiting a decision. */
export function isFinalStatus(status: EnrollmentStatus): boolean {
  return status !== "submitted";
}

/**
 * Statuses that OCCUPY A SEAT. Only `accepted` does.
 *
 * `submitted` deliberately does not: a pending request must not block another
 * student, and treating it as occupancy would silently overstate how full a
 * group is.
 */
export const SEAT_OCCUPYING_STATUSES: readonly EnrollmentStatus[] = ["accepted"];

/**
 * Statuses that count as a LIVE request for duplicate detection. A student may
 * hold only one of these per group at a time (enforced by a partial unique
 * index). Rejected and cancelled rows do not block re-applying.
 */
export const LIVE_REQUEST_STATUSES: readonly EnrollmentStatus[] = ["submitted", "accepted"];

/* --------------------------------- display --------------------------------- */

/** Uzbek labels. Used by both dashboards so wording cannot drift. */
export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  submitted: "Yuborilgan",
  accepted: "Qabul qilindi",
  rejected: "Rad etildi",
  cancelled: "Bekor qilindi",
};

/**
 * Honest one-line explanation per status, from the STUDENT's perspective.
 *
 * The accepted copy is explicit that no payment system exists yet, so an
 * accepted place is never mistaken for a paid enrolment.
 */
export const ENROLLMENT_STATUS_NOTE: Record<EnrollmentStatus, string> = {
  submitted: "Ustoz hali ko‘rib chiqmagan.",
  accepted: "Guruhga qabul qilindingiz.",
  rejected: "Ustoz bu so‘rovni rad etdi.",
  cancelled: "So‘rov bekor qilingan.",
};

/** Badge tone. Status is never communicated by colour alone — text accompanies it. */
export function enrollmentStatusTone(
  status: EnrollmentStatus,
): "accent" | "success" | "neutral" {
  if (status === "accepted") return "success";
  if (status === "submitted") return "accent";
  return "neutral";
}
