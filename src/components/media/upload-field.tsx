"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  MAX_BYTES_BY_PURPOSE,
  MEDIA_UPLOAD_FAILED_NOTE,
  acceptAttribute,
  formatBytes,
  uploadRulesText,
  type FilePurpose,
} from "@/lib/media";

/* -------------------------------------------------------------------------- */
/* UploadField — Phase 18. The ONE upload control in the product.              */
/*                                                                              */
/* WHY A LABEL, NOT A BUTTON, OPENS THE PICKER: a `<label htmlFor>` around a    */
/* hidden `<input type="file">` is keyboard- and screen-reader-friendly without  */
/* a single line of scripting, and it keeps working if hydration is slow.       */
/*                                                                              */
/* WHAT THIS COMPONENT IS NOT ALLOWED TO DO: decide that an upload succeeded.    */
/* The server action is the authority; this control shows "Yuklanmoqda…", then  */
/* the action's real answer. No fake percentage, no optimistic "done".          */
/* -------------------------------------------------------------------------- */

export type UploadActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; code: string; message: string };

export interface UploadFieldProps {
  /** Fixes the allow-list, the size limit and the label wording. */
  purpose: FilePurpose;
  /** Server action, imported by a SERVER parent and passed down. */
  action: (form: FormData) => Promise<UploadActionResult>;
  /** Extra hidden fields (e.g. `courseId`, `documentType`). Validated server-side. */
  extraFields?: Record<string, string>;
  /** Visible label text for the picker. */
  label: string;
  /** Replaces the default action wording once a file is chosen. */
  busyLabel?: string;
  helpText?: string;
  /** Uploads are unavailable (storage not configured) — say why, don't hide it. */
  disabledNote?: string | null;
  className?: string;
}

export function UploadField({
  purpose,
  action,
  extraFields,
  label,
  busyLabel = "Yuklanmoqda…",
  helpText,
  disabledNote,
  className,
}: UploadFieldProps) {
  const inputId = useId();
  const statusId = `${inputId}-status`;
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    { tone: "ok" | "error"; text: string } | null
  >(null);

  const disabled = Boolean(disabledNote);
  const limit = MAX_BYTES_BY_PURPOSE[purpose];

  function pick(file: File | null): void {
    if (!file) return;
    /*
     * Cheap pre-flight so an obviously wrong file never leaves the browser.
     * The SERVER repeats every one of these checks against the real bytes —
     * this is courtesy, not authority.
     */
    if (file.size === 0) {
      fail("Fayl bo‘sh — yaroqli fayl tanlang.");
      return;
    }
    if (file.size > limit) {
      fail(`Fayl hajmi juda katta: ruxsat etilgan chegara ${formatBytes(limit)}.`);
      return;
    }

    const form = new FormData();
    form.set("file", file);
    for (const [key, value] of Object.entries(extraFields ?? {})) form.set(key, value);

    setState(null);
    startTransition(async () => {
      const result = await action(form);
      if (result.ok) {
        setState({ tone: "ok", text: "Fayl yuklandi." });
        router.refresh();
      } else {
        fail(result.message || MEDIA_UPLOAD_FAILED_NOTE);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function fail(text: string): void {
    setState({ tone: "error", text });
    // Focus management: an error must be reachable without hunting for it.
    requestAnimationFrame(() => statusRef.current?.focus());
  }

  return (
    <div className={className ? `flex flex-col gap-2 ${className}` : "flex flex-col gap-2"}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptAttribute(purpose)}
        className="sr-only"
        disabled={disabled || pending}
        aria-describedby={statusId}
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          loading={pending}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {label}
        </Button>
        <span className="text-sm text-ink-500">
          {disabledNote ?? helpText ?? uploadRulesText(purpose)}
        </span>
      </div>
      <p
        id={statusId}
        ref={statusRef}
        role={state?.tone === "error" ? "alert" : "status"}
        tabIndex={-1}
        className={
          state === null
            ? "sr-only"
            : state.tone === "ok"
              ? "text-sm font-medium text-accent-700"
              : "text-sm font-medium text-red-700"
        }
      >
        {pending ? busyLabel : (state?.text ?? "")}
      </p>
    </div>
  );
}
