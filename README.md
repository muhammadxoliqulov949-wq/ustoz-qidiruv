# USTOZ

Marketplace for finding courses and teachers (Uzbekistan) — full-stack
Next.js: approved UI phases (1–10), then the real backend (Phase 11+):
PostgreSQL runtime source of truth, phone+password auth with server-side
authorization, enrollments, Payme payments, refunds, messaging, media,
admin moderation and real reviews.

> **Reading guide.** The Phase 1–10 sections below describe the original UI
> build, when pages rendered from TypeScript datasets. The backend phases
> (11–20) moved every runtime surface onto PostgreSQL; the early sections are
> history, not current architecture. **Current truth:** “Which source is
> canonical” (Phase 11 section, updated in Phase 20), the per-phase backend
> sections, and “Phase 20” at the end.

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

npm run test:server      # backend/auth/authorization/constraint suite
npm run test:enrollment  # enrollment request lifecycle suite
npm run test:payments    # Payme protocol + payment state suite
npm run test:refunds     # refund lifecycle suite
npm run test:media       # uploads + verification documents + covers suite
npm run test:messaging   # private conversation suite
npm run test:admin       # admin moderation/verification/refund suite
npm run test:reviews     # reviews + reputation suite
npm run test:data-consistency # Phase 20 data-consistency regression suite
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

All sections are server-rendered. Icons resolve through
`src/components/icons.tsx` (data stores string keys → lucide components; models
stay serializable for the future API). Display numbers/prices format via
`src/lib/format.ts` (SSR-deterministic, no Intl). The hero quick-filter row and
the header/menu searches navigate into the Phase 3 results engine (URL is the
contract).

**The marketplace sections read PostgreSQL, exactly like the browse routes.**
There is no mock/runtime split on this page:

| Section | Source |
|---|---|
| `recommended-courses` | `listPublicCourses(…{sort:"rating"}, { limit: 6 })` — published rows only, capped in SQL |
| `top-teachers` | `listPublicTeachers()` ranked by the same pure sorter as `/teachers?sort=rating`, first 4 |
| `popular-categories` (the *count* on each tile) | `getCategoryCourseCounts()` — `GROUP BY category_id` over published rows |
| hero, quick filters, format duet, how-it-works, trust promises, teacher CTA, category *taxonomy* | static copy/vocabulary (`site.ts`, `categories.ts`) |

Consequences, all deliberate:

* every homepage card is a row the database returned, so its
  `/courses/[slug]` or `/teachers/[slug]` link resolves — the detail routes
  apply the identical `status = 'published'` / `is_public` predicates;
* a category tile can never promise “212 ta kurs” to a catalogue that has none
  (the count is inventory; only *which* categories exist is taxonomy);
* with an empty database the two rows render an honest empty state (the same
  `Card variant="quiet"` language as the `/courses` results empty state) and
  the tiles read “0 ta kurs”. No fixture card, no placeholder portrait, no
  invented number — and no `try/catch` that would quietly substitute one;
* the page is `export const dynamic = "force-dynamic"`, so the queries run per
  request and `next build` still runs with no database at all. A course
  published after the deploy appears on the homepage immediately, with no
  rebuild and no `revalidatePath("/")` needed.

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

Data (history — superseded by Phases 12 and 20): the browse UI was built
against 15 fixture courses (`courses.ts`). Since Phase 12 the results come
from PostgreSQL (`listPublicCourses`, published rows only); the fixture array
is dev-seed input. Since Phase 20 the city facet options AND the URL
whitelist come from live rows (`getPublicFacets` + `parseCourseBrowseParams`
with a runtime allow-list) — no facet derives from the fixture any more.
`notFound()` guards unknown slugs; metadata is per-route with the quoted
query in the title.

## Course detail (Phase 4)

`/courses/[slug]` is the evaluation surface: hero (identity, rating,
teacher, media) + a **solid sticky enrollment card** + six server-rendered
sections — Kurs haqida, Dastur (flat numbered syllabus), Jadval va
guruhlar, Ustoz, Fikrlar, Savol-javob — reached through a restrained
sticky section nav (anchors, IntersectionObserver active state, no tabs).

**Groups are the core interaction.** `CourseGroup` records lived in
`course-details.ts` during the UI phases; since Phase 12 they are database
rows (`getPublicCourseBySlug`, seats derived from accepted requests).
Selection is a URL param (`?group=`) replaced with
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
keep consuming the light row shape. During the UI phases `courseDetailsById`
covered every fixture course; since Phase 12 the detail page reads
PostgreSQL and the fixture is dev-seed input only. FAQ answers are
*generated* from listing fields (`course-faq.ts`) — venue, seat caps and
price wording cannot contradict the card. Reviews were a small fixture
store during the UI phases; since Phase 19 they are real `course_reviews`
rows with moderation, and courses without published reviews get an honest
empty state — the section never inflates the listing aggregates.

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

Teacher browse data was **derived, never duplicated** during the UI phases
(`src/data/teacher-rows.ts` computed rows from `courses.ts`). Since Phase 12
the equivalent read model is derived in SQL (`listPublicTeachers` — public
profiles owning at least one published course); the fixture module survives
as dev-seed input, the dev-demo inspector source and the `TeacherRow` type
the repository projects into. `activeCourses` stays derived — never
hand-written — on both sides.

`/teachers/[slug]` is fully server-rendered: hero (portrait, verification,
formats, languages, derived location, trust numbers as displayed on cards),
“Ustoz haqida” + teaching approach, the teacher’s published courses as
standard `CourseCard`s, real moderated reviews (Phase 19, honest empty state
otherwise), and a FAQ generated only from supported facts. Unknown slugs 404.

## Auth + onboarding UI (Phase 6)

`/login`, `/register` and `/onboarding` began as a **frontend foundation
only**; Phase 11 wired the real backend (phone+password auth, sessions,
profile persistence) behind these same screens. `src/lib/onboarding.ts` is
the single pure contract —
Uzbek +998 phone normalize/format/validate, the versioned `OnboardingDraft`
codec (defensively re-parsed on every read: whitelist enums, drop unknown
keys, keep only fixed-point phone strings), per-step validators and the
completion CTAs, which reuse the existing browse URL contracts
(`/courses?city=&format=`, `/teachers?city=&format=&lang=`,
`/categories/[slug]`) instead of inventing fake “recommended for you”
results. City/language/category/level option lists are the static product
taxonomy — since Phase 20 nothing derives them from fixture inventory.

The draft persists in one namespaced localStorage key
(`ustoz.onboarding.draft.v1`) behind
`useSyncExternalStore` (`components/onboarding/draft-store.tsx`) as
unsaved-form recovery; an explicit save writes the answers to the real
profile row. Passwords are excluded from the draft type. Login and register
are real server actions behind these screens (Phase 11); password recovery
is a clearly-labeled deferred panel.

Registration is role-first (two radio cards, never a dropdown) + name +
phone + password only — teacher professional detail lives in
`/onboarding` exclusively. The wizard (student: 3 steps + skippable;
teacher: 5 required steps incl. a verification notice + honesty
declaration) keeps visible progress, Back/Continue,
Enter-submit, focus-on-step announcements and refresh-resume via the
draft’s furthest step. Completion screens are labeled UI previews; the
teacher one previews the profile from what was typed, with a pending
“Tekshiruv kutilmoqda” badge — never a fake verified state. Verification
itself is a real admin-decided flow (Phase 15), applied for from the
teacher panel.

All previously dead entry points now resolve to these routes (header,
mobile menu, footer, home CTA → `/login` / `/register?role=teacher`; the
Phase 4 enrollment dialog keeps its architecture and only drops the
`prefetch={false}` seams + updates the stale footnote). Auth pages are
`robots: noindex, follow`.

## Enrollment flow (Phase 7)

