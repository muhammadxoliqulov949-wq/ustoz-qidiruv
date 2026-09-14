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

# Phase 15 — admin control plane, teacher verification and course moderation

Phase 15 adds the missing half of the marketplace: until now a teacher could
mark a course *ready* but nothing could ever make it *published*, and a teacher
profile could never become *verified*. Both now have a real, audited,
database-backed decision path — and the decision can only be made by an
`admin` account that no public surface can create.

Three rules everything else follows from:

> **1. The `admin` role cannot be obtained from the product.** No registration
> form, onboarding step, server action, hidden input, URL parameter or
> localStorage value can produce it. It is written by one command, run by an
> operator with database access.
>
> **2. A teacher cannot verify or publish themselves.** The submission action
> can only insert a `pending` application; the publish action can only act on a
> live review row. `verified` and `published` are written exclusively in the
> admin decision path — inside a transaction, under a row lock.
>
> **3. A private course never leaks.** `draft` and `ready` are excluded at the
> query level in `public-repo.ts`; publishing changes what the *public* read
> surface returns at request time, with no rebuild.

## Roles

| role | who | dashboard |
| --- | --- | --- |
| `student` | the default account | `/dashboard` |
| `teacher` | an account with a `teacher_profiles` row | `/teacher/dashboard` |
| `admin` | an operator account with **no profile row** | `/admin` |

`user_role` gained `admin` in migration `0005`. The composite foreign keys
(`student_profiles_(user_id, role)` and `teacher_profiles_(user_id, role)`, each
with its own `role = 'student'` / `role = 'teacher'` CHECK) mean the database
itself refuses to turn a profiled account into an admin, and refuses to attach a
marketplace profile to an admin. That is a security property we keep: an operator
account physically cannot own courses, be enrolled as a student, or inherit a
marketplace identity. The practical consequence is documented below.

## Bootstrapping an admin (out-of-band, by design)

```bash
npm run admin:list                                  # who is an admin right now
ADMIN_PASSWORD='…12+ chars…' npm run admin:create -- +998XXXXXXXXX
npm run admin:promote -- +998XXXXXXXXX              # an EXISTING profile-less account
npm run admin:demote  -- +998XXXXXXXXX              # back to student
```

Why a CLI and not a route:

* it is **not reachable over HTTP at all** — there is no endpoint, action or
  page that grants the role, so an escalation attempt has nothing to call;
* it never reads a role from a request; the operator states the target phone
  explicitly and the command implies the role;
* it is the **only** writer of `users.role = 'admin'` in the codebase.

Safety properties:

* **No default admin, no seeded admin, no committed password.** `admin:create`
  requires `ADMIN_PASSWORD` in the environment (≥ 12 characters) and refuses a
  weaker or missing one; it is never interactive, so no password is echoed to a
  shell history or a log. `db:seed` refuses `NODE_ENV=production`.
* **Safe failure.** An unknown phone number changes nothing and says nothing
  about which numbers exist. Output is masked (`+998****233`).
* **`promote` refuses a profiled account** with an explanation instead of
  deleting data to force the update through — the composite role FK would reject
  it anyway, and removing the profile would delete that teacher's courses.
  Use `admin:create` for a dedicated operator account.
* **Production is never seeded.** The dev fixtures below exist only when
  `db:seed` runs outside production.

The two supported ways to get an admin, in order of preference:

1. `admin:create` — a dedicated, profile-less operator account (recommended).
2. `admin:promote` — an existing account that has no profile row.

### Development fixtures (dev seed only)

`npm run db:seed` also creates three teacher accounts for exercising the queues
locally — one verified with a complete profile, one pending with a live
application, one deliberately incomplete:

| fixture | phone | state |
| --- | --- | --- |
| Dilnoza Rahimova | `+998901000013` | `verified` — the owner that can actually publish |
| Javohir Sattorov | `+998901000014` | `pending`, one live application in the queue |
| Kamola Yusupova | `+998901000015` | `unverified`, profile incomplete (the eligibility gate) |

They share the per-run seed password (`DEV_SEED_PASSWORD`, or one printed once by
the seed) — the repository contains no credential of any kind.

## Teacher verification lifecycle

```
unverified ──submit──▶ pending ──approve──▶ verified
    ▲                     │
    └──────reject─────────┘        (with REQUIRED feedback; resubmittable)
```

