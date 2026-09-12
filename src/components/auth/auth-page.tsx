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
        "flex items-start gap-2 rounded-lg border border-line bg-surface-muted px-3.5 py-2.5",
        "text-sm text-ink-500",
        className,
      )}
    >
      <FlaskConical
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-ink-400"
      />
      <span>
        <span className="font-medium text-ink-700">Prototip interfeys.</span>{" "}
        Autentifikatsiya va saqlash backendi hali ulangagan — bu sahifadagi
        amallar brauzeringizdagi vaqtinchalik UI holatigina.
      </span>
    </p>
  );
}

export interface AuthPageProps {
  title: string;
  intro?: string;
  children: ReactNode;
  /** Narrow (forms) by default; the wizard uses the wide frame. */
  width?: "narrow" | "wide";
}

export function AuthPage({ title, intro, children, width = "narrow" }: AuthPageProps) {
  return (
    <div className="site-container py-14 sm:py-18 lg:py-24">
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-6",
          width === "narrow" ? "max-w-[26rem]" : "max-w-[46rem]",
        )}
      >
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
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
