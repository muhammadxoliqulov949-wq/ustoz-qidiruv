# USTOZ homepage storytelling design QA

## Evidence

- Source visual truth: the eight supplied 1672 × 941 reference images mapped to Hero, Categories, Recommended Courses, Online / Offline, Top Teachers, How It Works, Trust and Teacher CTA.
- Implementation branch: `codex/homepage-reference-rebuild`.
- Storytelling implementation commit: `b532c3961e97e97d66db06c66be51eea3514370c`.
- Reverse-scroll QA fix commit: `5d81202e7187622d4d447cb5a3a5b74b080ecad8`.
- Vercel Preview deployment: `dpl_9ebPmCESkBXPEHKR8xMJbiypiMTK`.
- Preview URL: `https://ustoz-qidiruv-hmh8q5zng-muhammadxoliqulov949-6811s-projects.vercel.app`.
- Vercel state: `READY`; target is Preview (`target: null`), not Production.
- Browser-rendered QA viewport available in this environment: 1363 × 936 CSS px.
- The Preview rendered all eight chapter wrappers and the complete homepage.

## Browser-rendered findings

- Hero: header, eyebrow, headline, supporting copy, search, quick filters, right-side state and trust strip are visible as one complete first-fold composition at 1363 × 936.
- Full story: scrolled down through all eight chapters and back up through the Trust / Teacher CTA transition.
- No horizontal overflow was reported at any sampled scroll position (`scrollWidth === clientWidth`).
- Native scrolling remained responsive; no wheel interception, scroll lock or global snapping was present.
- Process and Trust sticky scenes entered and released without trapping the page.
- Sampled interactive controls passed centre-point hit testing and retained `pointer-events: auto`.
- Reverse scrolling now preserves `data-story-direction="up"` after the scroll settles; equal-position observer frames no longer overwrite it with `down`.
- Browser console contained no application-origin errors. Two logged errors came from the cloud-browser Chrome extension, not the Preview.
- Vercel reported no preview runtime `error` or `fatal` logs for the new deployment.
- The Preview catalogue is empty, so course and teacher areas correctly show their honest empty states instead of fabricated marketplace records.

## Motion and accessibility verification

- One `HomeStory` coordinator owns scroll progress; there are no scattered page-level scroll listeners.
- Desktop choreography uses transform/opacity-only 3D depth and limited sticky closing chapters.
- Tablet/mobile CSS removes layered 3D choreography and uses the simplified translate/fade path.
- `prefers-reduced-motion: reduce` removes 3D transforms, parallax and sticky choreography while preserving every chapter and interaction.
- Reduced-motion behavior was verified from the implementation and existing motion suite; the available cloud browser could not switch its OS media preference for a second rendered capture.

## Automated verification

- TypeScript: passed, 0 errors.
- ESLint for the changed coordinator: passed, 0 errors.
- Production build: passed.
- Phase 25 motion suite: 30 passed, 0 failed.
- Previous complete regression run: 14 suites, 1,571 passed, 0 failed.
- Vercel Preview build: READY.
- No backend, database, auth, API, payment or migration changes.

## Remaining manual visual matrix

The cloud browser is fixed at 1363 × 936 and exposes no viewport-emulation control. The exact requested capture matrix therefore remains a visual-review task on the READY Preview:

1. Hero: 1366×768, 1440×900, 1536×864 and 1920×1080.
2. Full story: widths 1440, 1024, 768, 430, 390 and 360.
3. Repeat one down/up pass with reduced motion enabled.

The responsive implementation is present for all requested breakpoints, but those exact sizes are not marked as browser-rendered passes without evidence.

final result: preview ready; available-browser QA passed; exact viewport matrix pending visual review