* **One live application per teacher**, enforced by a partial unique index
  (`teacher_verification_requests_one_pending_per_teacher`). A double submit
  returns `already_pending` and writes nothing.
* **Submission is validated server-side** against a single requirement list
  (name, specialization, city, ≥ 1 language, experience, bio, approach) shared
  by the teacher's screen and the service, so the disabled button and the refusal
  can never disagree. The whole submission runs in one transaction that sets the
  profile to `pending` and inserts the request row.
* **`verified` is written in exactly one place**: `approveVerification`,
  after taking `FOR UPDATE` on the application row. Approving also sets
  `isPublic = true`, otherwise a verified teacher's published course would link
  to a 404 profile.
* **A rejection is not a permanent block.** The profile returns to `unverified`,
  the reviewer's feedback is stored on the request row (visible to the teacher),
  and the teacher can fix the profile and re-apply. History is kept: a rejection
  is a decision, never a ban.
* **No document uploads.** There is no file-upload infrastructure in this phase,
  and every screen says so:
  `Hujjat orqali tekshirish keyingi bosqichda ulanadi.` — the reviewer approves
  on the basis of the profile data shown on the plugin screen.

## Course moderation lifecycle

```
draft ──teacher submits──▶ ready ──admin publishes──▶ published
  ▲                          │
  └──────admin requests changes──────┘   (with REQUIRED feedback)
```

* **`ready` means "sent for review"** and the UI says
  `Ko'rib chiqish uchun yuborilgan`. No screen calls a ready course published.
* **A submission creates exactly one live review**
  (`course_moderation_reviews_one_pending_per_course`, partial unique index),
  idempotently: submitting twice reuses the live review instead of queueing a
  second one.
* **There is no `rejected` course state.** A return is `ready → draft` plus
  feedback; the teacher fixes the course and submits again. Nothing is
  permanently blocked.
* **Submitting requires a group and a syllabus module**, checked inside the
  submission transaction — a course nobody can enrol in cannot enter the queue.
* **A course under review or published is frozen for its teacher.** Every content
  mutation re-checks this server-side (`assertEditable`); the disabled fieldset in
  the editor is convenience, not the control.

### The publication rule (enforced, not suggested)

`publishCourse(reviewId, adminUserId)` succeeds only when **all four** hold, and
re-checks them under `FOR UPDATE` on the review row:

1. the course is `ready` (a decided review is refused, so it can never be
   re-published — `published_at` is not overwritten);
2. a **live** review exists for it (the review id is the only input — there is no
   course-status setter);
3. the owner is a real, active teacher;
4. the owner's verification is **`verified`**.

Rule 4 is the product rule: **a ready course from an unverified teacher stays
private**. The admin sees the reason (`Ustoz tasdiqlanmagan — kursni e'lon qilib
bo'lmaydi.`) and the course stays in the queue; the server refuses regardless of
what the button says.

Publishing writes, in one transaction: `courses.status = 'published'`,
`published_at` (ISO date), the review decision, the reviewer, the audit row and
the teacher's notification.

### Published courses are read-only (Phase 15 limitation)

Once published, a course cannot be edited by its teacher and cannot be
un-published: there is no teacher edit path, no admin "return to draft" for a
live listing, and no auto-unpublish. Editing live marketplace content is a
product decision this phase does not make. The limitation is stated on the
teacher's editor screen and enforced in `assertEditable`.

## Audit log

`admin_audit_events` is **append-only by construction**: it has no `updated_at`
column, no product code issues `UPDATE`/`DELETE` against it, and the four
recorded actions are the decisions themselves —

| action | written by |
| --- | --- |
| `teacher_verified` | approve a verification application |
| `teacher_verification_rejected` | return an application with feedback |
| `course_published` | publish a reviewed course |
| `course_changes_requested` | return a course to its teacher |

Each row stores the acting admin, the entity (`teacher` / `course`), the entity
id, a short machine-readable `metadata` string (≤ 300 characters, e.g.
`verification=verified`) and the timestamp. It records **no** phone number,
password hash, session token or free-form payload — `/admin/activity` renders it
and there is nothing sensitive in it to leak. A `DELETE` of an admin who has made
decisions is refused by the foreign key (NO ACTION), so the trail cannot be
orphaned.

## Notifications

Four teacher-facing types were added to the existing notification
infrastructure: `verification_approved`, `verification_rejected`,
`course_published`, `course_changes_requested`. Each is inserted **inside the
same transaction as the decision it announces**, so a decision and its
notification cannot diverge, and an idempotent retry (or a losing race) produces
neither a second decision nor a second notification.

