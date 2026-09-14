# USTOZ — Frontend

Marketplace for finding courses and teachers (Uzbekistan). This repository
implements the approved USTOZ Master Frontend Specification phase by phase:
**Phase 1** foundation (tokens, primitives, header, hero), **Phase 2** the
full homepage, **Phase 3** browse & search (`/courses` results engine +
`/categories` routes), **Phase 4** course detail pages
(`/courses/[slug]`), and **Phase 5** teacher discovery + profiles
(`/teachers`, `/teachers/[slug]`), Phases 6–10 the auth UI, enrollment flow
and both dashboards, and **Phase 11** the real backend: PostgreSQL, migrations,
phone+password authentication, server-side authorization and the enrollment
foundation.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19
- TypeScript (strict)
- Tailwind CSS v4 — design tokens live in CSS (`@theme`), no JS config
- `lucide-react` — single icon library for the whole app
- Self-hosted Inter (`@fontsource-variable/inter`) with system-font fallback

## Commands

```bash
npm run dev         # dev server (0.0.0.0:3000)
npm run build       # production build — offline-safe: fonts are self-hosted
                    # and it needs NO database (no build-time DB queries)
npm run lint        # eslint
npx tsc --noEmit    # typecheck

npm run db:migrate  # apply committed SQL migrations
npm run db:seed     # dev-only: project canonical data into the database
npm run db:reset    # dev-only: drop + migrate + seed
npm run db:generate # regenerate a migration after editing the schema
npm run test:server # backend/auth/authorization/constraint test suite
```

## Design system (Phase 1)

**Source of truth for styling is `src/app/globals.css`** — every color,
spacing step, radius, shadow, motion and breakpoint is a token there.
Components consume tokens via generated utilities (`bg-accent-600`, `p-lg`,
`rounded-pill`, `shadow-raised`, `duration-fast`); hard-coded values outside
the token file are not allowed.

Key decisions:

- Warm canvas `#F7F7F5`, white surfaces, **deep emerald** (`--color-accent-*`)
  as the single accent.
- Ink text scale (`ink-900 … ink-300`) instead of pure black/gray.
- Spacing = the native 4px numeric grid only (`p-6`, `gap-8`, `pt-18`,
  `pt-26` for section rhythm). Named steps (`--spacing-4xl` …) were removed:
  Tailwind v4 resolves bare `max-w-*`/`min-w-*` suffixes against the spacing
  namespace too, and custom keys there silently hijack `max-w-4xl` etc.
  — caught by real-browser QA (shrink-to-fit text collapsing to ~1 word).
- Breakpoints: `xs 416 / sm 640 / md 768 / lg 1024 / xl 1280`; no `2xl` usage —
  content is capped by the container anyway.
- One focus treatment for everything: `focusRing` in `src/lib/utils.ts`.

## Layout

- `site-container` utility: **1280px** max width, page padding
  20px → 32px (md) → 40px (xl).
- Header is `sticky`; at scroll > 8px it morphs into a subtle blurred
  floating surface (`backdrop-blur` + hairline border + `shadow-md`).
- Mobile/tablet (< lg): simple top header (logo + menu). The menu panel holds
  search, nav links, Kirish and the Ustoz bo‘lish CTA.
  **Bottom navigation is intentionally not built yet** (later mobile phase).

## Component inventory

`src/components/ui/` (import via `@/components/ui`):

| Component | Notes |
| --- | --- |
| `Button`, `ButtonLink` | 5 variants × 3 sizes, `loading`, icon slots; `ButtonLink` keeps `<Link>` semantics |
| `IconButton` | requires accessible `label`; `onDark` variant for dark surfaces |
| `Input` | labelled field; hint/error slots; exports the shared `fieldBaseClasses` skin |
| `SearchInput` | `md` (header) / `lg` (results pages) / `xl` (hero); form-wrapped, clearable, submit callback |
| `Badge` | soft/solid tones incl. status dot |
| `Avatar` | initials fallback, status dot, 5 sizes |
| `Card`, `CardMedia`, `LinkCard` | default / interactive / quiet; whole-card link for future listing pages |
| `Pill` | one skin, two shapes: `as="button"` (real hidden checkbox, keyboard/screen-reader friendly) and `as="link"` |
| `SectionHeader` | eyebrow/title/description/action opener for every page section |
| `CourseCard` | 16:10 media, save control, stretched-link title; whole card clickable except the heart; focus ring drawn by Card `focus-within` |
| `TeacherCard` | dominant 5:4 photo, identity + trust band, language chips, course count |
| `CategoryCard` | icon tile + name + course count, stretched link |
| `Rating`, `VerifiedMark` | shared card meta: star readout (`--color-rating`) and accessibility-complete verification mark |
| `SaveButton` | `aria-pressed` toggle, z-above stretched link, stops propagation; persistence arrives with the API phase |

App shell: `navigation/header.tsx`, `navigation/logo.tsx`,
`navigation/mobile-menu.tsx`, `layout/footer.tsx` (light 4-group footer),
`layout/section.tsx` (canonical section rhythm).

## Homepage (Phase 2)

`hero → popular-categories → recommended-courses → format-editorial →
top-teachers → how-it-works → trust-promises → teacher-cta → footer`

All sections are server-rendered from the typed mock layer
(`src/data/models.ts` + `categories.ts` / `courses.ts` / `teachers.ts`).
Icons resolve through `src/components/icons.tsx` (data stores string keys →
lucide components; models stay serializable for the future API). Display
numbers/prices format via `src/lib/format.ts` (SSR-deterministic, no Intl).
Card cover photography and teacher portraits are placeholder mock assets in
`public/media/`. The hero quick-filter row and the header/menu searches
navigate into the Phase 3 results engine (URL is the contract).

## Browse & search (Phase 3)

`/courses` is the discovery surface (Search → Filter → Compare); it opens
with a page title, search field, real filtered count, sort control, a
**264px sticky filter sidebar** (desktop) and a results grid.
`/categories/[slug]` composes the same `CoursesBrowser` with the category
locked in the path; `/categories` is the tile index.

The **URL is the only state**: `q`, `format` (legacy `mode` still parsed),
`level`, `city`, `price=free|paid`, `pmin/pmax`, `schedule`, `rating`,
`sort` are whitelisted by the pure engine in `src/lib/course-search.ts`
(parse → sanitize; serialize omits defaults → canonical URLs). Facets are
single-select — tapping the active option clears it, no “Barchasi” clutter.
Filter links are real `<a href>`s (shareable, right-clickable); a click
routes through `router.replace` inside the `FilterPanel` island so
filtering feels instant and never spams the back-stack; category options
cross routes and keep normal push. Sorting is deterministic: “Tavsiya
etilgan” = curated data order, others are comparators with explicit
tie-breaks (`publishedAt`, then `id`); no fake relevance.
Empty → “Mos kurs topilmadi” panel with clear-filters/clear-search actions.