`/enroll/[courseSlug]?group=<id>` hosts the enrollment wizard: course/group →
student info → schedule confirmation → review → **submission**. The route is
server-resolved like the detail pages: unknown
course 404s; a `?group=` pointing at an unknown or full group never gets
silently replaced — it downgrades to an explicit selection state with a
notice. Selection changes `router.replace` the query (shareable, canonical,
no back-stack spam), so back/forward moves between pages, not steps; the
step itself lives in the client flow and the furthest step resumes on
refresh. A signed-in student's submission writes a real
`enrollment_requests` row (Phase 11+); anonymous visitors keep the honest
local-only result.

`src/lib/enroll.ts` is the pure contract behind it all (EnrollCourseLite
serialization, `resolveEnrollGroup`, the versioned/defensively-parsed
`ustoz.enroll.draft.v1` codec, per-step validators, the single review
projection, canonical href builders) — components stay presentational. The
enrollment draft is deliberately SEPARATE from the Phase 6 onboarding
draft; it prefills name/phone from the signed-in account when available,
else from the browser form draft (labeled for what it is) and
structurally cannot hold passwords, tokens or session ids
— QA asserts the raw JSON has none. Auth handoff: Kirish/Ro‘yxatdan links
everywhere carry `?next=`, validated by `lib/safe-next.ts` (internal paths
only — protocol-relative, schemes, backslashes and oversized values are
dropped to null), so register → onboarding can hand the student back into
the exact enroll URL. The Phase 4 enrollment card/dialog were only wired to
the flow (the dialog now leads with “Yozilish shaklini to‘ldirish”
carrying the selected group); nothing else about that surface changed.

Submission semantics: the review CTA flips a UI flag after a short busy
state. For a signed-in student it also writes the real request row, and the
completion screen summarizes it; anonymous visitors see “So‘rov tayyor.”
plus an explicit notice that nothing was sent to the teacher — never
“yuborildi”, never a receipt, never a fake seat hold. Price rows state the
payment deferral; free courses show “Bepul” with no payment step at all.
Full groups (seatsRemaining 0) are unselectable with a text “Joy qolmagan”
state, never color-only.

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

Data flow was derive-only during the UI phases. Since Phases 11–13 the
account requests read the database (`listStudentRequests` — owner id from
the session), while the overview/saved/browser-draft joins use
`getDashboardCatalog` (published rows only), rendering the real
`submitted → accepted / rejected / cancelled` lifecycle; Phase 20 removed
the `dashboard-catalog.ts` fixture join, so a signed-in student with no
rows gets the honest “Hozircha so‘rovingiz yo‘q” empty state instead of
demonstration rows. Client islands never import the datasets.
`src/lib/dashboard.ts` stays the pure model (`STUDENT_NAV`, `isActiveNav`,
status vocabulary) and the saved/profile panels below keep their Phase 8
shape against real account data.

Saved state gained its canonical home: `src/lib/saved.ts` (versioned model,
`parseSavedState`, pure `toggleSaved`) + `components/saved/saved-store.ts`
(`ustoz.saved.v1`, `useSyncExternalStore`, cross-tab sync). It stores
**canonical ids only** — course/teacher facts are always re-derived — and the
existing `SaveButton` now reads/writes it (`kind` + `entityId` props), so
there is exactly one saved store app-wide instead of the old per-button
`useState`. Ids that no longer exist in the catalog silently drop out.
Saved state is still browser-local (Phase 12 storage key “C — deferred”);
the saved panel labels it as a browser list.

Honesty rules: the shell is session-backed — the identity area shows the
signed-in account's name or “Mehmon (profil to‘ldirilmagan)”, and the wrong
role gets an explicit notice. Request states are the real `submitted /
accepted / rejected / cancelled` union from the database (Phase 13). The
overview shows counts of real things
(requests, saved items, filled profile fields) and one derived next action —
no hours, streaks, progress rings, certificates or charts. Profile is an
editor over the SAME `StudentAnswers` schema, option taxonomies and
validators as Phase 6, persisted to the real profile row.

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
- Per-link prefetch is declared in nav data (`site.ts`): any unbuilt route
  must set `prefetch: false` until its page exists; built routes omit the
  flag. As of Phase 20 every footer link resolves to a built route
  (/about, /help, /contacts, /privacy, /terms included), so no
  `prefetch: false` remains.

## Deliberately deferred (as of Phase 10 — many shipped since)

Shipped by the backend phases: auth backend (accounts, sessions — Phase 11),
teacher-side enrollment handling (Phase 13), payment integration (Payme,
Phase 14), the teacher dashboard (server-backed since Phase 12), real
onboarding persistence, full enrollment request history, course creation
(Phase 12), messaging (Phase 16), refunds (Phase 17), uploads (Phase 18)
and real reviews (Phase 19).

Still deferred: OTP, password recovery, cross-device + server-side saved
state, pagination (catalogs fit one page), premium motion pass, dark mode
evaluation, i18n (`/uz`, `/ru`…), mobile bottom navigation.


---

# Phase 11 — backend, auth and database

## Stack and why

| Concern | Choice | Rationale |
|---|---|---|
| Database | **PostgreSQL** | Real `CHECK` / composite `FOREIGN KEY` / partial `UNIQUE` constraints, transactions, enums. The data-integrity rules of this product belong in the database, not only in application code. |
| ORM | **Drizzle ORM + drizzle-kit** | TypeScript schema that generates **plain committed SQL** migrations you can read and review. No hidden runtime migration engine, no proprietary platform lock-in, and the driver can be swapped without touching queries. |
| Dev/CI driver | **PGlite** (`@electric-sql/pglite`) | Genuine PostgreSQL 18 compiled to WebAssembly — not a mock and not SQLite. Identical constraint semantics with zero install, which matters because the same migrations must be provable in CI. **Development/test only** — see the production rule below. |
| Prod driver | **`pg`** (node-postgres) | The standard pooled client for a real Postgres server. The only driver production accepts, selected with `DB_DRIVER=pg`. |
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
development/test tool and cannot serve a serverless deployment:

- `DB_DRIVER=pg` — required in production (`pglite` writes to a local
  filesystem that serverless platforms do not persist). This is enforced, not
  merely documented: the first runtime database access in a production process
  whose driver is not `pg` throws an explicit configuration error naming
  `DB_DRIVER` and `DATABASE_URL`. Production can therefore never silently fall
  back to PGlite, and never touches `.data/pglite`. The check is deliberately
  in the database client rather than in the shared env validator, so it fires
  only when a request actually reads the database — never during `next build`,
  and never on routes that need no database (e.g. `/login`, `/register` —
  `/` and `/categories` DO read live marketplace rows).
- `DATABASE_URL` — a **pooled** connection string (Neon pooler, Supabase
  pgbouncer, Vercel Postgres pooled) with `?sslmode=verify-full` (Phase 22:
  the legacy `sslmode=require` still connects, but the pool normalizes it to
  the explicitly-verifying `verify-full`; there is no separate `ssl` option
  in the pool). Startup fails loudly if `DB_DRIVER=pg` is set without it.
- `AUTH_INSECURE_COOKIES` must stay unset/`0` so session cookies remain
  `Secure`; `DEMO_TEACHER_WORKSPACE` is forced off in production regardless.
- `ADMIN_PASSWORD` is read **only** by the operator CLI (`admin:create`,
  `admin:create-email`) and only at the moment an admin account is created:
  required, ≥ 12 characters, never interactive, never stored — the row keeps its
  argon2id hash. It is deliberately absent from `src/server/env.ts` because no
  request handler ever reads it, so no HTTP surface can consume it.
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
listings render their empty state and detail slugs 404 honestly. The CLI
applies the same production rule as the runtime: with `NODE_ENV=production` and
no `DB_DRIVER=pg`, `scripts/db.ts` refuses rather than silently creating a
throwaway `.data/pglite` cluster.

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
marketplace.** `/courses`, `/courses/[slug]`, `/teachers`, `/teachers/[slug]`,
`/categories/[slug]`, the `/categories` tile counts and the **homepage
recommendation rows** read PostgreSQL through `src/server/public-repo.ts`.
There is exactly one active public source; `src/data/*` is now **seed input,
fixture data and static site copy only**.