## Routes

| route | purpose |
| --- | --- |
| `/admin` | factual counts + both live queues |
| `/admin/teachers` | verification queue (oldest pending first, status filter) |
| `/admin/teachers/[teacherId]` | full profile, owned courses, request history, decision controls |
| `/admin/courses` | moderation queue with owner verification state |
| `/admin/courses/[courseId]` | whole listing, groups, syllabus, decision controls |
| `/admin/activity` | the immutable decision log |

Authorization is resolved **once, in the admin layout, on the server**:

* anonymous → `/login?next=/admin` (auth gate);
* student/teacher → an explicit in-shell *"this area is not an admin"* screen
  with links to their own dashboard — never a silent cross-dashboard redirect
  that would make the attempt invisible;
* admin → the shell.

An unknown `/admin/**` path renders a real 404 **inside** the admin shell, and an
unknown teacher/course id renders the same 404 as a nonexistent one, so the id is
never echoed back and ids cannot be probed.

`forbidden()` / `unauthorized()` from `next/navigation` are deliberately **not**
used: they require `experimental.authInterrupts`, and no experimental flag is
turned on for a production feature.

## Layering and validation

```
database → verification-service / moderation-service / audit-service
         → admin-service projections → server actions → admin UI
```

No Drizzle query appears in admin JSX. Every mutation is **intent-shaped** and
validated with Zod `.strict()`:

| action | input |
| --- | --- |
| `verifyTeacher` | `{ requestId }` |
| `rejectTeacherVerification` | `{ requestId, feedback ≥ 10 }` |
| `publishCourse` | `{ reviewId }` |
| `requestCourseChanges` | `{ reviewId, feedback ≥ 10 }` |
| teacher submission | `{}` — an *empty* strict object |

There is no `updateStatus` and no `updateCourse`. `status`, `verification`,
`role`, `adminUserId` and `decision` are not fields of any schema, and because
the schemas are `.strict()` a payload that invents one is **rejected**, not
silently ignored. The reviewer is always the session user, and the services
re-check that identity's role inside the transaction as defence in depth.

## Privacy boundary

Admin projections select only moderation-relevant data. The teacher review detail
carries the public profile fields and the teacher's own courses; it does **not**
select a phone number, password hash, session row, token or any student record.
There is **no payment panel** in the admin area and no admin payment action of any
kind — Phase 14's Payme protocol behaviour is untouched, and payment state
remains derived from authenticated callbacks only.

## Building with no database

`npm run build` must succeed with **no database at all** — no `DATABASE_URL`, no
`.data` directory. This is a hard requirement, not a convenience: a build that
touches the database fails on any host that builds before the database is
reachable (this is exactly the failure the marketplace hit on Vercel).

What makes it true:

* no `generateStaticParams` on any database-backed route (it would enumerate
  slugs at build time) and no slug-listing helper exists to reintroduce it;
* the marketplace detail pages are `force-dynamic`;
* **the admin layout declares `export const dynamic = "force-dynamic"`**, which
  covers every nested admin route. Without it Next would try to prerender those
  pages, and because the pages themselves do not read cookies Next would
  *execute their queries* during `next build`. This was found by the Phase 15
  build gate and fixed in the same change.

`npm run build` was verified with no environment variables and no `.data`
directory present, and with the assertion that `.data` is not created by the
build.

## Commands

```bash
npm run test:admin       # Phase 15 admin/verification/moderation suite (147 checks)
npm run admin:list       # current admin accounts (masked)
npm run admin:create     # new operator account (requires ADMIN_PASSWORD)
```

`npm run test:admin` runs against real PGlite migrations and covers the intent
schemas and over-posting, bootstrap security (registration cannot create an
admin; a profile cannot be attached to one), the whole verification lifecycle
including idempotent retries and the "opposite decision" refusal, resubmission
after a rejection, the publication rule (including an unverified owner being
refused), the no-redeploy public visibility check, audit contents and
immutability, and racing admins producing exactly one decision.

## What Phase 15 does NOT implement

Refunds, payouts, commissions or split settlement · chat · SMS, email or push ·
file uploads or document review · review submission by students · waitlists ·
analytics or metrics dashboards · admin payment controls · un-publishing or
editing a live listing · bulk actions.

