import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* AuthFrame — centered column shared by /login, /register, /onboarding.        */
/* Kept inside the site chrome (global header/footer untouched): auth pages     */
/* are just calm, narrow pages — no separate app shell in this phase.           */
/* The prototype notice is rendered on every auth screen so no state in this    */
/* flow can ever read as a live account (Phase 6 honesty rule).                */
/* -------------------------------------------------------------------------- */

export function PrototypeNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 backdrop-blur-sm",
        "text-sm text-ink-500",
        className,
      )}
    >
      <FlaskConical
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-ink-400"
      />
      <span>
        <span className="font-medium text-ink-700">Xavfsizlik.</span>{" "}
        Parolingiz serverda argon2id bilan xeshlanadi va hech qachon ochiq
        saqlanmaydi. Sessiya faqat HttpOnly cookie’da bo‘ladi — brauzer
        xotirasida token saqlanmaydi. SMS tasdiqlash hali yo‘q.
      </span>
    </p>
  );
}

export interface AuthPageProps {
  title: string;
  intro?: string;
  children: ReactNode;
  /** Narrow (forms) by default; the wizard uses the wide frame. */
  width?: "narrow" | "medium" | "wide";
}

export function AuthPage({ title, intro, children, width = "narrow" }: AuthPageProps) {
  return (
    <div className="depth-canvas min-h-[calc(100dvh-var(--height-header)-8rem)] site-container py-10 sm:py-14 lg:py-20">
      <div
        className={cn(
          "depth-featured mx-auto flex w-full flex-col gap-6 rounded-3xl p-6 sm:p-8 border border-white/10",
          width === "narrow"
            ? "max-w-[26rem]"
            : width === "medium"
              ? "max-w-[34rem]"
              : "max-w-[46rem]",
        )}
      >
        <header className="flex flex-col gap-2.5">
          <h1 className="text-[1.7rem] font-bold tracking-[-0.025em] text-ink-900 sm:text-[2rem] leading-[1.05]">
            {title}
          </h1>
          {intro ? (
            <p className="text-base text-ink-500">{intro}</p>
          ) : null}
        </header>
        <PrototypeNotice />
        {children}
      </div>
    </div>
  );
}
