"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Badge, Button, IconButton } from "@/components/ui";
import { teachersPage } from "@/data/site";
import { formatCount } from "@/lib/format";
import {
  TeacherFilterPanel,
  type TeacherFilterPanelProps,
} from "./teacher-filter-panel";

/* -------------------------------------------------------------------------- */
/* Mobile / tablet filter sheet for /teachers — the Phase 3 sheet recipe,        */
/* re-expressed for the teacher facets (no price form): role=dialog, aria-modal, */
/* Escape + backdrop close, body scroll lock, initial focus, Tab trap, focus     */
/* returned to the trigger, footer CTA carrying the LIVE filtered count.          */
/* -------------------------------------------------------------------------- */

export interface TeacherFilterSheetProps extends TeacherFilterPanelProps {
  resultCount: number;
  activeCount: number;
}

export function TeacherFilterSheet({
  resultCount,
  activeCount,
  ...panelProps
}: TeacherFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = "teacher-filter-sheet-title";

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const raf = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("button, a, input, select")
        ?.focus();
    });
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const trapTab = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        leadingIcon={<SlidersHorizontal className="size-4" />}
        trailingIcon={
          activeCount > 0 ? (
            <Badge variant="accent" tone="soft">
              {activeCount}
            </Badge>
          ) : null
        }
      >
        {teachersPage.sheet.open}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden" onKeyDown={trapTab}>
          <button
            type="button"
            aria-label={teachersPage.sheet.close}
            onClick={close}
            className="absolute inset-0 cursor-default bg-ink-900/25"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={
              "absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col " +
              "rounded-t-3xl bg-surface shadow-raised sm:mx-auto sm:max-w-md"
            }
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 id={titleId} className="text-lg font-semibold text-ink-900">
                {teachersPage.sheet.title}
              </h2>
              <IconButton label={teachersPage.sheet.close} icon={<X />} onClick={close} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <TeacherFilterPanel {...panelProps} variant="sheet" />
            </div>

            <div className="border-t border-line p-4">
              <Button fullWidth onClick={close}>
                {formatCount(resultCount)} {teachersPage.sheet.cta}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