# Phase 16 — private student ↔ teacher messaging

Phase 16 adds the one conversation this marketplace actually needs: a private
channel between a student and the teacher of a course the student was
**accepted** into. It is deliberately not a social network — there is no
directory, no way to message a stranger, no public DM, and no admin window into
a private thread.

Three rules everything else follows from:

> **1. A conversation exists only inside an enrollment.** `accepted` (paid,
> unpaid or free) → a writable thread. `cancelled` → the history stays, the
> thread is **read-only**, enforced by the server. `submitted` / `rejected` →
> never a conversation, ever. Payment never gates messaging.
>
> **2. The browser sends an intent, never an identity.** The only send mutation
> is `sendMessage({ conversationId, body })`. Participants are derived in SQL
> from the enrollment row (student) and its course (teacher); no
> `studentId` / `teacherId` / `senderId` field exists in any payload, and there
> is no `startConversation(teacherId)` endpoint to enumerate.
>
> **3. Read state is data, not a counter.** `conversation_reads` holds one
> marker per (conversation, user) with a composite foreign key to
> `messages (id, conversation_id)`; unread is derived by comparing
> `(created_at, id)` tuples. Nothing can drift, because nothing is incremented.

## Eligibility

| enrollment status | conversation | writing |
| --- | --- | --- |
| `accepted` (unpaid, paid or free) | yes | yes |
| `cancelled` | history, read-only | **no** — refused by the service, not by hiding the composer |
| `submitted` | none | no |
| `rejected` | none | no |

Opening a thread from the enrolment card is the only entry point, and the card
offers it only while the enrollment is `accepted`.

## One conversation per enrollment

`CREATE UNIQUE INDEX conversations_enrollment_key ON conversations (enrollment_request_id)`.
Creation is lazy: the first eligible open creates the row inside a transaction
that locks the enrollment (`select … for update`), derives both participants,
re-checks `accepted`, inserts with `onConflictDoNothing` and re-selects. Two
simultaneous opens therefore end with exactly one row — the loser of the race
reads the winner's row instead of failing or duplicating. A conversation is
never deleted, so a cancelled enrollment keeps its history and keeps the same
identity.

## Authorization

Participants are never stored or supplied — every query is scoped by
`participantWhere(me)`, which matches the session user against the enrollment's
student or the course's teacher. One refusal path covers every wrong case:
unknown id, another student's thread, another teacher's thread, an admin, a
thread of the wrong role. All of them return the same `not_found`, which the
pages render as the shell's ordinary 404 — so an id cannot be probed for
existence, and an error message cannot leak who is talking to whom.

## Routes

| route | purpose |
| --- | --- |
| `/dashboard/messages` | the student's conversations, latest activity first |
| `/dashboard/messages/[conversationId]` | one thread (student side) |
| `/teacher/dashboard/messages` | the teacher's conversations |
| `/teacher/dashboard/messages/[conversationId]` | one thread (teacher side) |

There is no `/messages/[userId]` route and no "new message" composer that asks
for a recipient. Both dashboards carry a **Xabarlar** nav entry whose unread
badge is rendered on the server on every navigation — a real count derived from
the read markers, never a polling client.

## Sending a message

```
sendMessageAction (server action)
  → requireRole → Zod .strict() → sendMessage({ conversationId, body })
      lock conversation row
      re-derive participants and the enrollment state
      cancelled/missing  → not_writable / not_found
      insert immutable message (1..2000 chars, trimmed, plain text)
      bump conversations.updated_at
      create the recipient's collapsed notification
  → revalidatePath(thread, list, dashboards, notifications)
```

Hiding the composer in a read-only thread is a courtesy; the refusal above is
the actual rule, and a replayed mutation from before the cancellation is
refused by the server. Messages are **immutable**: there are no edit, delete or
unsend columns, endpoints or UI affordances of any kind.

## Read and unread

Opening a thread marks it read **up to the newest message that was actually
rendered**. The write is monotonic (`onConflictDoUpdate` guarded by a
`(last_read_at, last_read_message_id)` tuple comparison), so a double render
cannot corrupt it, and a message that arrives while the page is open stays
unread until it is really seen. Refresh, a second tab and a second device all
recompute the same answer from the same row — there is no fragile counter to
fall out of sync, and no client-chosen arbitrary or future message id is ever
accepted.

## Notifications

