import type { ReactNode } from "react";
import { CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* AuthNotice — the honest status panel for every state that the frontend        */
/* cannot actually complete: auth not connected, password recovery deferred,     */
/* "nothing was saved" onboarding completion. Variant neutral = info,          */
/* warning = attention. Never a fake success toast.                            */
/* -------------------------------------------------------------------------- */

export interface AuthNoticeProps {
  variant?: "info" | "warning";
  title: string;
  children: ReactNode;
  className?: string;
  /** Renders role="status" so dynamic swaps are announced politely. */
  live?: boolean;
}

export function AuthNotice({
  variant = "info",
  title,
  children,
  className,
  live = false,
}: AuthNoticeProps) {
  const Icon = variant === "warning" ? CircleAlert : Info;
  return (
    <div
      {...(live ? { role: "status" } : {})}
      className={cn(
        "rounded-xl border p-4",
        variant === "warning"
          ? "border-warning/30 bg-[#fdf3e3]"
          : "border-line bg-surface-muted",
        className,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          variant === "warning" ? "text-[#9a6207]" : "text-ink-900",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0",
            variant === "warning" ? "text-warning" : "text-ink-400",
          )}
        />
        {title}
      </p>
      <div className="mt-1.5 text-sm leading-relaxed text-ink-700">{children}</div>
    </div>
  );
}
