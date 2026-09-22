import { CheckCircle2 } from "lucide-react";
import { Section } from "@/components/layout/section";
import { trustIcons, type TrustIconKey } from "@/components/icons";
import { trustPromises } from "@/data/site";
import { HomeSectionHeading } from "./home-section-heading";

export function TrustPromises() {
  return (
    <Section ariaLabelledby="trust-title" className="home-section home-trust-section">
      <HomeSectionHeading
        id="trust-title"
        eyebrow="Ishonch"
        title={<>Nega aynan <span className="home-title-accent">USTOZ?</span></>}
        description="Tanlov qilishdan oldin kerakli ma’lumotni ko‘ring — profil, format, narx va o‘quvchi fikrlari yashirilmaydi."
      />

      <ul className="home-trust-grid">
        {trustPromises.items.map((item, index) => {
          const Icon = trustIcons[item.icon as TrustIconKey];
          return (
            <li key={item.id} className={`home-trust-card home-trust-card-${index + 1}`}>
              <span className="home-trust-icon" aria-hidden="true"><Icon /></span>
              <span className="home-trust-check" aria-hidden="true"><CheckCircle2 /></span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