Islands (all of the client JS on these pages): `filter-panel.tsx` (facet
options + price-range form, shared by sidebar and sheet), `filter-sheet.tsx`
(mobile bottom sheet — `role=dialog`, aria-modal, Escape, backdrop close,
focus trap + return, scroll lock, live “N ta kursni ko‘rsatish” CTA),
`courses-search.tsx` and `url-select.tsx` (native select writing one URL
param). Everything else is server-rendered. No modal library, no new
interaction systems, CourseCard reused unchanged.

Data: 15 mock courses (`courses.ts`; order = recommended sort) cover every
facet value (5 cities, 3 levels, 3 schedules, free/paid, ratings across
4.0/4.5); cities + labels derive from the data; `publishedAt` (ISO,
lexicographically sortable — SSR-deterministic) powers “Eng yangi”.
`notFound()` guards unknown slugs; metadata is per-route with the quoted
query in the title.

## Course detail (Phase 4)

`/courses/[slug]` is the evaluation surface: hero (identity, rating,
teacher, media) + a **solid sticky enrollment card** + six server-rendered
sections — Kurs haqida, Dastur (flat numbered syllabus), Jadval va
guruhlar, Ustoz, Fikrlar, Savol-javob — reached through a restrained
sticky section nav (anchors, IntersectionObserver active state, no tabs).

**Groups are the core interaction.** `CourseGroup` records live in
`course-details.ts`; selection is a URL param (`?group=`) replaced with
`router.replace` (same contract as Phase 3 facets: no back-stack spam,
shareable, reload-safe). The enrollment card’s summary/availability and
the schedule section are two projections of the same server-resolved
value, so they can never drift; full groups (`seatsRemaining: 0`) render
disabled.

**Enrollment stops at the honest handoff**: the CTA opens a dialog (same
a11y recipe as the filter sheet) showing course + group + price and a
Kirish / Ro‘yxatdan o‘tish handoff — routes arrive in Phase 7, nothing
fakes a submitted enrollment or a payment. Mobile trades the rail for a
fixed bottom bar (price + Yozilish) with safe-area padding and page-level
bottom clearance.

Data model: detail content is grouped under `Course.detail`
(`summary`, `longDescription`, `audience`, `learningOutcomes`,
`teachingLanguages`, `pricePeriod`, `groups`, `syllabus`) so list views
keep consuming the light row shape; `courseDetailsById` covers every
course and the merge in `courses.ts` throws at build time if one is
missing. FAQ answers are *generated* from listing fields
(`course-faq.ts`) — venue, seat caps and price wording cannot contradict
the card. Reviews are a deliberately small store (`reviews.ts`); courses
without entries get an honest empty state, and the section never inflates
the listing aggregates. Teachers gained full records (photo, `bio`) in
`teachers.ts`; `/teachers/[slug]` remains a deferred seam (link with
`prefetch={false}`).

## Teacher marketplace (Phase 5)

`/teachers` re-expresses the Phase 3 architecture for a new entity: URL is
the only state (`q`, `subject`, `format`, `city`, `lang`, `rating`, `exp`,
`verified=1`, `sort` — whitelisted + canonical in `src/lib/teacher-search.ts`),
facet pills route through `router.replace` (shareable, refresh-safe, no
back-stack spam), a 264px sticky sidebar on desktop and the same sections
inside an accessible bottom sheet on mobile, live filtered count, removable
chips, deterministic sorts (tie-breaks on reviews/`id`). A price-range
facet is deliberately absent: teachers have no price of their own — only
their courses do.

Teacher browse data is **derived, never duplicated**
(`src/data/teacher-rows.ts`): every teacher row computes its courses,
covered categories/cities/formats and cheapest course price from
`courses.ts`, so a card or profile can never contradict the catalog.
`activeCourses` is derived the same way — it is no longer hand-written.
The registry also validates itself at build time: every `course.teacher.id`
must exist and every teacher needs a `TeacherProfile`
(`teacher-profiles.ts`) — a missing record fails `next build`.

`/teachers/[slug]` is fully server-rendered: hero (portrait, verification,
formats, languages, derived location, trust numbers as displayed on cards),
“Ustoz haqida” + teaching approach, the teacher’s real courses as standard
`CourseCard`s (deep-link back into Phase 4 detail pages), reviews composed
from the SAME course review store (honest empty state otherwise), and a
FAQ generated only from supported facts. The profile’s CTA scrolls to the
course list — there is deliberately no messaging/booking affordance until
those phases ship. Unknown slugs 404.

## Auth + onboarding UI (Phase 6)

`/login`, `/register` and `/onboarding` are a **frontend foundation only**:
there is no auth backend, so no state in this phase ever pretends to be an
authenticated account. `src/lib/onboarding.ts` is the single pure contract —
Uzbek +998 phone normalize/format/validate, the versioned `OnboardingDraft`
codec (defensively re-parsed on every read: whitelist enums, drop unknown
keys, keep only fixed-point phone strings), per-step validators and the
completion CTAs, which reuse the existing browse URL contracts
(`/courses?city=&format=`, `/teachers?city=&format=&lang=`,
`/categories/[slug]`) instead of inventing fake “recommended for you”
results. City/language/category/level option lists are all derived from the
existing catalog data — no second taxonomy.

The only persistence is one namespaced localStorage key
(`ustoz.onboarding.draft.v1`) behind
`useSyncExternalStore` (`components/onboarding/draft-store.tsx`) — a
prototype UI state, not a session: passwords are excluded from the draft
type, a real backend replaces the whole module wholesale, and every auth
screen carries the “Prototip interfeys” notice. Login validates locally,
shows a busy submit state, then the honest “auth service not connected”
notice (no cookies, no redirect pretending to sign in); password recovery
is a clearly-labeled deferred panel.

Registration is role-first (two radio cards, never a dropdown) + name +
phone + password only — teacher professional detail lives in
`/onboarding` exclusively. The wizard (student: 3 steps + skippable;
teacher: 5 required steps incl. a “verification arrives later” honesty
screen + honesty declaration) keeps visible progress, Back/Continue,
Enter-submit, focus-on-step announcements and refresh-resume via the
draft’s furthest step. Completion screens are labeled UI previews; the
teacher one previews the profile from what was typed, with a pending
“Tekshiruv kutilmoqda” badge — never a fake verified state.

