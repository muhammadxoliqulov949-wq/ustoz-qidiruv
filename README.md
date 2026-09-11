# USTOZ — Frontend

Marketplace for finding courses and teachers (Uzbekistan). This repository
implements the **Phase 1 foundation** per the approved USTOZ Master Frontend
Specification: design tokens, global layout, UI primitives, navigation and the
hero of the homepage. Marketplace pages arrive in later phases.

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
  **Bottom navigation is intentionally not built yet** (Phase 2 mobile spec).

## Component inventory

`src/components/ui/` (import via `@/components/ui`):

| Component | Notes |
| --- | --- |
| `Button`, `ButtonLink` | 5 variants × 3 sizes, `loading`, icon slots; `ButtonLink` keeps `<Link>` semantics |
| `IconButton` | requires accessible `label`; `onDark` variant for dark surfaces |
| `Input` | labelled field; hint/error slots; exports the shared `fieldBaseClasses` skin |
| `SearchInput` | `md` (header) / `lg` (lists, Phase 2) / `xl` (hero); form-wrapped, clearable, submit callback |
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
`public/media/`.

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
- Links to not-yet-built routes use `prefetch={false}` (Phase 2 removes it).

## Deliberately deferred

`/courses` results page, category pages, course/teacher detail pages,
auth (Kirish flow), dashboards, filters drawer, payment, messaging, real
API, dark mode evaluation, i18n (`/uz`, `/ru`…), mobile bottom navigation.
