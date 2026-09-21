import { forwardRef, useId } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldBaseClasses } from "./input";

/* -------------------------------------------------------------------------- */
/* TextareaField — the Input recipe for multi-line text: same skin, same        */
/* label/hint/error a11y wiring. `counter` renders a live "chars / max" line    */
/* beside the hint (used by the teacher bio/approach steps).                    */
/* -------------------------------------------------------------------------- */

export interface TextareaFieldProps
  extends Omit<ComponentPropsWithoutRef<"textarea">, "className"> {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  textareaClassName?: string;
  /** Current length — renders "N / max" in the hint row when provided. */
  counter?: { value: number; max: number };
  children?: ReactNode;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField(
    { label, hint, error, className, textareaClassName, counter, children, id, rows = 5, ...rest },
    ref,
  ) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const hintId = hint || error || counter ? `${fieldId}-hint` : undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label ? (
          <label htmlFor={fieldId} className="text-sm font-medium text-ink-700">
            {label}
          </label>
        ) : null}

        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={hintId}
          className={cn(
            fieldBaseClasses,
            "rounded-lg px-3.5 py-2.5 text-base leading-relaxed",
            textareaClassName,
          )}
          {...rest}
        >
          {children}
        </textarea>

        {hint || error || counter ? (
          <p
            id={hintId}
            {...(error ? { role: "alert" } : {})}
            className={cn(
              "flex items-start justify-between gap-3 text-sm",
              error ? "text-danger" : "text-ink-500",
            )}
          >
            <span className="flex items-start gap-1">
              {error ? (
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0"
                />
              ) : null}
              {error ?? hint}
            </span>
            {counter ? (
              <span className="ml-auto shrink-0 tabular-nums text-ink-500">
                {counter.value} / {counter.max}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    );
  },
);
