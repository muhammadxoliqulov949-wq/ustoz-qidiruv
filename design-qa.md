# USTOZ homepage storytelling design QA

## Evidence

- Source visual truth: the eight supplied 1672 × 941 reference images mapped to Hero, Categories, Recommended Courses, Online / Offline, Top Teachers, How It Works, Trust and Teacher CTA.
- Implementation branch: `codex/homepage-reference-rebuild`.
- Implementation commit: `b532c3961e97e97d66db06c66be51eea3514370c`.
- Vercel Preview deployment: `dpl_DQeWVTK4TaavJ5AHvVq48iX9ipV9`.
- Preview URL: `https://ustoz-qidiruv-m3ptoqjd3-muhammadxoliqulov949-6811s-projects.vercel.app`.
- Vercel state: `READY`; target is Preview (`target: null`), not Production.
- Server-rendered implementation: verified with HTTP 200 and all eight chapter wrappers present in the returned homepage markup.
- Implementation screenshot path: unavailable.
- Browser viewport and pixel-density normalization: unavailable because the cloud browser session disconnected before capture.

## Full-view comparison evidence

Blocked for visual comparison.

The READY Preview returned the complete homepage successfully, but the cloud browser connection failed before a screenshot could be captured. The selected workspace then went offline, and the browser-control capability was no longer available.

The earlier local browser fallback was independently blocked by:

`bwrap: setting up uid map: Operation not permitted`

No visual claim is inferred from source code, the server response, or memory.

## Focused-region comparison evidence

Blocked for the same browser-capture reason. Hero first fold, category bento, course focus card, format split, teacher portraits, process cards, trust cards and final teacher CTA could not be compared side by side with the references.

## Implementation completed

- Hero height now accounts for the real 84px desktop header and uses `svh`, `clamp()`, height-aware typography and bounded teacher-stage sizing.
- One client-side `HomeStory` coordinator publishes reversible entry, exit, focus and progress values for all chapters.
- Reusable `StoryChapter` wrappers provide the eight chapter sequence.
- Scroll remains browser-native: no wheel interception, global scroll snapping or scroll lock.
- Desktop choreography uses transform/opacity-only 3D depth and limited sticky closing chapters.
- Tablet/mobile use a simplified translate/fade path with no layered 3D sequence.
- `prefers-reduced-motion: reduce` removes 3D transforms, parallax and sticky choreography while preserving every chapter.
- Homepage chapter order is now Hero → Categories → Courses → Formats → Teachers → How It Works → Trust → Teacher CTA.
- Dashboard, admin, auth and operational pages were not changed.

## Automated verification

- TypeScript: passed, 0 errors.
- ESLint: passed, 0 errors.
- Production build: passed.
- All 14 existing suites: 1,571 passed, 0 failed.
- Phase 25 motion suite: 30 passed, 0 failed.
- Vercel Preview build: READY.
- Preview homepage request: HTTP 200.
- No backend, database, auth, API, payment or migration changes.

## Findings

- [P0] Required browser-rendered visual acceptance is unavailable.
  - Location: all requested desktop, tablet and mobile viewports.
  - Evidence: browser capture disconnected and the selected environment went offline after the Preview became READY.
  - Impact: exact first-fold containment, horizontal overflow, sticky transitions, reverse-scroll visuals, readable overlaps and console cleanliness cannot be honestly marked as visually passed.
  - Fix: open the READY Preview in a working browser session and run the viewport matrix below.

## Required final browser pass

1. Hero first fold: 1366×768, 1440×900, 1536×864 and 1920×1080.
2. Full story: widths 1440, 1024, 768, 430, 390 and 360.
3. Scroll down and back up through all eight chapters.
4. Check horizontal overflow, scroll trapping, sticky release, text overlap, layout shift and blocked links.
5. Verify the same states with reduced motion enabled.
6. Inspect browser console and primary search/filter/CTA interactions.
7. Capture same-state screenshots and compare them with the eight reference images.

## Comparison history

- Previous homepage implementation: Vercel provisioning blocked.
- Storytelling revision: Vercel Preview reached READY and returned HTTP 200.
- Visual capture: blocked by cloud browser/workspace disconnection after deployment.

final result: blocked