A recipient gets an in-app `Yangi xabar` notification whose body names the
sender and the course, linking to the conversation route for their role. The
recipient is deduplicated: while an unread `message_received` notification for
that conversation exists, further messages do **not** create more rows, so a
burst of ten messages produces one notification, not ten. The sender is never
notified about their own message.

## Pagination

A thread renders the latest 30 messages; `?before=<messageId>` renders the page
immediately older, with a *Oldingi xabarlarni ko‘rish* link and a way back to
the newest page. The cursor is the stable `(created_at, id)` pair, a cursor that
belongs to another conversation is ignored rather than trusted, and there is no
"load the whole history" path and no client-side slicing.

## Privacy boundary

A conversation shows the counterpart's public display name and public slug, the
course, the group and the enrollment state. It never shows a phone number,
payment data (transaction ids, amounts and provider identifiers stay in the
payment domain), another enrollment, or any profile field that is not already
public. Student↔student, teacher↔teacher and student↔teacher-outside-an-
enrollment conversations are all impossible by construction.

**No admin surveillance.** The Phase 15 control plane is untouched and gains no
message access: there is no admin messages route, no read-all view, no
impersonation, no send-as and no deletion. Admins are bounced to `/admin` by the
existing role guard, exactly like any other non-participant.

## Rate limiting (an honest boundary)

`sendMessage` refuses a sender's 31st message inside a minute, counted from the
`messages` table. That is a **soft, database-derived guard against a runaway
loop**, not production rate limiting: there is no shared or durable limiter
infrastructure yet, and a process-memory limiter would be a lie on a
multi-instance deployment. Real rate limiting is listed as Phase 20 hardening.

## Commands

```bash
npm run test:messaging   # Phase 16 messaging suite (109 checks, real PGlite migrations)
```

The suite covers eligibility (accepted / cancelled / submitted / rejected),
one-conversation-per-enrollment including the database unique index, both send
directions, the whole authorization matrix (other student, other teacher,
anonymous session, admin), over-posting of `senderId` / `studentId` /
`teacherId` / `enrollmentId`, stored-XSS inertness, unread counting and
monotonic read markers, cursor pagination and deterministic ordering, the
collapsed notification rule, the cancelled read-only refusal, the rate-limit
window, and the raw database invariants (check constraints, foreign keys, the
composite read-marker FK).

## Building with no database

Unchanged and re-verified for Phase 16: no `generateStaticParams`, no
database-backed route is prerendered, and `npm run build` succeeds with no
`.data` directory and no database environment variables. Both new route groups
are dynamic (`ƒ`) in the build output.

## What Phase 16 does NOT implement

File attachments, image or voice messages, audio/video calls, group chats,
teacher↔teacher and student↔student chat, public DMs, typing indicators,
reactions, message editing or deletion, realtime transport (websockets/polling),
SMS/email/push delivery, an AI chat assistant, message search,
blocking/reporting, read receipts, a moderation or surveillance dashboard, and
Phase 17.

# Phase 17 — refunds, paid-enrollment cancellation and the provider boundary

Phase 17 replaces one dead end with an honest workflow. Before it, an accepted
and **paid** enrollment could not be cancelled at all, because refunds did not
exist: cancelling would have taken the student's place away while their money
stayed with the course. The self-service button still refuses that (the money
would be gone), but it now names the path that does exist:

```
student requests  →  admin reviews  →  approved, awaiting_provider
                                          ↓
                        merchant returns the money in the Payme cabinet
                                          ↓
        authenticated Payme CancelTransaction (state −2)  →  refund completed
                                          ↓
                    enrollment cancelled  →  seat released  →  both parties told
```

## The official audit that shaped this phase

The Payme Business Merchant API exposes **six** methods — `CheckPerformTransaction`,
`CreateTransaction`, `PerformTransaction`, `CancelTransaction`,
`CheckTransaction`, `GetStatement` — and **no merchant-side refund endpoint**.
The official documentation states that refunds to buyers are performed by the
merchant **in the merchant cabinet** (`merchant.paycom.uz`) and that a refund is
only possible if the merchant implements `CancelTransaction`.

So this phase does **not** invent an outbound refund call. It implements
`CancelTransaction` truthfully and lets that authenticated callback *finalise*
the refund:

| Protocol fact | Meaning here |
| --- | --- |
| state `1` → `2` (`PerformTransaction`) | money arrived; payment becomes `succeeded` |
| state `1` → `-1` (`CancelTransaction`) | a failed attempt; **not** a refund, Phase 14 behaviour unchanged |
| state `2` → `-2` (`CancelTransaction`) | money **arrived and went back**: a genuine refund signal |
| error `-31007` | service fully delivered; cancellation refused by the provider — eligibility for a refund then becomes a *business* rule, not a protocol one, and is documented as future work rather than faked |
| `reason` codes `1…5, 10` | stored as safe provider metadata (`reason_code`) and mapped to factual internal copy; the raw code is never the primary user-facing text |

## Three domains, deliberately not merged

```
enrollment_requests.status   does this student have a place?   submitted | accepted | rejected | cancelled
payments.status              did the money actually arrive?     pending | succeeded | cancelled | failed
refund_requests.status       did it go back, on whose authority? requested | awaiting_provider | completed | rejected | failed
```

A refund in flight is therefore `accepted` + `succeeded` + `requested`, which is
exactly why the seat stays **occupied** through `requested` and
`awaiting_provider`. There is no `refund_pending` enrollment state, and the
`payment_status` enum gains no `refunded` value: the payment really did succeed,
and the money really did come back — two different facts, both true, each stored
once.

`approved` is not a stored status. The admin's approval and the wait for the
provider operation are the **same instant** (the provider has no API to call), so
the row moves straight to `awaiting_provider` while the decision itself is
recorded in `reviewed_by_admin_user_id` / `reviewed_at` and in the immutable
`refund_events` row of type `approved`.

## Eligibility

A refund request is possible when **all** of these hold, checked in SQL and
again inside the transaction that writes the row:

- the enrollment belongs to the session student (`student_user_id` is in the
  predicate, so somebody else's id matches nothing);
- the enrollment is `accepted`;
- the course is not free;
- a live payment exists and its status is `succeeded`;
- no live refund (`requested` / `awaiting_provider`) exists for that payment.

Full refunds only: the amount is **copied from the payment's immutable snapshot**
(`payments.amount_tiyin`). No partial refund, no percentage, no admin-entered
amount, and the browser never supplies an amount at all.

## Student interface

The enrollment card gains a separate **Pulni qaytarish** section — payment and
refund are shown as two different facts, never merged into one badge:

- `Bekor qilish va pulni qaytarishni so‘rash` opens a labelled reason field and
  states, before submission, that an administrator reviews the request and that
  money counts as returned **only after the provider confirms it**;
- per state the student reads *Pulni qaytarish so‘rovi yuborildi* →
  *Pulni qaytarish jarayonda* → **To‘lov qaytarildi** (the only wording that
  claims the money came back), or *…so‘rovi rad etildi* / *…amalga oshmadi*;
- a rejection or a recorded failure shows the admin's explanation and states that
  the place and the payment are unchanged, so a student can ask again;
- the payment detail page carries the same refund history and timestamps.

Nothing in the interface can complete a refund. There is no button, no query
parameter and no client state that produces `completed`.

## Admin interface

- `/admin/refunds` — the queue, live work first (`requested` before
  `awaiting_provider`, oldest first inside it), with a status filter and counts;
  it is linked from the overview and counted in the navigation badge.
- `/admin/refunds/[refundId]` — student, course, group, payment snapshot,
  provider transaction (id, state in words, performed/cancelled times, reason
  code with its official meaning) and the immutable event history.
- `approveRefund` — admin-only, locks the payment row, re-reads the refund and
  re-verifies *accepted* + *succeeded*, writes `awaiting_provider`, records the
  event, the audit row (`refund_approved`) and the student's notification. The
  screen then says `Payme’da qaytarishni amalga oshirish kutilmoqda.` There is no
  "refund succeeded" control anywhere in the product.
- `rejectRefund` — only from `requested`, requires feedback, leaves the
  enrollment `accepted` and the seat occupied.
- `recordRefundFailure` — only from `awaiting_provider`, requires feedback; also
  leaves the enrollment and the seat untouched, so a failed provider operation
  never costs the student their place as well as their money.

Audit actions `refund_approved` / `refund_rejected` / `refund_failed` are written
inside the decision's own transaction with a short, safe summary (ids and status
words only — never a payload, never a credential).

## Provider boundary and the ONLY writer of `completed`

`src/server/payments/payme-adapter.ts` maps the provider event onto a domain
event:

```
Payme CancelTransaction on a PERFORMED transaction  →  provider_refund_confirmed
```