All previously dead entry points now resolve to these routes (header,
mobile menu, footer, home CTA → `/login` / `/register?role=teacher`; the
Phase 4 enrollment dialog keeps its architecture and only drops the
`prefetch={false}` seams + updates the stale footnote). Auth pages are
`robots: noindex, follow`.

## Enrollment flow (Phase 7)

`/enroll/[courseSlug]?group=<id>` hosts the enrollment wizard: course/group →
student info → schedule confirmation → review → **honest prototype
submission**. The route is server-resolved like the detail pages: unknown
course 404s; a `?group=` pointing at an unknown or full group never gets
silently replaced — it downgrades to an explicit selection state with a
notice. Selection changes `router.replace` the query (shareable, canonical,
no back-stack spam), so back/forward moves between pages, not steps; the
step itself lives in the client flow and the furthest step resumes on
refresh.

`src/lib/enroll.ts` is the pure contract behind it all (EnrollCourseLite
serialization, `resolveEnrollGroup`, the versioned/defensively-parsed
`ustoz.enroll.draft.v1` codec, per-step validators, the single review
projection, canonical href builders) — components stay presentational. The
enrollment draft is deliberately SEPARATE from the Phase 6 onboarding
draft; it prefills name/phone from it (labeled “Prototip prefill”, never
account data) and structurally cannot hold passwords, tokens or session ids
— QA asserts the raw JSON has none. Auth handoff: Kirish/Ro‘yxatdan links
everywhere carry `?next=`, validated by `lib/safe-next.ts` (internal paths
only — protocol-relative, schemes, backslashes and oversized values are
dropped to null), so register → onboarding can hand the student back into
the exact enroll URL. The Phase 4 enrollment card/dialog were only wired to
the flow (the dialog now leads with “Yozilish shaklini to‘ldirish”
carrying the selected group); nothing else about that surface changed.

Submission semantics: the review CTA flips a UI flag after a short busy
state and shows “So‘rov tayyor.” plus “Backend hali ulanmaganligi sababli
so‘rov ustozga yuborilmadi” — no “yuborildi”, no receipt, no fake seat
hold. Price rows state the payment deferral; free courses show “Bepul” with
no payment step at all. Full groups (seatsRemaining 0) are unselectable with
a text “Joy qolmagan” state, never color-only.

## Student dashboard (Phase 8)

`/dashboard` (overview), `/dashboard/courses` (enrollment requests),
`/dashboard/saved`, `/dashboard/profile` — the STUDENT cabinet. Flat sibling
routes, not nested tabs: each section is independently linkable, gets its own
`<h1>`/metadata and stays a server page. `src/app/dashboard/layout.tsx` is a
server shell (identity card + desktop sidebar rail ≥ lg, scrollable tab strip
< lg, sticky sidebar only on desktop) that mounts `<OnboardingProvider>` once
so every screen reads the SAME Phase 6 draft. The marketing header/footer are
untouched. `dashboard/[...segments]` + `dashboard/not-found.tsx` keep unknown
nested URLs a real 404 rendered inside the shell.

Data flow is derive-only. `src/data/dashboard-catalog.ts` builds one
serializable projection (`DashCatalog`: ids + display strings + the Phase 7
group lite shape) from the canonical `courses`/`teachers`/`categories`
arrays; client islands never import the datasets, so a saved list does not
drag the catalog into the bundle. `src/lib/dashboard.ts` is the pure model
(`toDashRequest`, `savedCourses/savedTeachers`, `profileCompleteness`,
`STUDENT_NAV`, `isActiveNav`) and `components/dashboard/use-student-state.ts`
is the single hook that joins the three prototype stores against it.

Saved state gained its canonical home: `src/lib/saved.ts` (versioned model,
`parseSavedState`, pure `toggleSaved`) + `components/saved/saved-store.ts`
(`ustoz.saved.v1`, `useSyncExternalStore`, cross-tab sync). It stores
**canonical ids only** — course/teacher facts are always re-derived — and the
existing `SaveButton` now reads/writes it (`kind` + `entityId` props), so
there is exactly one saved store app-wide instead of the old per-button
`useState`. Ids that no longer exist in the catalog silently drop out.

Honesty rules: nothing claims a session. The identity area shows the
onboarding draft's name or "Mehmon (profil to‘ldirilmagan)"; a draft with no
role — or the `teacher` role — gets an explicit notice (Phase 9 owns the
teacher panel). Request statuses are only `draft` ("Tugallanmagan qoralama")
and `prepared` ("So‘rov tayyor" + "Backend ulanmagan"); the union has no
accepted/confirmed/paid member. The overview shows counts of real things
(requests, saved items, filled profile fields) and one derived next action —
no hours, streaks, progress rings, certificates or charts. Profile is an
editor over the SAME `StudentAnswers` schema, option taxonomies and
validators as Phase 6, writing through the same draft store (storage format
unchanged; nothing is migrated).

## Conventions

- Server components by default; `"use client"` only where state/events live
  (header, search, pills, save button).
- No per-component styles: compose tokens; new visual values go into
  `globals.css` first.
- Hiding Buttons: use media variants (`max-lg:hidden`), never `hidden` —
  the base `inline-flex` utility outranks plain `hidden` in v4's sort order.
- Navigation data (labels, routes, hero copy) is centralized in
  `src/data/site.ts`.
- Icons: lucide only, never inline SVG.
- Per-link prefetch is declared in nav data (`site.ts`): unbuilt routes set
  `prefetch: false`; built routes omit the flag (/courses, /courses/[slug]
  and /teachers routes since Phase 3–5; /login, /register and
  /onboarding since Phase 6; /enroll/[courseSlug] since Phase 7).

## Deliberately deferred

Auth backend wiring (accounts, sessions, OTP, password recovery — the
Phase 6 screens are UI-only), real enrollment submission (the Phase 7 flow
stops at the honest “request prepared” state; teacher-side request handling,
seat holds and notifications come with the backend), payment integration
(never simulated), the teacher dashboard (Phase 9), real onboarding
persistence (the Phase 8 profile editor still writes the browser-local
prototype draft), cross-device saved state, enrollment request history
(the Phase 7 store holds one draft at a time), course creation (teacher flow deliberately does not collect
it), pagination (catalogs fit one page), messaging, save persistence, real
API, premium motion pass, dark mode evaluation, i18n (`/uz`, `/ru`…),
mobile bottom navigation.


---

# Phase 11 — backend, auth and database

## Stack and why

