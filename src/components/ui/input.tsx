import { forwardRef, useId } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* The ONE field skin in the design system.                                    */
/* Input uses it directly; SearchInput (and future filter fields) compose      */
/* on top of it — never re-declare input chrome anywhere else.                 */
/* -------------------------------------------------------------------------- */
export const fieldBaseClasses = cn(
  "w-full border border-white/12 bg-white/[0.06] text-ink-900 shadow-xs backdrop-blur-sm",
  "placeholder:text-ink-500",
  "transition-[border-color,box-shadow,background-color] duration-fast",
  "hover:border-white/18 hover:bg-white/[0.08]",
  "focus:border-accent-600/60 focus:outline-none focus:bg-surface",
  "focus:ring-[length:var(--size-focus-ring)] focus:ring-accent-600/25",
  "aria-[invalid=true]:border-danger/60 aria-[invalid=true]:bg-danger-soft/40",
  "disabled:cursor-not-allowed disabled:opacity-55",
  "read-only:cursor-default read-only:bg-surface-muted read-only:shadow-none",
);

type Size = "md" | "lg";

/** Shared field sizing — Input, SelectField and TextareaField all use it so
 *  every labelled control has one skin (Phase 6). */
export const fieldSizeClasses: Record<Size, string> = {
  md: "h-[var(--size-control-md)] rounded-lg px-3.5 text-base",
  lg: "h-[var(--size-control-lg)] rounded-lg px-4 text-lg",
};

/* -------------------------------------------------------------------------- */

export interface InputProps
  extends Omit<ComponentPropsWithoutRef<"input">, "className" | "size"> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  size?: Size;
  className?: string;
  inputClassName?: string;
}

/**
 * Labelled text field with hint/error messaging and a11y wiring.
 * `label` renders visually above the field; when omitted, provide your
 * own <label> or aria-label (see SearchInput for that pattern).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leadingIcon,
    trailingSlot,
    size = "md",
    className,
    inputClassName,
    id,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint || error ? `${inputId}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-700">
          {label}
        </label>
      ) : null}

      <div className="relative flex items-center">
        {leadingIcon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 flex text-ink-400 [&>svg]:size-5"
          >
            {leadingIcon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hintId}
          className={cn(
            fieldBaseClasses,
            fieldSizeClasses[size],
            leadingIcon && "pl-11",
            trailingSlot && "pr-11",
            inputClassName,
          )}
          {...rest}
        />

        {trailingSlot ? (
          <span className="absolute right-2 flex items-center">{trailingSlot}</span>
        ) : null}
      </div>

      {hint || error ? (
        <p
          id={hintId}
          /*
           * Phase 24 a11y: an error appears after submit, long after the field
           * was focused, so it is announced as an alert instead of waiting for
           * the user to rediscover it. Hints stay quiet (no role) — they are
           * already reachable through aria-describedby.
           */
          {...(error ? { role: "alert" } : {})}
          className={cn(
            "motion-feedback flex items-start gap-1 text-sm",
            error ? "text-danger" : "text-ink-500",
          )}
        >
          {error ? (
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0"
            />
          ) : null}
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
});
