# Phase 26 visual audit

## Baseline

Phase 25 is structurally strong: spacing, contrast, responsive behavior and motion are consistent. The weakness is visual hierarchy rather than usability.

## Findings

1. The homepage hero is typographically clear but visually flat; its centred composition does not create a distinctive USTOZ focal point on wide screens.
2. Most cards use the same white fill, line and small shadow, so catalogue, filters and dashboard metrics read at nearly the same elevation.
3. Auth pages have good content hierarchy but appear as loose content on the canvas rather than a deliberate secure entry surface.
4. Dashboard identity, status and action surfaces are easy to use, but separation between navigation, metrics and primary action is weak.
5. Admin panels are efficient but visually identical to public cards; they need stronger surface separation without decoration.
6. Existing emerald, warm canvas and rounded geometry already form a useful identity. A new palette or visual library would fragment it.

## Phase 26 direction

- Level 0: warm canvas with a restrained emerald ambient glow.
- Level 1: quiet grouped surfaces.
- Level 2: elevated cards and controls.
- Level 3: featured hero, filter, auth and identity surfaces.
- Level 4: existing Phase 25 dialogs and floating panels.

The hero depth object retains its fixed CSS frame and fallback geometry. A locally hosted, compressed editorial illustration now fills that frame on large screens; explicit dimensions are supplied through `next/image`, it remains hidden below the large breakpoint, and no video or runtime third-party request is introduced.

## R2 completion pass

R2 extends the depth system beyond the hero: homepage sections now have grouped editorial shells; course, teacher and category cards have distinct media and information treatments; browse pages use the ambient canvas; course and teacher detail headers are conversion-focused featured surfaces; and student, teacher and admin shells share premium identity and metric patterns.

### Higgsfield evaluation

Three USTOZ-specific concepts were submitted for evaluation: an editorial knowledge-plane hero, a layered course/mentor marketplace composition, and a six-part category visual system. Higgsfield rejected all three before generation with `Requires basic plan or higher`; no credits were charged and no assets were produced. The final implementation therefore keeps the lighter CSS-only visual system and does not claim generated imagery was reviewed.

### Runway fallback evaluation

Runway generated three USTOZ-specific editorial learning-path concepts. Option one was rejected because it introduced illegible generated text. Options two and three matched the emerald/ivory identity and education-path metaphor; option two was selected for its strongest negative space, restrained detail and clean hierarchy. The 1376×768 source is approximately 128 KB, is served locally through `next/image`, is decorative (`alt=""`), and has no mobile download because the containing visual is hidden below the large breakpoint.

## Reference principles

- Editorial split hero: message and search remain primary; depth supports them rather than competing.
- Layered marketplace cards: border tone, highlight and shadow work as one system.
- Dashboard restraint: clearer grouping, no decorative charts or invented metrics.
- Glass only for floating UI: controlled blur is not used as a general card treatment.