| Concern | Choice | Rationale |
|---|---|---|
| Database | **PostgreSQL** | Real `CHECK` / composite `FOREIGN KEY` / partial `UNIQUE` constraints, transactions, enums. The data-integrity rules of this product belong in the database, not only in application code. |
| ORM | **Drizzle ORM + drizzle-kit** | TypeScript schema that generates **plain committed SQL** migrations you can read and review. No hidden runtime migration engine, no proprietary platform lock-in, and the driver can be swapped without touching queries. |
| Dev/CI driver | **PGlite** (`@electric-sql/pglite`) | Genuine PostgreSQL 18 compiled to WebAssembly — not a mock and not SQLite. Identical constraint semantics with zero install, which matters because the same migrations must be provable in CI. |
| Prod driver | **`pg`** (node-postgres) | The standard pooled client for a real Postgres server. Selected with `DB_DRIVER=pg`. |
| Password hashing | **argon2id** via `@node-rs/argon2` | Current password-hashing recommendation (memory-hard). `m=19456, t=2, p=1`. No custom crypto anywhere. |
| Sessions | **Opaque DB-backed tokens in an HttpOnly cookie** | Revocable server-side on logout (a JWT is not). No token ever touches `localStorage`. |
| Validation | **Zod** | One `.strict()` schema per mutation, so over-posting is a hard error. |

Deliberately **not** adopted: a hosted auth platform (would own our user model
for a phone-first product with no e-mail), and JWT sessions (cannot be revoked).

## Local setup

```bash
npm install
cp .env.example .env.local   # defaults work as-is for local development
npm run db:migrate
npm run db:seed              # prints a generated dev password unless DEV_SEED_PASSWORD is set
npm run dev
```

No PostgreSQL installation is required: the default `DB_DRIVER=pglite` stores
the database under `.data/pglite` (git-ignored).

## Deployment (Vercel)

**The build needs nothing but the repo.** There is no build-time database
access, so no DB env var is needed to produce a successful `npm run build`.

The **runtime** needs a real PostgreSQL server — the embedded driver is a
development tool and cannot serve a serverless deployment:

- `DB_DRIVER=pg` — required in production (`pglite` writes to a local
  filesystem that serverless platforms do not persist).
- `DATABASE_URL` — a **pooled** connection string (Neon pooler, Supabase
  pgbouncer, Vercel Postgres pooled) with TLS parameters such as
  `?sslmode=require`; there is no separate `ssl` option in the pool. Startup
  fails loudly if `DB_DRIVER=pg` is set without it.
- `AUTH_INSECURE_COOKIES` must stay unset/`0` so session cookies remain
  `Secure`; `DEMO_TEACHER_WORKSPACE` is forced off in production regardless.
- Payments stay off unless configured: `PAYMENT_MODE=disabled` (the default)
  needs no credentials, while enabling it requires `PAYME_MERCHANT_ID` and
  `PAYME_MERCHANT_KEY` or the process refuses to boot. Set `APP_BASE_URL` when
  payments are enabled so the provider return URL can be built server-side.

Schema setup is an explicit operator step, run from a trusted environment —
**never** from the Vercel build and **never** automatically:

```bash
DB_DRIVER=pg DATABASE_URL=<production-url> npm run db:migrate
```

`db:seed` / `db:reset` refuse to run when `NODE_ENV=production`: the canonical
datasets are development fixtures (they create accounts and a demo password),
not production content. A migrated but empty database is a supported state —
listings render their empty state and detail slugs 404 honestly.

## Environment variables

Everything is documented in **`.env.example`** — the only env file in git. Real
values never are.

- `NEXT_PUBLIC_*` — public by definition, inlined into the client bundle.
- Everything else is **server-only**, parsed by `src/server/env.ts`, which
  starts with `import "server-only"`. Importing it from a Client Component is a
  **build error**, which is the mechanical guarantee that `DATABASE_URL` cannot
  reach the browser. `describeEnv()` returns booleans and driver names only, so
  no secret can be logged.

## Database schema

Eight tables (`drizzle/0000_phase11_core.sql`):

`users` · `sessions` · `student_profiles` · `teacher_profiles` · `courses` ·
`course_groups` · `syllabus_modules` · `enrollment_requests`

Integrity is enforced **in the database**, not just in TypeScript:

- `users(id, role)` is `UNIQUE` and is the target of composite foreign keys from
  `student_profiles(user_id, role)` and `teacher_profiles(user_id, role)`, each
  with a `role` CHECK. A student profile attached to a teacher account is
  therefore *impossible to insert*.
- `course_groups(id, course_id)` is `UNIQUE` and is the target of
  `enrollment_requests(group_id, course_id)`: enrolling into a group that
  belongs to a different course cannot be represented.
- `courses_online_no_location` forbids a city/venue on online courses and
  requires a city otherwise.
- `users_password_hash_not_plain` requires the hash to start with `$argon2`.
- Phone format, slug format, price bounds, capacity 1–500, time/date formats and
  a partial `UNIQUE` on live enrollment requests are all CHECK/UNIQUE constraints.

## Migrations vs seed

They are separate on purpose.

- **Migrations** — deterministic, committed, reviewable SQL in `drizzle/`,
  applied by `scripts/db.ts` inside a transaction and recorded in a
  `__migrations` table. Safe to run in production.
- **Seed** — `src/server/db/seed.ts`, **development only** (it refuses to run
  with `NODE_ENV=production`). It is a *one-way projection* of the canonical
  `src/data/*` arrays into the database.

## Which source is canonical (important)

**As of Phase 12 the database is the runtime source of truth for the public
marketplace.** `/courses`, `/courses/[slug]`, `/teachers`, `/teachers/[slug]`
and `/categories/[slug]` read PostgreSQL through `src/server/public-repo.ts`.
There is exactly one active public source; `src/data/*` is now **seed input,
fixture data and static site copy only**.

### `src/data/*` runtime matrix

| Module | Role after Phase 12 |
|---|---|
| `courses.ts`, `teachers.ts` | **Seed-only** for the course/teacher records. The exported *label maps* (`courseFormatLabels`, `courseLevelLabels`, `cityLabel`) remain runtime presentation helpers — they are static vocabulary, not marketplace data. |
| `teacher-rows.ts`, `course-details.ts` | **Seed/reference only.** The equivalent read model is now derived in SQL by `listPublicTeachers()`. |
| `categories.ts` | **Runtime, static taxonomy.** Six fixed categories used for routing, labels and the authoring form. Not marketplace inventory. |
| `reviews.ts` | **Runtime read-only fixtures**, joined to DB courses by stable course id. See "Reviews and FAQ" below. |
| `course-faq.ts`, `teacher-faq.ts` | **Runtime pure functions.** They take a `Course`/`TeacherRow` (now DB-projected) and compute FAQ text. They hold no records. |
| `site.ts` | **Runtime static copy** (page titles, intros, footer). |
| `dashboard-catalog.ts`, `teacher-dashboard.ts`, `teacher-profiles.ts`, `course-authoring.ts` | **Legacy prototype projections.** No longer used by the primary teacher dashboard, which reads the database. Retained for the legacy local-draft editor and option lists. |
| `models.ts` | **Runtime types.** The repository projects DB rows into these exact types. |

