# USTOZ homepage design QA

## Evidence

- Source visual truth:
  - `/workspace/scratch/ed8a0c1d04a9/upload/1-rasm(2).png` — Hero
  - `/workspace/scratch/ed8a0c1d04a9/upload/2-rasm(2).png` — Popular Categories
  - `/workspace/scratch/ed8a0c1d04a9/upload/3-rasm(2).png` — Recommended Courses
  - `/workspace/scratch/ed8a0c1d04a9/upload/4-rasm(2).png` — Online / Offline
  - `/workspace/scratch/ed8a0c1d04a9/upload/5-rasm(2).png` — Top Teachers
  - `/workspace/scratch/ed8a0c1d04a9/upload/6-rasm(2).png` — How It Works
  - `/workspace/scratch/ed8a0c1d04a9/upload/7-rasm(2).png` — Teacher CTA
  - `/workspace/scratch/ed8a0c1d04a9/upload/8-rasm(2).png` — Trust / Why USTOZ
- Source dimensions: all eight references are 1672 × 941 px.
- Implementation target: GitHub branch `codex/homepage-reference-rebuild`, commit `210d9c2edb47daacb17c27de68069b1c09f602cf`.
- Vercel Preview deployment attempts:
  - `dpl_HYZ3d8gWogoNcrxs9CvQTguMXcpS`
  - `dpl_9u1z5V9NftMxRvy49n37K2jVbuvt`
- Implementation screenshot path: unavailable.
- Browser-rendered viewport: unavailable.
- State: homepage with development catalogue data was prepared for local QA, but the preview could not be opened in Cloud Browser.
- Density normalization: not applicable because no implementation capture was produced.

## Full-view comparison evidence

Blocked. Both Vercel Preview attempts stopped before the application build with:

`BUILD_FAILED: Resource provisioning failed`

The local Cloud Browser fallback was also blocked. `sites-preview` first failed on Next.js CLI flag compatibility, then the isolated preview runtime failed with:

`bwrap: setting up uid map: Operation not permitted`

The browser therefore returned `net::ERR_CONNECTION_REFUSED`. No visual claim is made from source code or memory alone.

## Focused-region comparison evidence

Blocked for the same reason. Hero, category bento, course composition, format panels, teacher cards, process cards, teacher CTA and trust cards could not be captured from a browser-rendered implementation.

## Automated verification completed

- TypeScript: passed (`npx tsc --noEmit`).
- ESLint: passed with 0 errors and one pre-existing warning in `scripts/phase24-qa.ts`.
- Production build: passed (`next build`).
- Phase 25 motion suite: 30 passed, 0 failed.
- All existing server/domain suites: passed.
- Reduced-motion rules remain present and tested.
- No horizontal-overflow browser assertion could be recorded because the page never opened in Cloud Browser.
- Primary interactions and browser console errors could not be checked.

## Findings

- [P0] Browser-rendered design verification is unavailable.
  - Location: full homepage and all responsive breakpoints.
  - Evidence: Vercel provisioning failed twice before build; local browser preview could not start inside the sandbox.
  - Impact: composition, exact spacing, image crops, card geometry, responsive behavior and console cleanliness cannot be honestly marked as verified.
  - Fix: resolve the Vercel resource-provisioning integration, create a READY Preview for the branch, then capture and compare every section.

## Required next QA pass

1. Open the actual READY Vercel Preview.
2. Capture 1440, 1024, 768, 430, 390 and 360 CSS-pixel widths.
3. Compare every matching section against its numbered source image.
4. Check typography, spacing, colors, image quality/crop and copy at readable scale.
5. Test hero search, quick-filter links, category links, course links, teacher links, teacher CTA and mobile menu.
6. Check keyboard focus order, reduced motion, touch targets, horizontal overflow and browser console errors.
7. Fix any P0/P1/P2 differences and repeat the comparison before approval.

## Comparison history

- Pass 1: Vercel Git Preview for `b68d261…` — blocked by resource provisioning.
- Pass 2: Vercel Git Preview retry for `210d9c2…` — same resource-provisioning failure; no application-code changes were made to work around infrastructure.
- Pass 3: local Cloud Browser fallback — blocked by the preview sandbox permission error; no implementation screenshot was available.

final result: blocked
