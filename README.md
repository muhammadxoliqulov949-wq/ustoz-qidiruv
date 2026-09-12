# USTOZ — Frontend

Marketplace for finding courses and teachers (Uzbekistan). This repository
implements the approved USTOZ Master Frontend Specification phase by phase:
**Phase 1** foundation (tokens, primitives, header, hero), **Phase 2** the
full homepage, **Phase 3** browse & search (`/courses` results engine +
`/categories` routes), **Phase 4** course detail pages
(`/courses/[slug]`), and **Phase 5** teacher discovery + profiles
(`/teachers`, `/teachers/[slug]`). Auth and everything after land in
later phases.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19
- TypeScript (strict)
- Tailwind CSS v4 — design tokens live in CSS (`@theme`), no JS config
- `lucide-react` — single icon library for the whole app
- Self-hosted Inter (`@fontsource-variable/inter`) with system-font fallback

## Commands

```bash
npm run dev      # dev server (0.0.0.0:3000)
npm run build    # production build (offline-safe: fonts are self-hosted)
npm run lint     # eslint
npx tsc --noEmit # typecheck
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