### `src/data/*` runtime matrix (updated in Phase 20)

| Module | Role today |
|---|---|
| `courses.ts`, `teachers.ts` | **Seed-only** for the course/teacher records. The exported *label maps* (`courseFormatLabels`, `courseLevelLabels`, `cityLabel`) remain runtime presentation helpers — they are static vocabulary, not marketplace data. The former home-facing exports `recommendedCourses` and `topTeachers` are **deleted** (Phase 12); the derived `courseCities` inventory list is **deleted** (Phase 20) — the city facet whitelist now comes from live rows (see “Facet vocabularies” below). |
| `teacher-rows.ts`, `course-details.ts` | **Seed/reference only.** The equivalent read model is derived in SQL by `listPublicTeachers()`. (Phase 20 deleted the derived *facet vocabularies* `teacherCities` / `teacherLanguages`; see below.) |
| `categories.ts` | **Runtime, static taxonomy.** Six fixed categories used for routing, labels and the authoring form. Not marketplace inventory, and it carries **no `courseCount` any more**: how many published courses a category holds is counted by `getCategoryCourseCounts()` and passed to `CategoryCard` as a prop (the card renders no count line when it is not given one). |
| ~~`reviews.ts`~~ | **DELETED in Phase 19.** Written reviews are real rows in `course_reviews`, read through `public-repo.ts`. There is no fixture left to fall back to. See "Reviews and FAQ" below. |
| `course-faq.ts`, `teacher-faq.ts` | **Runtime pure functions.** They take a `Course`/`TeacherRow` (now DB-projected) and compute FAQ text. They hold no records. |
| `site.ts` | **Runtime static copy** (page titles, intros, footer). |
| ~~`dashboard-catalog.ts`~~ | **DELETED in Phase 20.** The student dashboard reads the database; the last consumer was the demo fallback, which is gone with it. |
| `teacher-dashboard.ts`, `teacher-profiles.ts`, `course-authoring.ts` | **Legacy prototype projections / option lists.** The primary teacher dashboard reads the database; these survive for the legacy local-draft editor, the dev-demo inspector and form option lists. |
| `models.ts` | **Runtime types.** The repository projects DB rows into these exact types. |

The rule that matters: **no public marketplace page imports a canonical
`courses`/`teachers` array at runtime.**

*Phase 20 — facet vocabularies, the known remainder resolved.* The
fixture-derived URL whitelists (`courseCities`, `teacherCities`,
`teacherLanguages`) are **deleted**. Public facets now come from live rows:
`getPublicFacets()` returns the course cities, teacher cities and teacher
languages behind published/queryable inventory, and the browse parsers
(`parseCourseBrowseParams`, `parseTeacherBrowseParams`) accept a runtime
allow-list — so a production city the fixture never had is a valid param,
and a param with no inventory lands on the honest empty state. Static
option sets that are taxonomy rather than inventory (formats, levels,
subjects, price thresholds, sort orders) still live in `src/lib/*` and
`src/data/taxonomy.ts`.

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

**Phase 19 replaced the fixture review list with a real, PostgreSQL-backed
review + reputation system.** `src/data/reviews.ts` is deleted: the testimonials
it held were invented, and a rating nobody earned is worse than no rating.

### `course_reviews`

One row per (student, course) — the row is *reused*, never duplicated, so
`UNIQUE(student_user_id, course_id)` is the duplicate guard and two racing
submissions cannot both land.

| Column | Rule |
|---|---|
| `course_id` / `student_user_id` / `enrollment_request_id` | A **composite FK** onto `enrollment_requests(id, student_user_id, course_id)` makes a review that claims somebody else's enrollment — or a different course than the enrollment's — impossible to insert. |
| `rating` | `CHECK BETWEEN 1 AND 5`. |
| `body` | Stored **trimmed**, `length BETWEEN 20 AND 1500`. Plain text; rendered as a React text child, never as HTML. |
| `status` | `pending` → `published` / `rejected`; `withdrawn` is the student's own act. |
| `moderated_at` / `moderated_by_admin_user_id` | All-or-nothing with a decision. `pending` has neither; **`withdrawn` has neither either**, because attributing a student's withdrawal to an operator would misstate who acted. |
| `moderation_reason` | Only on a rejection, and optional. |

### Who may write

Eligibility is answered by the database, never by a form: session role is
`student`, an `enrollment_requests` row owned by that session user is
`accepted`, its group's `start_date` is today or earlier, the course is
`published`, and no live review exists yet. The copy says
**"Tasdiqlangan qatnashuvchi"** — an accepted participant — because the product
tracks no completion and will not claim one.

### Who may moderate

`/admin/reviews`, behind `requireAdminPage`. A teacher has **no** path to
approve, hide or delete reviews of their own course: no teacher surface imports
the actions, and `review-service` re-checks the caller's `users.role` *inside
the transaction* before writing, so the recorded moderator is always a real
admin. Every decision writes one `admin_audit_events` row (`entity_type =
'review'`) and notifies the student.

The queue shows the course, the student's **name**, the rating, the text and the
date. It never selects `users.phone` or `users.email` — not masked, not read.

### Reputation

`courses.rating_x10` / `courses.reviews_count` and the same pair on
`teacher_profiles` are **cached aggregates of published rows**, recomputed by
`recalculateCourseReviewStats()` / `recalculateTeacherReviewStats()` inside
every transaction that changes visibility, under a `courses` →
`teacher_profiles` lock order. A teacher's number is a **flat mean over all
their published review rows**, not an average of per-course averages — that
weighting would let a course with one review outweigh a course with fifty.
Zero published reviews means `0` and `0`, never a seeded default.

Editing a **published** review returns it to `pending` and removes its old value
from the public numbers in the same transaction: an admin approved a specific
text, not whatever replaces it.

### Local seed data

`npm run db:seed` creates a small set of explicitly-labelled development review
rows (published, pending and rejected) so the moderation queue and the
reputation engine can be exercised locally, and then recomputes every aggregate
from those rows. It refuses to run with `NODE_ENV=production`; the migration
seeds nothing. Seeded courses and teachers start at `rating_x10 = 0`,
`reviews_count = 0` — the fictional numbers from the catalogue fixture are no
longer imported.

FAQ content is still computed by pure functions from the DB-backed course and
teacher records.

## Rendering and caching

| Route | Mode | Why |
|---|---|---|
| `/` (homepage) | Dynamic SSR | Its recommendation rows and category counts are live marketplace reads; a prerendered homepage would freeze them at build time and would also execute those queries during `next build`. |
| `/courses`, `/categories/[slug]` | Dynamic SSR | Results depend on the URL *and* live DB state; a build-time snapshot would go stale the moment a course changes. |
| `/courses/[slug]` | Dynamic SSR | Seat availability is derived from live enrollment rows. **No `generateStaticParams`:** slugs are resolved at request time, so unknown, draft and unpublished slugs 404 then — and a course published *after* the deploy works without a rebuild. |
| `/teachers`, `/teachers/[slug]` | Dynamic SSR | The roster and each profile's course set change at runtime. **No `generateStaticParams`**, same reasoning. |
| `/categories` | Dynamic SSR | The taxonomy is static; the count on each tile is a live `GROUP BY` over published rows, so it must match the homepage tile and the category's own results screen. |
| All `/dashboard` and `/teacher/dashboard` routes | Dynamic | Account-sensitive; never prerendered. |

**`npm run build` does not require a database.** No route in the app enumerates
DB rows at build time, so `next build` runs with no `DATABASE_URL`, no
`.data/pglite` and no network access, and a paused or unreachable production
database cannot fail a deployment. The database is required **at runtime only**,
where every marketplace read is a request-time query through
`src/server/public-repo.ts`.

