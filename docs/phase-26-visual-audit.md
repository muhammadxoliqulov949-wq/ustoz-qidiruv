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

The hero depth object is CSS-only: no network request, layout shift, autoplay media or mobile cost. It is hidden below the large breakpoint. Generated image/video assets were intentionally omitted because they would add weight without improving marketplace comprehension.

## Reference principles

- Editorial split hero: message and search remain primary; depth supports them rather than competing.
- Layered marketplace cards: border tone, highlight and shadow work as one system.
- Dashboard restraint: clearer grouping, no decorative charts or invented metrics.
- Glass only for floating UI: controlled blur is not used as a general card treatment.

