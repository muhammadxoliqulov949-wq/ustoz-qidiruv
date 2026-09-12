# Phase 13 — architecture decisions (recorded before implementation)

## Audit findings

| Area | Phase 12 state | Consequence for Phase 13 |
|---|---|---|
| `enrollment_status` enum | `submitted`, `cancelled` | Needs `accepted`, `rejected`. |
| `enrollment_requests` | Composite FK `(group_id, course_id)` → `course_groups(id, course_id)` already makes "group belongs to another course" impossible. Indexes on student and course. | Reuse the FK; add a group+status index for the capacity count. |
| Duplicate guard | `unique(student_user_id, group_id, status)` | **Flawed for Phase 13.** With four statuses a student could hold `submitted` *and* `accepted` rows for the same group simultaneously. Replace with a **partial unique index** over live statuses only. |
| Capacity | `liveSeats()` in `public-repo.ts` counts `submitted` rows | Must switch to counting `accepted` rows (spec §3/§18). |
| Teacher requests page | Read-only list, no actions, plus a legacy Phase 7 local prototype panel | Becomes the real management surface. |
| Student requests | Read-only list + cancel (any status, including already-cancelled) | Needs the four statuses and a guarded transition. |
| Cancel action | Updates without checking current status — cancelling twice "succeeds" | Must go through the transition contract. |
| Guards | `requireRole` / `requireRolePage`, session-only identity | Reuse unchanged. |
| Header | Already a client component | Do **not** add a notification dropdown there; use a dedicated `/notifications` route (spec §13 allows and prefers this). |

## Decisions

1. **Status model** — exactly four: `submitted`, `accepted`, `rejected`, `cancelled`. No `paid`/`completed`/`expired`/`waitlisted`.

2. **Transition contract** — one pure module, `src/lib/enrollment-status.ts`, exporting the allowed
   `(actor, from) → to` set. Server actions consult it; **no UI component decides legality**, it only
   renders what the contract reports. Allowed:
   - student: `submitted → cancelled`, `accepted → cancelled`
   - teacher: `submitted → accepted`, `submitted → rejected`
   Everything else (including `rejected → accepted`, `cancelled → *`, `accepted → rejected`) is forbidden.

   Student withdrawal from `accepted` **is** allowed (spec §10 prefers it): the seat is released
   naturally because occupancy is derived.

3. **Capacity** — occupancy is `count(status = 'accepted')`, derived at read time. **No stored
   counter, no decrement.** `available = max(0, capacity - accepted)`. Submitted requests do not
   consume seats.

4. **Concurrency** — acceptance runs in a transaction that first takes a row lock on the group
   (`SELECT … FOR UPDATE`), then counts accepted rows, then updates. Two racing acceptances for the
   last seat serialise on that lock, so exactly one wins and the other gets a deterministic
   `capacity_full` error. A `SELECT` count alone would not be safe under `READ COMMITTED`.

5. **Duplicate rule** — a student may hold **at most one live request per group**, where "live"
   means `submitted` or `accepted`. Enforced by a partial unique index, so it holds even against a
   race. `rejected`/`cancelled` rows do not block re-applying.

6. **Notifications** — real `notifications` table, in-app only. Types limited to what actually
   fires: `enrollment_submitted`, `enrollment_accepted`, `enrollment_rejected`,
   `enrollment_cancelled`. Always scoped to the session user; `userId` never comes from the client.

7. **History** — dedicated `enrollment_events` table (`from_status`, `to_status`, `actor_user_id`).
   Preferred over scattering timestamp columns. Not exposed publicly. **No** `acceptedAt`/
   `rejectedAt`/`cancelledAt` columns — that would duplicate what the event row already records
   (spec §16 says only if it simplifies queries; it does not).

8. **Request detail** — a real route, `/teacher/dashboard/requests/[requestId]`, not a modal:
   refreshable, deep-linkable, and authorization happens server-side before render.

9. **Privacy** — the student's **phone is never selected** into any teacher-facing query. Name,
   course, group, schedule, note, date and status only. No enrollment data on public pages.

10. **Payment** — untouched. Accepted paid courses say the workflow succeeded and that payment is
    not connected yet. No provider names, no card UI, no receipt.