The rule that matters: **no public marketplace page imports a canonical
`courses`/`teachers` array at runtime.**

## Course lifecycle and visibility

`draft → ready → published`. Only three values exist, and each one is used:

* `draft` — a teacher's private work in progress.
* `ready` — the teacher marked it finished. **Still private.**
* `published` — in the public catalogue. Requires `published_at` (DB CHECK).

There is **no approval/rejection/suspension workflow and no teacher-facing
publish button**, because no moderation system exists and inventing one would be
fake. A complete draft therefore never publishes itself. Seeded catalogue rows
are inserted as `published`; everything a teacher creates starts as `draft`.

**Visibility is enforced in SQL, not in the UI.** Every public query filters
`status = 'published'`, so a draft is never selected — it does not appear in
listings, search, teacher profiles or any path enumeration, its slug 404s, and
`enrollment` refuses to target it.

Teacher profiles are public only when `is_public` is set *and* they own at least
one published course. **Verification remains honestly `unverified`** for every
seeded and registered teacher; there is no approval workflow to grant it.

## Reviews and FAQ

Reviews stay **read-only fixtures** (`src/data/reviews.ts`), joined to database
courses by stable course id. There is no reviews table, no submission path and
no UI control implying one. Building a reviews table with no way to earn a
review would be a pretend system, so writing reviews is explicitly deferred.
FAQ content is computed by pure functions from the (now DB-backed) course and
teacher records.

## Rendering and caching

| Route | Mode | Why |
|---|---|---|
| `/courses`, `/categories/[slug]` | Dynamic SSR | Results depend on the URL *and* live DB state; a build-time snapshot would go stale the moment a course changes. |
| `/courses/[slug]` | Dynamic SSR | Seat availability is derived from live enrollment rows. **No `generateStaticParams`:** slugs are resolved at request time, so unknown, draft and unpublished slugs 404 then — and a course published *after* the deploy works without a rebuild. |
| `/teachers`, `/teachers/[slug]` | Dynamic SSR | The roster and each profile's course set change at runtime. **No `generateStaticParams`**, same reasoning. |
| All `/dashboard` and `/teacher/dashboard` routes | Dynamic | Account-sensitive; never prerendered. |

**`npm run build` does not require a database.** No route in the app enumerates
DB rows at build time, so `next build` runs with no `DATABASE_URL`, no
`.data/pglite` and no network access, and a paused or unreachable production
database cannot fail a deployment. The database is required **at runtime only**,
where every marketplace read is a request-time query through
`src/server/public-repo.ts`.

