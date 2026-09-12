import { forwardRef, useId } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldBaseClasses, fieldSizeClasses } from "./input";

/* -------------------------------------------------------------------------- */
/* SelectField — labelled native <select> on the ONE field skin (same label /  */
/* hint / error wiring as Input). Native by design: keyboard, mobile wheels    */
/* and screen-reader support come free; the chevron is decoration only.         */
/* -------------------------------------------------------------------------- */

export interface SelectFieldProps
  extends Omit<ComponentPropsWithoutRef<"select">, "className" | "size"> {
  label?: string;
  hint?: string;
  error?: string;
  size?: "md" | "lg";
  className?: string;
  selectClassName?: string;
  children: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField(
    { label, hint, error, size = "md", className, selectClassName, children, id, ...rest },
    ref,
  ) {
    const autoId = useId();
    const selectId = id ?? autoId;
    const hintId = hint || error ? `${selectId}-hint` : undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label ? (
          <label htmlFor={selectId} className="text-sm font-medium text-ink-700">
            {label}
          </label>
        ) : null}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={hintId}
            className={cn(
              fieldBaseClasses,
              fieldSizeClasses[size],
              "appearance-none pr-10",
              selectClassName,
            )}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 size-5 text-ink-400"
          />
        </div>

        {hint || error ? (
          <p
            id={hintId}
            className={cn("text-sm", error ? "text-danger" : "text-ink-500")}
          >
            {error ?? hint}
          </p>
        ) : null}
      </div>
    );
  },
);