Writes call `revalidatePath()` for the affected surfaces (`/courses`,
`/teachers`, the course's public page and the teacher dashboard), so data is not
served stale after an edit. The homepage and `/categories` need no entry in
those lists: both are `force-dynamic`, so they re-read on the next request
whatever happens.

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

Two identities, two credential shapes, one session mechanism:

| who | identifier | server action | credential check |
| --- | --- | --- | --- |
| student / teacher | phone `+998XXXXXXXXX` | `loginAction` | `authenticatePhone` |
| admin (operator) | email | `adminLoginAction` | `authenticateAdminEmail` |

Both are password-based; the operator login additionally re-checks that the row
it found really is `role = 'admin'`, so a mis-stored email can never authenticate
as an operator. **No SMS/OTP exists**, so nothing in the UI claims a code was
sent, and there is no hard-coded code and no bypass account. `/login` asks which
identity is signing in and shows exactly one matching field — a phone input that
strips non-digits cannot also be an email input, and guessing from the text would
make the two credential paths share one error surface.

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
npm run test:server      # Phase 11/12 DB + security suite   (133 checks)
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
`CancelTransaction`. Phase 14 implemented no refund UI; Phase 17 added the
request → admin review → provider-confirmed workflow (see the Phase 17
section).

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

| role | who | signs in with | dashboard |
| --- | --- | --- | --- |
| `student` | the default account | phone + password | `/dashboard` |
| `teacher` | an account with a `teacher_profiles` row | phone + password | `/teacher/dashboard` |
| `admin` | an operator account with **no profile row** | email + password, or phone + password for a phone-created/promoted operator | `/admin` |

`user_role` gained `admin` in migration `0005`. The composite foreign keys
(`student_profiles_(user_id, role)` and `teacher_profiles_(user_id, role)`, each
with its own `role = 'student'` / `role = 'teacher'` CHECK) mean the database
itself refuses to turn a profiled account into an admin, and refuses to attach a
marketplace profile to an admin. That is a security property we keep: an operator
account physically cannot own courses, be enrolled as a student, or inherit a
marketplace identity. The practical consequence is documented below.

## Bootstrapping an admin (out-of-band, by design)

```bash
npm run admin:list                                  # who is an operator, and with which identifier
ADMIN_PASSWORD='…12+ chars…' npm run admin:create-email -- operator@example.uz
ADMIN_PASSWORD='…12+ chars…' npm run admin:create -- +998XXXXXXXXX
npm run admin:promote -- +998XXXXXXXXX              # an EXISTING profile-less account
npm run admin:demote  -- +998XXXXXXXXX              # back to student (phone operators only)
```

Why a CLI and not a route:

* it is **not reachable over HTTP at all** — there is no endpoint, action or
  page that grants the role, so an escalation attempt has nothing to call;
* it never reads a role from a request; the operator states the target phone or
  email explicitly and the command implies the role;
* it is the **only** writer of `users.role = 'admin'` in the codebase.

Safety properties:

* **No default admin, no seeded admin, no committed password.** `admin:create`
  and `admin:create-email` require `ADMIN_PASSWORD` in the environment
  (≥ 12 characters) and refuse a weaker or missing one; neither is interactive,
  so no password is echoed to a shell history or a log. `db:seed` refuses
  `NODE_ENV=production`.
* **Safe failure.** An unknown phone number or email changes nothing and says
  nothing about which identifiers exist. Output is masked (`+998****233`,
  `o***@example.uz`), so a terminal recording or CI log cannot recover either.
* **`promote` refuses a profiled account** with an explanation instead of
  deleting data to force the update through — the composite role FK would reject
  it anyway, and removing the profile would delete that teacher's courses.
  Use `admin:create` for a dedicated operator account.
* **`promote`/`demote` refuse an email argument** outright. An email operator has
  no phone identity and no marketplace role to return to, so there is nothing to
  promote from or demote to — the account is created once and stays an operator.
* **Production is never seeded.** The dev fixtures below exist only when
  `db:seed` runs outside production.

The three supported ways to get an admin, in order of preference:

1. `admin:create-email` — a dedicated operator account with an email identity
   (recommended: an operator mailbox is not a personal phone number).
2. `admin:create` — a dedicated, profile-less operator account with a phone.
3. `admin:promote` — an existing account that has no profile row.

### Two operator identities (email + phone)

An operator account is identified by **either** a phone number **or** an email
address, never both, and `users` enforces that in the database rather than in
application code. Migration `0009_admin_email_identity` made `phone` nullable,
added a nullable `email`, and added four CHECK constraints plus a unique key:

| constraint | what it guarantees |
| --- | --- |
| `users_email_key` (UNIQUE) | no two accounts share an operator email |
| `users_has_one_identifier` | every account has a phone or an email — no identity-less row |
| `users_email_admin_only` | an email can exist **only** on `role = 'admin'`; registration (student/teacher) can never carry one, and `promote` cannot smuggle one in |
| `users_email_normalized` | stored emails equal `lower(btrim(email))`, so a duplicate cannot hide behind case or padding |
| `users_email_format` | the stored value really looks like an address (`local@domain.tld`) |

`users_phone_format` is NULL-safe, so the phone rules for marketplace accounts
are unchanged, and `users_id_role_key` still makes a profile impossible for an
admin (see *Roles* above). The migration is additive and reversible in shape: it
drops no column, rewrites no row, and needs no downtime. Applying it to a
database whose every row already has a phone cannot fail — there is nothing to
backfill.

Email normalization lives in `src/lib/email.ts` (`normalizeEmail`,
`isValidEmail`, `maskEmail`) and is applied on **both** sides — the CLI before
insert, and `authenticateAdminEmail` before lookup — so the stored form and the
queried form are produced by the same function and cannot drift apart.

What this hotfix does **not** touch: payments, courses, enrollment, messaging,
storage and the audit log's shape.
No public registration path gained an email field, `registerSchema` is unchanged
and still `.strict()` (an extra `email` key is a validation failure), and no
route, action or API endpoint can create an operator.

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
* **No document uploads (in this phase — superseded by Phase 18).**
  Verification applications are now document-backed; see the Phase 18 section.
  The trust decision itself is unchanged and still lives here.

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

* anonymous → `/login?next=/admin` (auth gate — the operator picks the **email**
  mode on that form; `next` is preserved and re-validated by `parseSafeNext`
  before the redirect, so it can only ever be an internal path);
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
* **every route that renders a marketplace read is `force-dynamic`** — the
  browse routes, the detail routes, the homepage and `/categories`. Without the
  flag Next prerenders the page and *executes its queries* during `next build`,
  which is the same trap the admin layout hit below;
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
npm run test:admin         # Phase 15 admin/verification/moderation suite (194 checks)
npm run test:reviews       # Phase 19 reviews + reputation suite (173 checks)
npm run admin:list         # current operator accounts (masked, with identifier kind)
npm run admin:create-email # new operator with an EMAIL identity (requires ADMIN_PASSWORD)
npm run admin:create       # new operator with a PHONE identity (requires ADMIN_PASSWORD)
```

A production operator bootstrap is exactly two commands, run from a trusted
environment with the production connection string — never from a build step:

```bash
DB_DRIVER=pg DATABASE_URL=<production-url> npm run db:migrate
DB_DRIVER=pg DATABASE_URL=<production-url> \
  ADMIN_PASSWORD='<12+ characters>' npm run admin:create-email -- operator@your-domain.uz
```

`npm run test:admin` runs against real PGlite migrations and covers the intent
schemas and over-posting, bootstrap security (registration cannot create an
admin; a profile cannot be attached to one), the whole verification lifecycle
including idempotent retries and the "opposite decision" refusal, resubmission
after a rejection, the publication rule (including an unverified owner being
refused), the no-redeploy public visibility check, audit contents and
immutability, and racing admins producing exactly one decision. It also covers
the email operator identity: email + password authentication (and refusal of a
wrong password, an unknown address, an empty password, and a differently-cased
password), normalization before lookup, the phone login staying intact, the five
`users` constraints (unique, at-least-one-identifier, admin-only, normalized,
format), the impossibility of attaching a marketplace profile or demoting an
email operator, absence from the public directory, and the fact that no
registration or login schema will accept an `email` or a `role`.

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
multi-instance deployment. Phase 20 scoped itself to data consistency and did
not add it; real rate limiting remains future work.

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

- `/admin/reviews` — **Phase 19.** The review moderation queue: pending first,
  oldest first, with a status filter and counts. Each row shows the course, the
  student's name, the rating, the full text and the submission date, and offers
  exactly two decisions. Publishing makes the text public and moves the course's
  and the teacher's rating in the same transaction; rejecting removes it from
  both. The queue never selects the student's phone number or email.
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

# Phase 18 — secure uploads, verification documents and course media

Phase 18 adds the first byte-level feature to the product: images and documents
that a teacher uploads. Everything here is built around one rule — **the caller
never decides what a file is, who may read it, or whether it is done**.

## Two visibility classes, and nothing in between

| Purpose | Visibility | Written by | Read by |
| --- | --- | --- | --- |
| `teacher_verification_document` | **private** | the teacher (own account) | the owner, and an admin reviewing a **submitted** application |
| `teacher_profile_image` | public | the teacher (own account) | anyone (public profile projection) |
| `course_cover_image` | public | the teacher who **owns the course** | anyone (marketplace projection) |

`visibility` is a **function of purpose**, not a parameter. There is no API that
accepts a visibility, no upload takes a caller-supplied type, and `file_assets`
carries CHECK constraints (`file_assets_visibility_matches_purpose`,
`file_assets_key_namespace`) so a row that contradicts its purpose is refused by
PostgreSQL — not by the service that happens to be running.

## The storage contract

The application talks to one small interface (`src/server/storage/types.ts`):

```
putObject · headObject · deleteObject · getPublicUrl · createPrivateReadUrl
```

Provider internals never leak: no page, action or service imports an SDK, builds
an S3 hostname, or knows that a bucket exists. `src/server/storage/index.ts` is
the only factory, and it reads the environment once:

| Variable | Meaning |
| --- | --- |
| `STORAGE_PROVIDER` | `disabled` (default) · `local` (development) · `s3` |
| `STORAGE_LOCAL_DIR` | object root for the local provider (gitignored, default `.data/storage`) |
| `STORAGE_SIGNING_SECRET` | HMAC secret for private read capabilities |
| `STORAGE_S3_BUCKET`, `STORAGE_S3_PUBLIC_BUCKET` | private and public buckets |
| `STORAGE_S3_REGION`, `STORAGE_S3_ENDPOINT`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `STORAGE_S3_FORCE_PATH_STYLE` | S3-compatible credentials (AWS, R2, MinIO) |
| `STORAGE_PUBLIC_BASE_URL` | CDN/base URL public objects are addressed with |

Rules the factory enforces:

* `local` **refuses to run in production** — a filesystem is not durable storage,
  and a silent production fallback is exactly the failure mode this design
  avoids. `s3` refuses to start with an incomplete configuration, and the error
  names the missing **variable names**, never a value.
* Credentials are server-only. Nothing is prefixed `NEXT_PUBLIC`, nothing is
  committed, and nothing is ever returned to the browser.
* The test double (`memory-provider.ts`) implements the **same** contract, so the
  suite proves contract behaviour rather than the quirks of a mock.

## Upload lifecycle

```
prepare → object written → provider head-verifies (size + content type)
        → row activated                    ← only now is the file real
```

* **Safe ordering.** Upload writes the object, verifies it, and only then flips
  the `file_assets` row to `active`. Replacement writes the new asset first,
  swaps the active row second, and leaves the previous object for the cleanup
  command. Deletion marks the row first and deletes bytes best-effort, so a
  failed delete leaks bytes instead of breaking a reference.
* **Layered validation** (`src/lib/media.ts`): size limit per purpose, real
  magic-byte detection, extension derived from the detected type, loose geometry
  (a 1×1 avatar is refused), ownership and state re-checked in SQL. The
  browser's `File.type`, `File.size` and "success" are all treated as claims.
* **Keys** are server-generated: `<visibility>/<namespace>/<owner-scope>/<id>.<ext>`.
  The uploaded filename is stored separately, sanitized for display, and is never
  part of a path.
* **Statuses**: `pending → active → superseded | deleted`. `superseded` is what a
  replaced asset becomes; `deleted` is what a removed or abandoned one becomes.
  Nothing is ever hard-deleted while a verification request still points at it.
* **Checksums** are optional metadata (integrity aid), not a content-addressed
  store.

## Verification documents

A verification application is now **document-backed**. Two document types exist,
and only one is required:

* `identity_document` — required;
* `qualification_evidence` — optional (a diploma, a certificate).

The trust decision is unchanged and still Phase 15's: an admin approves, rejects
or returns the application, the database refuses any other transition, and the
profile column remains a *current state*. What Phase 18 adds is evidence:

* A submission needs a complete profile **and** the active required document
  (`missing_documents` is the honest refusal otherwise).
* Submission **freezes** the evidence: while a request is pending the teacher
  cannot add or remove a document, because the reviewer is reading exactly that
  set.
* Historical requests keep their own evidence forever (`file_asset_id` with
  `ON DELETE RESTRICT`), so a later approval can never make an earlier decision
  unreadable.

### Honesty rules for this feature

* This is **platform trust verification**, not state certification. No copy
  implies `Davlat tomonidan tasdiqlangan`, and no invented legal/KYC rules were
  added: the documents are only ever described as what they are.
* The teacher-facing screen states the real limit:
  `Tasdiqlash hujjatlari ommaviy profilga chiqarilmaydi va faqat tekshiruv uchun
  vakolatli administratorlarga ko‘rsatiladi.` There is no absolute-privacy
  promise, because no system can make one.
* **No malware scanning is claimed.** Nothing in the UI says a file was scanned.
  The seam exists (`MEDIA_SCAN_BOUNDARY_NOTE`, and every activation flows through
  one function that could call a scanner) but no scanner is wired in, and the
  product says so.

## Private access: short-lived, purpose-scoped capabilities

Private objects have **no public address**. There is no permanent URL, no CDN
path, and no guessable endpoint. Reading evidence means one of two things:

1. an **authorized proxy** call that checks the session, ownership and the
   request attachment; or
2. a **short-lived signed URL** (10 minutes, hard-capped at 15) minted on demand.

The authorization rule is purpose-scoped, not role-scoped:

* the **owner** may read their own document at any time;
* an **admin** may read a document **only** when it is attached to a submitted
  application — an unattached draft document is the teacher's own business;
* everyone else (another teacher, a student, an anonymous visitor) receives
  `not_found`, which leaks nothing about existence.

Nothing is stored: the URL is minted per render, `expiresAt` is checked after the
signature, and the signature covers the key **and** the expiry, so extending
`e=` invalidates the link instead of prolonging it. Private responses are served
`Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, a sandbox
CSP and a sanitized `Content-Disposition`.

### The development delivery route

`/api/media/[...key]` exists **only** so the local provider can be exercised on a
laptop. It refuses to serve anything unless the active provider is the local one,
which is why a "temporary dev helper" can never become an unauthenticated file
server in production. In production the store serves the bytes: a public URL from
the CDN for public objects, a presigned URL for private ones.

## Profile image and course cover

* The teacher's managed photo wins; the seeded `/media/...` path stays the
  fallback, so **no fixture was migrated** and published seed courses keep
  working. The same overlay applies to the public marketplace, the teacher
  dashboard, the course editor and the moderation queue.
* A course cover can only be set by the teacher who **owns the course**, only
  while it is a `draft`. A course under review or published is locked (Phase 15's
  rule), and the extra lock is applied a second time inside the DB transaction —
  a crafted request from a frozen course changes nothing.
* Replacing an image never rewrites live published media silently.

## Cleanup

`npm run storage:cleanup` (with `--dry-run`, `--hours`, `--limit`) removes two
classes of garbage: abandoned `pending` rows with their bytes, and objects left
behind by `superseded`/`deleted` rows. The database is updated first, so a failed
object delete is an orphaned byte rather than a broken reference. Scheduling is
**not** implemented; the intended shape on a real deployment is a nightly cron
entry (for example `0 3 * * *  cd /srv/app && npm run storage:cleanup`). Frozen
evidence is never touched. `npm run storage:status` reports the provider, whether
it is configured, and the asset counts per status — never a key or a credential.

## Security limits (stated, not implied)

* A signed URL is a **bearer capability**: whoever holds the link during its ten
  minutes can read the object. That is why it is minted per render and never
  written into a cached page, a log or a database column.
* A file that passes validation is not proven to be *innocuous* content — a valid
  PDF can still be a PDF nobody wants. The type, size, namespace and ownership
  rules are enforced; content scanning is deliberately out of scope (see above).
* Duplicate uploads are allowed: there is no content-addressed store, so an
  identical image uploaded twice is stored twice. That is a cost decision, not a
  security one.
* Storage failures are reported honestly. No upload reports success that did not
  become an active, head-verified object.

## Building with no database or storage

Phase 18 keeps the build independent of both: `.data/` deleted, `DB_*` unset and
`STORAGE_*` unset must still `npm run build`. Nothing reads storage at build
time, every page that touches media is dynamic, and the media route is
`force-dynamic`. `next.config.ts` derives `images.remotePatterns` from
`STORAGE_PUBLIC_BASE_URL` only (never `*`), so an arbitrary external image URL
cannot become an editable input.

## Operations

* **Buckets.** Two policies are expected: a public bucket readable by anyone (or
  fronted by a CDN) and a private bucket readable by **no one but the app's
  credentials**. No `s3:ListBucket` for anonymous callers; no public ACL on the
  private bucket; block public access on it.
* **CORS.** Only needed if the browser uploads directly to the store. This
  implementation uploads through a server action, so no CORS rule is required;
  if that changes, allow `PUT`/`GET` from the app origin only.
* **Signed-URL TTL.** 600 seconds for private reads, capped at 900. Public
  objects are immutable-by-key: a replacement is a new key, which is what makes
  `Cache-Control: immutable` honest.
* **Limits and types.** Profile image ≤ 5 MB, course cover ≤ 8 MB, document ≤ 10
  MB, ≤ 4 documents and ≤ 30 MB per submission; JPEG/PNG/WEBP for images,
  plus PDF for documents. SVG, HTML, XML and archives (ZIP/DOCX) are refused by
  content, not by name.
* **Production migration order.** (1) apply migrations; (2) create the two
  buckets and the credentials; (3) set the `STORAGE_*` variables; (4) set
  `STORAGE_PUBLIC_BASE_URL` to the CDN origin; (5) verify with
  `npm run storage:status`; (6) run `npm run storage:cleanup -- --dry-run`
  before trusting the first real sweep.

## Commands

```
npm run test:media       # 159 assertions: privacy + abuse matrices, lifecycle, route, cleanup
npm run storage:status   # provider + configuration + asset counts per status
npm run storage:cleanup  # sweep abandoned uploads and orphaned objects
```

## What Phase 18 does NOT implement

Video uploads, lesson content hosting, arbitrary user file sharing, chat
attachments, student or homework uploads, certificate generation, OCR, AI
document analysis, biometric or face matching, an antivirus service, an image
editor/cropper, multi-image galleries, and reviews. Also deliberately absent: a
content-addressed store, automatic cleanup scheduling, and any promise that a
document was scanned.

# Phase 20 — data consistency, mock cleanup and product truth

Phase 20 changes no behaviour the backend phases got right; it removes the
fiction that was still sitting next to it. Every public page, cabinet and
browse filter now answers from one place — PostgreSQL — or says plainly that
it cannot. The approved UI is untouched.

## The one rule

**PostgreSQL is the runtime source of truth. `src/data/*` holds only**
(a) static product taxonomy and copy (categories, formats, levels,
languages, price thresholds, sort orders, page text, footer), (b) pure
formatter/validator functions over DB-projected rows, and (c) dev-seed input
that never reaches a runtime page. Anything that used to **derive inventory
from fixtures** — counts, city/language lists, demonstration rows — was
deleted or rewired onto live queries.

## Student dashboard (Phase 8 surface, Phase 20 truth)

The account request cards read `listStudentRequests` (owner id from the
session only; payment/refund facts join in the same server render), and
the overview/saved panels join browser state against `getDashboardCatalog`
— published rows only — rendering the real
`submitted / accepted / rejected / cancelled` lifecycle with per-state
actions. Phase 20 deleted `src/data/dashboard-catalog.ts` and the demo
fallback: a signed-in student with no rows sees “Hozircha so‘rovingiz yo‘q”
with a link to the catalog — never demonstration rows, never a fixture join.
Saved courses/teachers stay an explicitly labelled browser-local list.

## Public facets from live rows

Inventory-dependent facets are queried from published/queryable rows through
`getPublicFacets()` (course cities; languages of directory teachers) and
`getCategoryCourseCounts()` (per-category counts), and the URL parsers
(`parseCourseBrowseParams`, `parseTeacherBrowseParams`) take the live values
as their runtime allow-list. A real city no fixture ever had is a valid
param; a param with no rows lands on the honest empty state. Everything else
on the filter panels is static taxonomy or user input, not inventory: subject
vocabulary (the category slugs), formats, levels, schedules, rating/experience
thresholds, sort orders, and the free-text price min/max. No price
bounds or subject list is queried, because the UI offers none.

## Fake counts and dead ends, removed

* The hero's “Minglab kurslar…” claim is gone — no format promises inventory
  the database does not have.
* Every footer link resolves to a built route: `/about`, `/help`,
  `/contacts`, `/privacy`, `/terms` are new, static, server-rendered pages
  describing **actual** behaviour (the verification, enrollment, payment,
  refund, review and moderation flows as they really work). `/contacts` lists
  no phone, email or social channel, because none exists for this project —
  inventing one would be a fake contact.
* No `prefetch: false` remains anywhere; the convention stands for future
  unbuilt links.

## Fixture cleanup

`dashboard-catalog.ts` and the derived `courseCities` / `teacherCities` /
`teacherLanguages` exports are **deleted**. What survives in `src/data/*` is
audited per module in “`src/data/*` runtime matrix” above. Nothing was
migrated from fixtures into production reads — the dev seed still projects
fixtures one way into a development database and refuses production.

## Storage (explicitly NOT this phase)

Phase 20 does no storage work: no bucket provisioning, no env changes, no
cleanup scheduling. The Phase 18 contract stands as documented.

## Guarantees held

Session model, cookie flags, argon2id, composite FKs, the enrollment/payment/
refund state machines, messaging eligibility, rating recomputation, review and
moderation rules, the no-build-time-DB rule and the no-polling/no-realtime
boundaries are all unchanged — re-verified by running every suite plus
`tsc`, `lint` and a database-less production build after the cleanup.

## Commands

```bash
npm run test:data-consistency  # Phase 20 data-consistency suite (see below)
```

`tests/data-consistency.test.ts` pins the Phase 20 contract: public-repo
reads return published rows only; facet cities/languages derive from live
rows; unknown params are dropped by the parsers with or without a runtime
allow-list; the deleted fixture modules/exports have no importers; every
footer href resolves to a built route; and no `generateStaticParams`
survives on any DB-backed route. It runs against real PGlite migrations,
like every other suite.

## What Phase 20 does NOT implement

Storage provisioning or scheduling · new marketplace features · real rate
limiting · password recovery or OTP · server-side saved state · pagination ·
any change to the session, payment, refund, messaging, review or moderation
rules.

---

# Phase 21 — Production Object Storage & Media Delivery

Phase 21 hardens the Phase 18 storage architecture for production deployments,
targeting Cloudflare R2 as the primary object-storage provider while preserving
full generic S3 / AWS S3 / MinIO compatibility.

## Public and Private Bucket Separation

Production requires strict separation of concerns between two storage namespaces:

1. **Private Bucket (`STORAGE_S3_BUCKET`):**
   - Stores sensitive teacher verification evidence (`teacher_verification_document`).
   - MUST NOT have any public domain, CDN distribution, or bucket website attached.
   - Objects are accessible solely through short-lived server-presigned signed URLs (10 min TTL).
   - Authorization is checked BEFORE generating the signed capability (owner teacher or reviewing admin).
   - Never exposed through `STORAGE_PUBLIC_BASE_URL`.

2. **Public Bucket (`STORAGE_S3_PUBLIC_BUCKET`):**
   - Stores public teacher profile photos (`teacher_profile_image`) and course covers (`course_cover_image`).
   - Publicly accessible via `STORAGE_PUBLIC_BASE_URL` (custom domain or CDN).
   - Keys are deterministic and server-generated (`public/teacher-photos/...`, `public/course-covers/...`).
   - Cache-Control is immutable and long-lived (`public, max-age=31536000, immutable`).

### Fail-Closed Production Invariant

When `STORAGE_PROVIDER=s3` and `NODE_ENV=production`:
- `STORAGE_S3_BUCKET` (private) is strictly required.
- `STORAGE_S3_PUBLIC_BUCKET` (public) is strictly required.
- `STORAGE_S3_BUCKET` and `STORAGE_S3_PUBLIC_BUCKET` MUST be distinct bucket names.
- `STORAGE_PUBLIC_BASE_URL` is strictly required.
- `STORAGE_PROVIDER=local` is refused with `StorageConfigError`.
- Incomplete configuration fails immediately without half-configured state.

## Cloudflare R2 Compatibility

Cloudflare R2 is fully supported via the standard `@aws-sdk/client-s3` provider:
- **Region:** `auto` (set `STORAGE_S3_REGION=auto`).
- **Endpoint:** `https://<account_id>.r2.cloudflarestorage.com` (set `STORAGE_S3_ENDPOINT`).
- **Credentials:** Cloudflare R2 API token (Access Key ID and Secret Access Key).
- **Signed URLs:** AWS SDK presigned `GetObject` URLs with `ResponseCacheControl: "private, no-store"` and `inline` disposition.
- **Addressing:** `STORAGE_S3_FORCE_PATH_STYLE=0` for standard Cloudflare R2 and AWS S3 virtual-host / custom domain routing (`1` for local MinIO).

## Operator Setup Checklist (Manual Provisioning)

> **SAFETY NOTE:** Do NOT commit `.env` files and never use `NEXT_PUBLIC_*` for storage credentials. All variables below are server-only.

1. **Create Cloudflare R2 Buckets:**
   - In Cloudflare Dashboard → R2 Object Storage:
     - Create private bucket: e.g. `ustoz-private-prod`
     - Create public bucket: e.g. `ustoz-public-prod`
2. **Configure Public Access:**
   - For `ustoz-public-prod`: Connect a custom domain or enable R2 managed domain (e.g. `https://media.ustoz.uz`).
   - For `ustoz-private-prod`: Verify public access and custom domains are **COMPLETELY DISABLED**.
3. **Generate API Token:**
   - In Cloudflare Dashboard → R2 → Manage R2 API Tokens.
   - Permissions: Object Read & Write (scoped to the two buckets, least privilege).
   - Note the `Access Key ID`, `Secret Access Key`, and the S3 endpoint `https://<account_id>.r2.cloudflarestorage.com`.
4. **Configure Production Environment (e.g. Vercel / Server):**
   ```bash
   STORAGE_PROVIDER=s3
   STORAGE_S3_BUCKET=ustoz-private-prod
   STORAGE_S3_PUBLIC_BUCKET=ustoz-public-prod
   STORAGE_S3_REGION=auto
   STORAGE_S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
   STORAGE_S3_ACCESS_KEY_ID=<YOUR_R2_ACCESS_KEY_ID>
   STORAGE_S3_SECRET_ACCESS_KEY=<YOUR_R2_SECRET_ACCESS_KEY>
   STORAGE_S3_FORCE_PATH_STYLE=0
   STORAGE_PUBLIC_BASE_URL=https://media.ustoz.uz
   ```
5. **Run the Operator Smoke Test:**
   ```bash
   npm run storage:smoke
   ```
   Verifies PUT, HEAD, signed URL generation, public URL blocking on private objects, and DELETE cleanup against both bucket roles without logging secrets.

## Commands

```bash
npm run storage:status   # provider + configuration status + DB asset counts
npm run storage:cleanup  # sweep abandoned uploads (pending) & orphaned superseded objects
npm run storage:smoke   # non-destructive operational verification of S3/R2 storage
```

# Phase 22 — Security, Performance & Scalability Hardening

Phase 22 audits the production-tested Phase 21 application across security,
performance and scalability, and applies the smallest production-grade fixes the
audit justified. No behaviour was redesigned; everything below is a hardening of
an existing path.

## Security headers

`next.config.ts` now serves a header table built by the pure, tested module
`src/lib/security-headers.ts`:

- `Content-Security-Policy` — conservative allowlist: `default-src 'self'`,
  `object-src 'none'`, `base-uri 'self'`, `img-src 'self' https: data: blob:`,
  `font-src 'self' data:`, `connect-src 'self'`, `form-action 'self'` plus the
  two Payme checkout hosts. `script-src` keeps `'unsafe-inline'` because the
  App Router streams RSC payloads through inline scripts — a nonce-free
  `script-src 'self'` would break every page; a nonce-based policy needs
  per-request middleware plumbing that does not exist yet and is deferred
  explicitly (see below).
- `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone,
  geolocation, payment all disabled), `Cross-Origin-Opener-Policy: same-origin`.
- Production only: `X-Frame-Options: DENY`, `frame-ancestors 'none'`,
  `Strict-Transport-Security` (1 year + subdomains), `upgrade-insecure-requests`.
- Development only (required by the dev loop): `frame-ancestors` permits the
  sandbox preview host plus loopback, `script-src` adds `'unsafe-eval'` for HMR,
  and HSTS/upgrade are omitted. Preview and production both run with
  `NODE_ENV=production` and receive the strict policy.
- Private routes (`/dashboard*`, `/teacher/dashboard*`, `/admin*`,
  `/notifications`, `/enroll*`) additionally send `Cache-Control: no-store`.
  Dynamic 200s already receive an equally strict framework directive; the rule
  takes effect on redirects, where the framework sets none.

CSRF posture (audited, unchanged): mutations travel through Server Actions
(POST + Origin/Host check + unguessable action id). The Payme callback is
machine-to-machine Basic auth with no cookie, and the local media route is a
side-effect-free GET whose private namespace requires an HMAC capability.

## Durable rate limiting

`src/server/rate-limit.ts` is the single reusable abstraction for sensitive
mutations. Budgets are enforced in Postgres (`rate_limit_events`), because an
in-memory counter would grant the full budget on every serverless instance and
no Redis exists in this project. Messaging keeps its existing DB-derived
30/minute send guard (tested, behaviour-identical); everything else adopts this
module:

| Action | Budget |
|---|---|
| Phone login, per phone | 10 / 10 min (before argon2id) |
| Operator login, per email | 10 / 10 min (before argon2id) |
| Login/register, per IP | 60 / 10 min · register 20 / hour |
| Registration, per phone | 5 / hour |
| Enrollment submit / cancel, per student | 20 / 30 per hour |
| Review create/update/withdraw, per student | 20 / hour shared |
| Uploads (any purpose), per teacher | 30 / hour, before bytes are read |
| Payment initiation / refund request, per student | 20 / 10 per hour |

Refusals answer `{ ok: false, code: "rate_limited" }` with generic copy that
discloses no budget. A blocked attempt records nothing (no self-extending
block); races can over-admit by a small margin, which is accepted for abuse
control — money stays guarded by unique indexes and row locks. If the limiter
itself errors, it fails OPEN (the request is allowed, the failure is logged
with a code): a defence must never become an outage, and authentication still
runs. Admin decisions and the Payme callback are intentionally unlimited
(trusted operators with audit logs; provider retries that must succeed).

## Database / Neon

- **The `pg` SSL warning is resolved, not silenced.**
  `pg-connection-string` warns that `sslmode=require` is currently a
  `verify-full` alias but will weaken in pg v9. `normalizePostgresUrl()`
  (`src/server/db/postgres-url.ts`, used by the pool AND the operator CLI)
  rewrites `require`/`prefer`/`verify-ca` to explicit `verify-full` — behaviour
  is unchanged on pg v8, semantics are pinned for v9. Production additionally
  refuses a missing `sslmode`, `sslmode=disable` and unknown modes with errors
  that name the variable and never the URL.
- **Pool policy** (`src/server/db/client.ts`): `max: 10` unchanged,
  `connectionTimeoutMillis: 10s` (overload fails fast instead of hanging),
  `statement_timeout: 30s` and `idle_in_transaction_session_timeout: 30s`,
  plus an idle-client `error` listener — without it, a routine pooler-side
  close of a stale connection would crash the serverless instance.
- **Migration `0011_phase22_hardening.sql`** (the only migration; both objects
  justified, nothing else lacked an index after auditing every filter/sort/join
  path): the `rate_limit_events` table with its `(key, created_at)` index, and
  `sessions_expires_at_idx` for the expiry sweep.
- **Session hygiene**: at most 10 live sessions per user (oldest revoked on
  login, best-effort, never fails the login); the expired-session sweep now runs
  on ~10% of logins instead of every one.
- **Scalability races**: enrollment double-submit maps the unique violation to
  the honest `duplicate_request` (was `server_error`); a racing refund request
  re-reads the winner's live row and answers success (same pattern as payment
  initiation). Enrollment acceptance, review aggregates, messaging threads,
  verification/moderation queues and payments already serialised correctly
  (locks + partial unique indexes + idempotent re-reads) and are unchanged.

## Performance

- `getPublicCourseBySlug`, `getPublicTeacherBySlug` and `getPublicTeacherById`
  are request-memoized with React `cache()`: `generateMetadata` and the page
  run in the same request and used to pay for the same read twice. The cache is
  request-scoped (revalidation takes effect immediately) and a transparent
  passthrough outside React, so tests are unaffected.
- Independent reads now run together: review context (eligibility + own row +
  published list), teacher-by-id (profile + owned count), teacher capacity
  summary (capacity sum + accepted count).
- `listPublicTeachers()` groups courses by teacher in one pass instead of
  filtering the whole course list per teacher (O(T+C), same order/membership).
- Deliberately NOT changed: `force-dynamic` SSR stays everywhere (live seats
  and prices over cached snapshots — correctness over aggressive caching), and
  the student dashboard still receives the full lite catalog because saved ids
  and drafts live in browser stores; server-side saved state plus pagination
  remain the documented path to fixing that payload.

## Storage re-audit (Phase 21 architecture, unchanged)

Verified without redesign: distinct-buckets enforcement in production,
private/public key-namespace assertion on every provider call, 10-minute signed
reads clamped to 15, magic-byte content detection (SVG/HTML rejected), size
checks before buffering plus server re-checks, owner-or-reviewing-admin
authorization on private reads, DB-first delete/replace with best-effort object
removal and the time-gated cleanup CLI, immutable cache headers on public
objects with new keys on replacement, and no private object addressable through
a public URL. Two fixes only: malformed percent-encoding in the local media
route now 404s instead of throwing toward a 500, and the S3 provider docstring
no longer claims a `response-content-type` override (the stored, verified type
governs).

## Observability

`src/server/log.ts` gives new code one safe shape — scope + code + whitelisted
scalar extras, never a thrown message, payload, token, URL or credential. All
pre-existing log sites were audited and already follow it (codes only).

## Deferred with reasons

- Nonce-based CSP (`script-src` without `'unsafe-inline'`): needs middleware
  nonce plumbing; the current policy still restricts frames, plugins, base
  tags, form targets, images and fonts.
- Public marketplace ISR/caching: would serve stale seats/prices; kept dynamic.
- Dashboard catalog payload + catalog pagination: needs server-side saved state.
- `Cross-Origin-Resource-Policy`: marginal value over the shipped set, kept out
  to avoid breaking the temporary `r2.dev` delivery domain.
- A custom R2 domain: still temporary `r2.dev`, unchanged this phase.

## Commands

```bash
npm run test:phase22       # Phase 22 hardening suite (91 checks)
npm run db:migrate         # applies 0011_phase22_hardening.sql with the rest
```


# Phase 23 — Product Completion & Operations

Phase 23 closes the operational gaps found in the Phase 22 audit without adding
an external help-desk, messaging provider or broad architectural rewrite.

## Support and reports

- Signed-in users can submit an account, teacher/course, payment, inappropriate-
  content or technical report at `/support`.
- Tickets are stored in PostgreSQL and show the reporter only their own history.
  Active administrators receive an in-app `support_submitted` notification; no
  SMS or e-mail delivery is implied.
- Administrators work the bounded `/admin/support` queue. The queue is
  paginated, status-filtered and ordered oldest-first for live work. Transitions
  are `open → in_progress/resolved/closed`, with a closed ticket terminal;
  every transition is authorized, row-locked, idempotent and notifies the
  reporter in-app.
- Admin projections exclude password hashes, session tokens, payment-provider
  credentials and signed private-media URLs. Do not put secrets or card data in
  a report message.

## Account and course lifecycle

- `/account` provides password rotation (current-password verification and
  all-session revocation) and explicit account deactivation. Deactivation is a
  data-preserving state: authentication and sessions stop, teacher directory
  visibility stops, and enrollments, payments, courses and audit history remain
  for reconciliation. There is no in-app reactivation or destructive delete.
- Teacher listings now have explicit `published → paused → published` and
  `paused → archived` controls. Archival is terminal; content, enrollment and
  payment records are retained. Draft, review and archived courses never enter
  the public catalog, and deactivated accounts cannot expose their courses.
- Course and verification submissions notify active administrators in-app. The
  existing moderation and verification decisions remain separate, audited
  workflows; approval never silently publishes a course.

## Health and maintenance

- `/api/health` and `/api/health/live` are dependency-free liveness checks.
  `/api/health/ready` runs `select 1` against PostgreSQL and returns only
  `ready` or `not_ready`; URLs, credentials and stack traces are never returned.
- `npm run ops:cleanup -- --dry-run --limit=500` previews a bounded sweep of
  expired session rows. Re-run without `--dry-run` to apply it. The command
  prints counts only, never secrets, and exits non-zero on an operational
  failure. It never deletes users, enrollments, payments, support tickets,
  audit history or media.
- `npm run storage:cleanup` remains the separate bounded media cleanup command;
  its failure exit status is preserved for cron/CI observability.

## Phase 23 schema and QA commands

Migration `0012_phase23_operations.sql` is additive: it adds account/support
status enums, the course archive timestamp, the support ticket table and
notification enum values. Support status/reporter/related/assignee indexes,
plus the existing session and queue indexes, support growing operational reads.
No data migration or remote database operation is performed by the build.

```bash
npm run test:phase23       # support, lifecycle, account, cleanup and health checks
npm run db:generate        # should report no schema changes after generation
npm run ops:cleanup -- --dry-run --limit=500
```

The product intentionally does not ship provider-backed e-mail/SMS, an admin
account reactivation UI, hard deletion of business records, live-course content
editing, automatic scheduling, or a background job platform. These are explicit
boundaries rather than placeholder controls.
