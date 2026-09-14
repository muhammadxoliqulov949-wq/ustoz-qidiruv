"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui";
import { sendMessageAction } from "@/server/actions/messaging";
import { MESSAGE_BODY_MAX_LENGTH, MESSAGING_COPY } from "@/lib/messaging";

/* -------------------------------------------------------------------------- */
/* Message composer — Phase 16. The ONLY client island in the thread.           */
/*                                                                              */
/* Keyboard contract: Enter inserts a newline (a message is multi-line text),    */
/* the explicit Send button submits, and ⌘/Ctrl+Enter is a documented shortcut.  */
/* Feedback is announced through a polite live region that exists in the DOM     */
/* from the first render, so nothing appears and disappears below the fold.      */
/*                                                                              */
/* The island never names a sender: the action's schema accepts a conversation   */
/* id and a body, and identity comes from the session cookie. As soon as a send  */
/* succeeds the router refreshes, so the thread, the list and the nav badges all */
/* re-render from the database rather than from local state.                     */
/* -------------------------------------------------------------------------- */

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const fieldId = useId();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const tooLong = value.length > MESSAGE_BODY_MAX_LENGTH;
  const empty = trimmed.length === 0;

  function send() {
    if (pending || empty || tooLong) return;
    setStatus(null);
    const form = new FormData();
    form.set("conversationId", conversationId);
    form.set("body", value);
    startTransition(async () => {
      const result = await sendMessageAction(form);
      if (result.ok) {
        setValue("");
        setStatus({ tone: "ok", text: MESSAGING_COPY.sentNotice });
        router.refresh();
        textareaRef.current?.focus();
        return;
      }
      setStatus({ tone: "error", text: result.message ?? MESSAGING_COPY.failedNotice });
    });
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label htmlFor={fieldId} className="text-sm font-medium text-ink-700">
        {MESSAGING_COPY.composerLabel}
      </label>
      <textarea
        ref={textareaRef}
        id={fieldId}
        name="body"
        rows={3}
        value={value}
        disabled={pending}
        aria-describedby={`${fieldId}-hint`}
        aria-invalid={tooLong || undefined}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // Enter keeps its newline; the documented shortcut sends.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            send();
          }
        }}
        className="w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-base leading-relaxed text-ink-900 shadow-xs outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-200"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`${fieldId}-hint`} className="max-w-prose text-xs leading-relaxed text-ink-500">
          {MESSAGING_COPY.composerHint} Enter — yangi qator, {`⌘/Ctrl+Enter`} — yuborish.
        </p>
        <p
          className={
            tooLong ? "text-xs font-medium text-red-700" : "text-xs text-ink-500"
          }
        >
          {value.length} / {MESSAGE_BODY_MAX_LENGTH}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || empty || tooLong}>
          <Send aria-hidden="true" className="size-4" />
          {pending ? MESSAGING_COPY.sendingLabel : MESSAGING_COPY.sendLabel}
        </Button>
        {/* Always in the DOM: the announcement has a place to land. */}
        <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm">
          {status ? (
            <span className={status.tone === "ok" ? "font-medium text-ink-900" : "font-medium text-red-700"}>
              {status.text}
            </span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