and calls `reconcileProviderRefund` through a hook that
`payment-service.markCancelled` runs **inside its own transaction**, so protocol
state `-2`, the refund reaching `completed`, the enrollment becoming `cancelled`
and both notifications commit together or not at all. A future CLICK adapter
would emit the same domain event; nothing outside the provider modules changes.

Two shapes of truth are handled:

1. **A live request exists** → it becomes `completed` on the provider's
   authority, the enrollment is cancelled (seat released, since occupancy is a
   COUNT over `accepted` rows) and both parties are notified.
2. **Nobody asked** — the provider reversed a performed payment on its own (for
   example the buyer cancelled through Payme). The reversal is *still* recorded,
   as a `system_initiated` completed refund with no reviewer, the enrollment is
   cancelled, the student is told, and **every admin is notified**, so a
   paid-and-reversed enrollment can never be left looking paid.

A retried `CancelTransaction` returns the byte-identical provider response, finds
the reconciliation already done and changes nothing. A retried callback for a
request that was meanwhile rejected records the reversal as a *second*, completed
row: the rejection and the reversal are both true, and neither is deleted to make
the other look tidy.

## Cancellation, capacity and messaging

- an accepted **unpaid** place can still be cancelled with the ordinary button;
- an accepted **paid** place cannot be cancelled directly — the refusal now
  points at the refund path;
- the seat stays occupied through `requested` and `awaiting_provider` and is
  released only when the refund is `completed` and the enrollment becomes
  `cancelled`;
- messaging is **not** special-cased: a thread whose enrollment is `accepted`
  stays writable while a refund is pending, and becomes read-only automatically
  once the refund completes and the enrollment is cancelled — the Phase 16 rule
  does all of it.

## Idempotency and concurrency

| Repeated action | Result |
| --- | --- |
| student request | returns the live request; no second row, no second event |
| admin approval / rejection | second attempt is refused with `invalid_transition` |
| Payme `CancelTransaction` | provider-identical response, no duplicate financial transition |
| completion notifications | exactly one per logical transition |
| unknown transaction / refund id | protocol error / typed `not_found` |

Every financial mutation takes `SELECT … FOR UPDATE` on the **payment** row and
re-reads inside that lock, so a student request, an approval, a rejection and a
callback serialise. A partial unique index
(`refund_requests_one_live_per_payment`) makes two live requests physically
impossible even if that lock were ever bypassed.

## Privacy

A student sees only their own refunds (the student id is in the predicate, so a
foreign id returns nothing rather than a 403 that confirms existence). A teacher
sees a **fact** — the refund state of enrollments in courses they own, by way of a
join on `courses.teacher_user_id` — with no amount, no payment id, no provider
transaction and no control: a teacher cannot approve, reject or initiate
anything. An administrator sees the moderation view, and the projection still
carries no credential, no card data (the product never sees a card) and no raw
provider payload. `refund_events` stores only a transaction id, a reason code and
a short metadata string; the merchant key and the Authorization header never
reach the database, a page or an audit row.

## Commands

```bash
npm run test:refunds   # Phase 17 suite (161 checks, real PGlite migrations + the real Payme adapter)
```

The suite proves the property the phase exists for — *a refund becomes
`completed` only from an authenticated provider callback* — plus eligibility,
ownership, over-posting (`.strict()` rejects `paymentId` / `studentId` / `amount`
/ `status` / `provider` / `teacherId`), idempotency, racing decisions, the
pre-perform cancel that is **not** a refund, unsolicited reversals, rejection and
failure semantics, seat timing, capacity, messaging interaction, the paid
cancellation refusal, and the raw database constraints.

## Building with no database

Unchanged and re-verified: no `generateStaticParams`, no build-time refund query,
and `npm run build` succeeds with `.data` removed and every database variable
unset. The admin layout stays `force-dynamic`; `/admin/refunds` and
`/admin/refunds/[refundId]` inherit it.

## What Phase 17 does NOT implement

Partial refunds, percentage or prorated refunds, teacher payouts, commissions,
split settlements, wallet or balance, stored cards, recurring billing,
chargebacks or dispute handling, automatic teacher compensation, a CLICK or Uzum
refund adapter, an outbound provider refund call (**none exists**), SMS/email/push
delivery, chat changes, LMS or lesson-completion tracking, admin revenue
analytics, an automatic refund-eligibility rule for the `-31007`
service-fulfilment case, and Phase 18.
