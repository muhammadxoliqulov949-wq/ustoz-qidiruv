"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button, ButtonLink, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface EnrollDialogProps {
  /** Course display title shown in the dialog summary. */
  courseTitle: string;
  /** Selected group summary line, e.g. "A guruhi · Du, Chor · soat 19:00". */
  groupSummary: string;
  /** Price line, e.g. "320 000 so'm / oyiga" or "Bepul". */
  priceSummary: string;
  /** CTA label for the trigger (card: "Kursga yozilish", bar: "Yozilish"). */
  triggerLabel: string;
  triggerClassName?: string;
  /** Card fills its rail (default); the mobile bar lets price share the row. */
  triggerFullWidth?: boolean;
  titleId: string;
}

/**
 * Enrollment entry point (Phase 4). Clicking never fakes enrollment: the
 * dialog shows the selected course/group summary and hands off to auth —
 * /login and /register are real routes since Phase 6; completing an
 * enrollment additionally needs the auth backend, so the copy below stays
 * honest. Self-contained (trigger + dialog) so the enrollment card and the
 * mobile bar can each host one without shared client state; a future
 * checkout flow mounts over the same trigger slot.
 *
 * Dialog semantics match the Phase 3 filter sheet (same platform recipe):
 * role=dialog + aria-modal, labelled, Escape/backdrop close, body scroll
 * lock, Tab trap, initial focus on the panel, focus returned to the trigger.
 */
export function EnrollDialog({
  courseTitle,
  groupSummary,
  priceSummary,
  triggerLabel,
  triggerClassName,
  triggerFullWidth = true,
  titleId,
}: EnrollDialogProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the control that opened the dialog.
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const raf = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  // Simple Tab trap inside the panel.
  const trapTab = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
        size="lg"
        fullWidth={triggerFullWidth}
        className={triggerClassName}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {triggerLabel}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" onKeyDown={trapTab}>
          {/* Backdrop (click to dismiss) */}
          <button
            type="button"
            aria-label="Dialogni yopish"
            onClick={close}
            className="absolute inset-0 cursor-default bg-ink-900/25"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
              "relative z-10 w-full max-w-md rounded-t-3xl bg-surface shadow-raised outline-none",
              "sm:rounded-3xl",
              "flex max-h-[88dvh] flex-col",
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-ink-900">
                  Kursga yozilish
                </h2>
                <p className="mt-0.5 text-sm text-ink-500">
                  Tanlovni tekshiring va davom etish uchun tizimga kiring.
                </p>
              </div>
              <IconButton label="Yopish" icon={<X />} onClick={close} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {/* Step 1 — selection summary */}
              <dl className="rounded-xl border border-line bg-surface-muted px-4 py-1 text-sm">
                <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
                  <dt className="text-ink-500">Kurs</dt>
                  <dd className="text-end font-medium text-ink-900">{courseTitle}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
                  <dt className="text-ink-500">Guruh</dt>
                  <dd className="text-end font-medium text-ink-900">{groupSummary}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5 last:border-b-0">
                  <dt className="text-ink-500">Narx</dt>
                  <dd className="text-end font-medium text-ink-900">{priceSummary}</dd>
                </div>
              </dl>

              {/* Step 2 — auth handoff (real routes since Phase 6) */}
              <p className="mt-4 text-sm text-ink-700">
                Yozilish shaklini to‘ldirish va ustozga so‘rov yuborish uchun
                hisob kerak bo‘ladi: telefon raqami va izoh so‘raladi. To‘lov
                shartlarini ustoz bilan bevosita kelishasiz.
              </p>
              <div className="mt-4 flex flex-col gap-2.5 pb-1">
                <ButtonLink href="/login" size="lg" fullWidth>
                  Kirish
                </ButtonLink>
                <ButtonLink href="/register" size="lg" variant="outline" fullWidth>
                  Ro‘yxatdan o‘tish
                </ButtonLink>
              </div>
              <p className="pb-4 text-center text-xs text-ink-400">
                Kirish va ro‘yxatdan o‘tish sahifalari ishlaydi; yozilishni
                yakunlash uchun autentifikatsiya serveri ulangishi kerak —
                hozircha yozilishni ustoz bilan bevosita ham kelishish mumkin.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
