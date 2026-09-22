import Link from "next/link";
import { ArrowRight, MessageCircle, Search, SlidersHorizontal } from "lucide-react";
import { Section } from "@/components/layout/section";
import { howItWorks } from "@/data/site";
import { HomeSectionHeading } from "./home-section-heading";

const stepIcons = [Search, SlidersHorizontal, MessageCircle] as const;

export function HowItWorks() {
  return (
    <Section ariaLabelledby="how-it-works-title" className="home-section home-process-section">
      <HomeSectionHeading
        id="how-it-works-title"
        eyebrow="Jarayon"
        title={<>Qanday <span className="home-title-accent">ishlaydi?</span></>}
        description="Uchta aniq qadam: qidiring, taqqoslang va ustoz bilan bog‘laning."
        action={
          <Link href="/courses" className="home-outline-link">
            Boshlash <ArrowRight aria-hidden="true" />
          </Link>
        }
      />

      <ol className="home-process-grid">
        {howItWorks.steps.map((step, index) => {
          const Icon = stepIcons[index] ?? Search;
          return (
            <li key={step.id} className="home-process-card">
              <div className="home-process-top">
                <span className="home-process-number">{step.number}</span>
                <span className="home-process-icon" aria-hidden="true"><Icon /></span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              {index < howItWorks.steps.length - 1 ? <span className="home-process-line" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
