import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HomeSectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("home-section-heading", className)}>
      <div>
        <p className="home-eyebrow">
          <span aria-hidden="true" />
          {eyebrow}
        </p>
        <h2 id={id}>{title}</h2>
        {description ? <p className="home-section-copy">{description}</p> : null}
      </div>
      {action ? <div className="home-section-action">{action}</div> : null}
    </header>
  );
}