Writes call `revalidatePath()` for the affected surfaces (`/courses`,
`/teachers`, the course's public page and the teacher dashboard), so data is not
served stale after an edit.

## Seat availability is derived, never stored

There is no `seats_remaining` column and no occupancy counter. Remaining seats
are computed at read time from real rows. Nothing is optimistically decremented
and no availability number is invented. **Phase 13 corrected the definition:
occupancy counts `accepted` requests only** — see "Capacity model" below.

## Server-side course management

`src/server/actions/course-manage.ts` implements create/update, groups, ordered
syllabus modules, the `draft ⇄ ready` transition and course copy. Every action:

1. requires a teacher session (`requireRole`);
2. parses input with a `.strict()` Zod schema, so `status`, `teacherUserId`,
   `slug`, `position` and `seatsRemaining` are **rejected** if posted;
3. puts ownership in the SQL predicate, so another teacher's row matches nothing
   and id enumeration returns an indistinguishable "not found";
4. wraps multi-row work in a transaction.

Syllabus order is server-owned: `add` computes `max(position)+1`, and a move
sends only an id plus a direction — the server reads the current order and swaps
two positions inside one transaction (parking above the maximum first, because
`position` is unique per course and CHECKed `>= 1`). Copy produces a new private
draft with a fresh unique slug, never mutates the original, and does not carry
over rating, reviews, students, `published_at` or any enrollment state.

Slugs are always server-generated and uniqueness is enforced by a DB constraint;
a client can never supply or claim one, and a slug is not rewritten on edit, so
public URLs stay stable.

## Auth architecture

Phone (`+998XXXXXXXXX`) + password. **No SMS/OTP exists**, so nothing in the UI
claims a code was sent, and there is no hard-coded code and no bypass account.

1. Register/login go through **Server Actions**, which give CSRF protection for
   free (POST + Origin/Host check + unguessable action id) and expose no public
   credential endpoint.
2. Passwords are hashed with argon2id. Login failures return **one generic
   message** for both "no such account" and "wrong password", so the form cannot
   be used to enumerate registered numbers.
3. A 32-byte random token is generated; the **raw token goes in the cookie**, and
   only its **SHA-256 hash** is stored in `sessions`. A database leak does not
   yield usable session tokens.
4. Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` (unless `AUTH_INSECURE_COOKIES=1`
   for local http), `Path=/`, 30-day expiry. Logout **deletes the row**, so a
   copied cookie stops working immediately.

## Authorization model

**The session cookie is the only source of identity.** `getCurrentUser()`,
`requireUser()`, `requireRole()` and `requireRolePage()` never accept a user id,
role or teacher id from the client. Ownership is expressed as part of the SQL
predicate (`WHERE ... AND teacher_user_id = <session user>`) rather than as a
separate check that could be forgotten, and mutation inputs do not even have a
field for "who am I" — `.strict()` rejects the payload if one is supplied.

The Phase 9 **teacher workspace picker no longer exists as an identity source.**
It is off unless `DEMO_TEACHER_WORKSPACE=1`, and it is forced off in production.

## Prototype storage transition

Nothing was silently deleted; existing browser data still parses.

| Key | Status | Notes |
|---|---|---|
| `ustoz.onboarding.draft.v1` | **B — retained, demoted** | Now unsaved-form recovery only. Answers persist to a real profile row on an explicit "save". Never identity. |
| `ustoz.enroll.draft.v1` | **B — retained, demoted** | In-progress form recovery. A signed-in student's submission now writes a real `enrollment_requests` row. |
| `ustoz.saved.v1` | **C — deferred** | Saved courses/teachers stay browser-local; documented as such in the UI. Phase 12. |
| `ustoz.teacher.workspace.v1` | **A — replaced** | Superseded by the session. Read only behind the demo flag; the stored value grants nothing. |
| `ustoz.course.drafts.v1` | **C — retained and labelled (Phase 12)** | Still NOT auto-migrated, not uploaded and not deleted. The teacher dashboard now *detects* these drafts and lists them in a separate "Eski brauzer qoralamalari" section marked "Faqat brauzerda", so nothing silently disappears. A one-click import is deliberately not offered: the prototype draft shape carries no owner identity, so importing it would mean guessing an account. |

## What Phase 12 does NOT implement

Payments · messaging · notifications · an admin dashboard · image upload
infrastructure · a teacher verification/approval workflow (verification stays
honest `unverified`) · seat reservation or seat decrement · a reviews table or
review submission · a teacher-facing publish/moderation workflow · advanced
analytics · enrollment approve/reject (statuses are only `submitted` and
`cancelled`).

---

# Phase 13 — enrollment request management and in-app notifications

Phase 13 closes the loop opened in Phase 11: a student submits a request, the
owning teacher accepts or rejects it, the student sees the real outcome, and
capacity is enforced safely on the server. Decisions produce in-app
notifications. **No payment of any kind is implemented.**

## Enrollment lifecycle

```
              teacher accepts
  submitted ──────────────────▶ accepted
      │                            │
      │ teacher rejects            │ student cancels
      ▼                            ▼
   rejected                    cancelled
      ▲                            ▲
      └──── student cancels ───────┘
            (from submitted)
```

## Allowed transitions (the single contract)

`src/lib/enrollment-status.ts` is the **only** place transition rules exist. It
is pure and dependency-free, so the database tests, the service layer and the UI
all consult the same table. No component decides for itself what a status means.

| Actor   | From        | To          |
| ------- | ----------- | ----------- |
| student | `submitted` | `cancelled` |
| student | `accepted`  | `cancelled` |
| teacher | `submitted` | `accepted`  |
| teacher | `submitted` | `rejected`  |

Everything else is refused, including `rejected → accepted`,
`cancelled → accepted`, `cancelled → rejected` and `accepted → rejected`. A
teacher cannot cancel on a student's behalf, and a student cannot accept or
reject their own request.

`accepted`, `rejected` and `cancelled` are **final**: the UI shows factual
final-state copy instead of disabled buttons, and the server refuses a replayed
decision from a stale page with a typed `invalid_transition` error.

## Capacity model

```
available = capacity − count(requests WHERE status = 'accepted')
```

* A `submitted` request occupies **nothing**. Pending interest never blocks
  another student.
* Cancelling an accepted place restores the seat for free, because availability
  is a `COUNT`, not a stored number that something must remember to decrement.
* Availability is clamped at zero and is never presented as negative.
* The same function (`getAcceptedCounts`) backs the public marketplace, the
  teacher dashboard and the detail page, so the three can never disagree.

### How overbooking is prevented

`acceptRequest` runs entirely inside one transaction, in this order:

1. re-read the request **with ownership in the SQL predicate**;
2. validate the transition against the contract;
3. `SELECT id FROM course_groups WHERE id = ? FOR UPDATE` — the serialisation
   point;
4. read capacity, then count accepted rows;
5. refuse with `capacity_full` if the group is already full;
6. update the row, write an enrollment event, insert the notification.

The row lock is what makes step 4 trustworthy: under `READ COMMITTED` a bare
`COUNT` can go stale between two concurrent accepts. Any failure rolls the whole
thing back, so a notification can never exist for a decision that did not
commit. Capacity safety comes from the database, never from browser timing or a
client-side seat count.

## Duplicate submission rules

A student may hold at most **one live request per group**, where live means
`submitted` or `accepted`. This is enforced by a partial unique index rather
than by application code alone:

```sql
CREATE UNIQUE INDEX enrollment_requests_one_live_per_group
  ON enrollment_requests (student_user_id, group_id)
  WHERE status IN ('submitted', 'accepted');
```

Because it is partial, re-applying after cancelling or being rejected is
allowed. Submission is additionally blocked when the course is not published,
the group does not belong to the course (composite FK), or the group is full.

## Notification architecture

`notifications` is a plain table (`id`, `user_id`, `type`, `title`, `body`,
`href`, `read_at`, `created_at`) with four conservative types that map to real
events: `enrollment_submitted`, `enrollment_accepted`, `enrollment_rejected`,
`enrollment_cancelled`.

* **In-app only.** No email, SMS or push transport exists, and no copy implies
  one.
* Rows are inserted **inside the same transaction** as the status change.
* The UI is a quiet `/notifications` route — not a header dropdown, not a social
  feed. There is **no polling and no websocket layer**; the list is read once per
  navigation, which matches how often these events occur.
* Mark-one-read and mark-all-read are server actions, both idempotent.

## Event history

`enrollment_events` (`enrollment_request_id`, `actor_user_id`, `from_status`,
`to_status`, `created_at`) records every transition. It exists so the teacher
detail page can show an honest history, and it is **never exposed publicly**.
This is deliberately not an admin audit system. No `accepted_at` / `rejected_at`
/ `cancelled_at` columns were added — the event rows already answer those
questions.

## Privacy boundary

* The student's **phone number is never selected** into any teacher-facing
  query, let alone rendered. Contact exchange is not part of this workflow.
* Public course and teacher pages expose only **aggregate availability**. No
  student names, phones, notes or request counts appear on any public surface.
* Notifications are always scoped to the session user. The list query takes the
  id from the session, and mark-as-read matches on `(id AND user_id)` so another
  user's id updates zero rows rather than depending on a check somebody could
  forget.
* Ownership is resolved **in the SQL WHERE clause**, so "does not exist" and
  "not yours" are indistinguishable and request ids leak nothing.

## Payment boundary

Accepting a request means a **place in a group**, nothing more. Payment is a
separate domain, added in Phase 14 — see the Phase 14 section below.

## Layering

```
database  →  enrollment-service.ts  →  server actions  →  UI projection
```

No raw Drizzle queries appear in JSX. Server actions are thin and
**intent-shaped** — `acceptEnrollment(requestId)`, never
`setStatus(requestId, status)`. Mutation inputs are validated with Zod
`.strict()`, and `teacherId`, `studentId`, ownership and target status are never
accepted from the client; identity comes from the session cookie only.

## Commands

```bash
npm run db:migrate       # apply migrations (runs clean from scratch)
npm run db:seed          # non-production demo data
npm run db:reset         # drop, migrate, seed
npm run test:server      # Phase 11/12 DB + security suite   (107 checks)
npm run test:enrollment  # Phase 13 enrollment suite         (67 checks)
npm run build            # production build
```

`npm run test:enrollment` covers five groups — STATUS, CAPACITY, CONCURRENCY,
AUTHORIZATION, NOTIFICATIONS, INTEGRITY — against real PGlite migrations,
including racing accepts on the last seat and the
`capacity 1 → A accepted → B refused → A cancels → B acceptable` scenario.

> Note on the concurrency tests: PGlite executes statements on a single
> connection, so racing accepts interleave cooperatively rather than truly in
> parallel. Those tests prove the invariant `accepted ≤ capacity` holds and that
> the transition re-check is never skipped; the suite additionally asserts that
> `acceptRequest` really does take `FOR UPDATE` on the group row *before*
> counting, which is what keeps the same code correct on a multi-connection
> Postgres.

## What Phase 13 does NOT implement

Chat or messaging · SMS, email or push delivery · an
admin dashboard · waitlists · coupons · course review submission · a teacher
verification workflow · realtime or websocket notifications · notification
preferences.

# Phase 14 — payment foundation and Payme integration

Phase 14 adds the first real payment path: an accepted place on a **paid**
course can be paid for through **Payme Business (Merchant API)**, and the
student's dashboard reflects a payment status that only an authenticated
provider callback can produce.

The single rule everything else follows from:

> **Only an authenticated Payme callback can mark a payment `succeeded`.**
> No browser action, no redirect, no query parameter, and no teacher control
> can produce that state.

## Payment is a separate domain from enrollment

`EnrollmentStatus` did **not** gain a `paid` value. Enrollment answers *"does
this student have a place?"*; payment answers *"has that place been paid for?"*.
They are rendered as two separate facts, so `Qabul qilindi` + `To'lov kutilmoqda`
is a normal, representable state rather than a contradiction.

Consequences that fall out of the separation:

* **Seats are unaffected by payment.** Occupancy is still
  `count(status = 'accepted')`. Paying consumes no extra seat, and a failed or
  cancelled payment does **not** free the seat.
* **Free courses never enter payment infrastructure.** No `payments` row is ever
  created for a course whose `priceUzs` is `0`; the UI simply says
  `Kurs bepul. To'lov talab qilinmaydi.`
* Paying is **not** completing. No label anywhere calls a paying student
  "completed", "graduated" or "certified".

## Money is integer tiyin, never floating point

`src/lib/money.ts` is the only place money is converted. It works in `bigint`
tiyin (1 so'm = 100 tiyin) and refuses anything unsafe — negatives, fractions,
`NaN`, `Infinity`, and values above `MAX_PRICE_SOM` (100 000 000 so'm) which
would risk overflow. `amount_tiyin` is a **bigint** column, because 32-bit
integers overflow at 10^10 tiyin.

`UZS 150 000 → 15 000 000 tiyin`, exactly, with no float ever involved.

## The price snapshot is immutable

The amount is copied into the `payments` row **once**, when the obligation is
created, and nothing ever recomputes it. Editing the course price later cannot
change an existing payment — a property the test suite asserts directly by
raising the price and re-reading the payment.

The amount is always derived **server-side** from the accepted enrollment's
course. The browser sends exactly one value — which enrollment to pay for — and
the Zod schema is `.strict()`, so an invented `amount`, `price`, `currency` or
`returnUrl` field rejects the whole request rather than being ignored.

## Schema

| table | purpose |
| --- | --- |
| `payments` | the obligation: enrollment, student, provider, amount snapshot, currency, status, timestamps |
| `payment_transactions` | one row per **provider** transaction: provider id, Payme state, reason code, timestamps |
| `payment_events` | append-only history with safe metadata only |

Lifecycle: `pending → succeeded | cancelled | failed`. There is deliberately
**no refund status** (see the refund boundary below).

Constraints doing real work (`drizzle/0004_phase14_payments.sql`):

* `payments_one_live_per_enrollment` — partial UNIQUE on `enrollment_request_id`
  `WHERE status IN ('pending','succeeded')`. **This is the concurrency
  guarantee**: two simultaneous "pay" clicks race on this index, the loser
  catches the violation and re-reads the winner's row, so one obligation exists.
* `payment_transactions_provider_tx_unique` — UNIQUE `(provider,
  provider_transaction_id)`. **This is the idempotency key** for callback
  retries.
* `payments_amount_positive`, `payments_currency_supported` (`UZS` only),
  `payments_paid_at_consistent` (`succeeded` ⇔ `paid_at IS NOT NULL`),
  `payment_transactions_state_valid` (`1, 2, -1, -2`).

## Provider abstraction

```
payment-service.ts        provider-agnostic domain (obligations, transitions)
        ↓
provider.ts               the PaymentProvider contract
        ↓
payme-adapter.ts          Payme-specific: auth, six RPC methods, checkout URL
payme-protocol.ts         pure protocol constants (methods, states, error codes)
```

No Payme state value, method name or error code leaks into the enrollment
services or the UI; the dashboard only ever sees our own four statuses. All
Payme specifics are confined to the `payme-*` modules.

## The Payme flow

1. Student clicks `To'lov qilish` on an **accepted, paid** enrollment.
2. The server authenticates the session, verifies ownership and `accepted`
   status, derives the price, creates-or-reuses one obligation, and builds the
   checkout URL — `<checkout_url>/base64("m=…;ac.payment_id=…;a=<tiyin>;l=uz;c=<return>")`.
3. The student pays on Payme's own page. We never see a card.
4. Payme calls our callback, which runs the Merchant API methods.
5. `PerformTransaction` marks the payment `succeeded` and notifies the student.
6. The student returns to `/dashboard/payments/<id>`, which reads the
   **database**.

## Callback route

`POST /api/payments/payme` — `runtime = "nodejs"`, `force-dynamic`, `no-store`,
`X-Robots-Tag: noindex`.

* **POST only.** `GET`/`PUT`/`PATCH`/`DELETE` answer `-32300`.
* **No session cookie required or consulted** — this is a server-to-server
  endpoint.
* Authentication happens **before parsing or any mutation**.
* Request bodies are capped at 16 KB.
* Methods are **whitelisted**; anything else is `-32601`.
* Every response is HTTP 200 with a typed JSON-RPC body, as the protocol
  requires.
* Internal errors never leak detail: they map to `-32400` and we log a code,
  never a secret.

Implemented methods, exactly as specified — `CheckPerformTransaction`,
`CreateTransaction`, `PerformTransaction`, `CancelTransaction`,
`CheckTransaction`, `GetStatement` — with the official states (`1` created, `2`
performed, `-1` cancelled, `-2` cancelled after completion) and the official
error codes (`-31001` wrong amount, `-31003` transaction not found, `-31008`
impossible for current state, `-31050…-31099` account errors with the offending
field named in `data` and a localized `message`).

## Authentication and secrets

Payme authenticates with **HTTP Basic**: `Authorization: Basic
base64(login:password)`, where the password is the cashbox key. We compare both
halves with `timingSafeEqual`, split on the **first** colon only (the key may
contain one), evaluate both comparisons before returning so timing reveals
nothing, and answer every failure mode identically with `-32504`.

Credentials live only in server-side env vars. None of them is prefixed
`NEXT_PUBLIC_`, so Next.js cannot place them in the client bundle — verified by
grepping the built `.next/static` output for the key, which returns nothing. We
never log Authorization headers, the merchant key, session cookies, or full
header dumps, and we never store card numbers, CVV, expiry or Payme user
credentials.

## Idempotency

Payme repeats `CreateTransaction`, `PerformTransaction` and `CancelTransaction`
after a lost response and **requires the repeat to return the same result**. The
sandbox grades this directly.

Each handler reads existing state first and returns the stored answer instead of
re-applying an effect:

* **Create** — an existing provider transaction id is echoed back unchanged; the
  unique index makes a concurrent duplicate impossible.
* **Perform** — runs in ONE transaction: `SELECT … FOR UPDATE` on the payment
  row (the serialisation point) → re-read → if already performed, return the
  same result and write nothing → otherwise mark performed, set `succeeded`,
  stamp `paid_at`, append the event and insert the notification → commit. A
  repeat therefore cannot double-pay or double-notify.
* **Cancel** — an already-cancelled transaction returns its stored result.

Tested: repeated Perform produces byte-identical JSON, exactly one notification
and exactly one success event — over both the service API and real HTTP.

## Cancellation, and the refund boundary

`CancelTransaction` is **Merchant API protocol only**, not a user-facing refund:

* not yet performed → state `-1`, and the obligation becomes `cancelled`;
* already performed → state `-2`, and the payment **stays `succeeded`**, because
  the money really moved and we do not fake a refund.

Per Payme's documentation, customer refunds are performed by the merchant in the
cabinet at `merchant.paycom.uz`, and are only possible *because* we implement
`CancelTransaction`. This product implements no refund UI.

Consequently **an accepted enrollment with a succeeded payment cannot be
self-cancelled.** The refusal is honest rather than silently cancelling while
keeping the money:

> To'langan yozilishni bekor qilish va pulni qaytarish jarayoni hali
> qo'llab-quvvatlanmaydi.

An accepted but **unpaid** enrollment is still freely cancellable. The check
runs inside the cancelling transaction, so a payment confirmed concurrently
cannot slip past it.

## What each role sees

**Student** — `To'lov kutilmoqda` (accepted, nothing started), `To'lov
jarayonda`, `To'lov qilindi`, or factual cancelled/failed wording with a safe
retry. A free accepted place reads `Bepul — to'lov talab qilinmaydi`. A verified
success also produces the notification `To'lov muvaffaqiyatli tasdiqlandi`.

**Teacher** — a minimal factual indicator only: *not required* / *awaiting* /
*paid*. No amount, no provider id, no transaction detail, no payouts, and **no
control to mark anything paid** — there is simply no such action in the
codebase.

The return page `/dashboard/payments/[paymentId]` is also the provider return
URL, which makes one thing critical: **a redirect back is not proof of
payment.** The page reads status from the database, has no `?success=` handling,
and contains no code path that can change a payment's status. Ownership is in
the SQL predicate, so another student's payment id 404s and leaks nothing.

Pages are server-first: no polling loop, no realtime layer, no fake progress
animation, and measured CLS of 0.0002.

## Sandbox vs production

`PAYMENT_MODE` governs the whole subsystem:

| mode | behaviour |
| --- | --- |
| `disabled` | **default.** No payment can be initiated; the UI says so plainly instead of offering a dead button. |
| `test` | Payme sandbox cabinet, using the **test** cashbox key. |
| `production` | Real money. Refused unless `NODE_ENV=production`. |

If `PAYMENT_MODE` is not `disabled` and the merchant id or key is missing,
**startup fails**. Failing to boot is the correct outcome for a half-configured
payment system.

There is no self-made "fake success" endpoint anywhere. The test harness invokes
the adapter and service directly; it cannot bypass authentication over HTTP.

## Environment variables

| variable | meaning |
| --- | --- |
| `PAYMENT_MODE` | `disabled` (default) / `test` / `production` |
| `PAYME_MERCHANT_ID` | cashbox identifier from the merchant cabinet |
| `PAYME_MERCHANT_KEY` | cashbox key — the Basic-auth password Payme calls us with. The most sensitive value in the app. |
| `PAYME_MERCHANT_LOGIN` | Basic-auth login Payme uses (`Paycom` for standard integrations) |
| `PAYME_CHECKOUT_URL` | `https://checkout.paycom.uz` (production) or `https://test.paycom.uz` (sandbox) |
| `APP_BASE_URL` | absolute origin of this app, used to build the return URL **server-side** |

Placeholders are in `.env.example`. No real secret is committed anywhere.

## Fiscalization boundary

`CheckPerformTransaction` may return a `detail` object for fiscalization, whose
`items[]` require a real **ИКПУ** (`code`), `package_code` and `vat_percent`.
Those are merchant-registration data this project does not have, and inventing
them would produce invalid fiscal receipts. The seam is therefore modelled and
documented, `detail` is omitted until the values are configured, and production
stays disabled while unconfigured. **No ИКПУ code is fabricated.**

## CLICK boundary (not implemented)

There is **no CLICK adapter** — a fake one would be a false claim of
multi-provider support. The seam is documented instead: CLICK uses a two-step
`Prepare` / `Complete` callback with a signature (MD5 of a field set) rather
than Basic auth, and its own error codes. Adding it means one new module
implementing the same `PaymentProvider` contract plus a code mapping; the
`provider` enum, the obligation model, the money helpers, the idempotency keys
and the status projection are all already provider-agnostic and would not
change.

## Commands

```bash
npm run test:payments    # Phase 14 payment suite (137 checks)
```

`npm run test:payments` runs against real PGlite migrations and covers MONEY,
DOMAIN, IDEMPOTENCY, PAYME (all six methods plus auth), SECURITY, CANCEL and
STATUS — including cross-student payment attempts, browser amount tampering, the
price snapshot after a price change, callback auth failures, unknown
transactions and accounts, duplicate Create/Perform, concurrent initiation and
concurrent Perform, and IDOR on the payment page.

## What Phase 14 does NOT implement

Refunds · payouts, commissions or split settlement · recurring payments ·
stored cards or any card form · a CLICK, Uzum or other provider adapter · SMS or
email receipts · an admin financial dashboard · fiscal receipt submission.
