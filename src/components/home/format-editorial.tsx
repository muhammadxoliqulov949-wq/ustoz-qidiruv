import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, MapPin, Monitor } from "lucide-react";
import { Section } from "@/components/layout/section";
import { formatEditorial } from "@/data/site";
import type { Course } from "@/data/models";
import { HomeSectionHeading } from "./home-section-heading";

const formatIcons = { online: Monitor, offline: MapPin } as const;

export function FormatEditorial({ courses }: { courses: Course[] }) {
  const examples = {
    online: courses.find((course) => course.format === "online") ?? null,
    offline: courses.find((course) => course.format !== "online") ?? null,
  };

  return (
    <Section ariaLabelledby="format-editorial-title" className="home-section">
      <HomeSectionHeading
        id="format-editorial-title"
        eyebrow="Formatlar"
        title={<>Sizga mos formatda <span className="home-title-accent">o‘rganing</span></>}
        description="Uyda, ish oralig‘ida yoki ustoz bilan yuzma-yuz — o‘zingizga qulay usulni tanlang."
      />

      <div className="home-format-grid">
        {formatEditorial.items.map((item) => {
          const id = item.id as "online" | "offline";
          const Icon = formatIcons[id];
          const example = examples[id];
          const benefits = id === "online"
            ? ["Joydan mustaqil", "Moslashuvchan vaqt", "Raqamli dars muhiti"]
            : ["Yuzma-yuz muloqot", "Mahalliy ustozlar", "Amaliy mashg‘ulot"];

          return (
            <article key={item.id} className={`home-format-panel home-format-${id}`}>
              {example?.image ? (
                <Image
                  src={example.image}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="home-format-image object-cover"
                />
              ) : null}
              <div className="home-format-overlay" aria-hidden="true" />
              <div className="home-format-content">
                <span className="home-format-label"><Icon aria-hidden="true" /> {item.title}</span>
                <h3>{item.title} darslar</h3>
                <p>{item.text}</p>
                <ul>
                  {benefits.map((benefit) => (
                    <li key={benefit}><Check aria-hidden="true" /> {benefit}</li>
                  ))}
                </ul>
                {example ? (
                  <p className="home-format-example">
                    Hozirgi tanlov: <Link href={`/courses/${example.slug}`}>{example.title}</Link>
                  </p>
                ) : null}
                <Link href={item.action.href} className="home-panel-link">
                  {item.action.label} <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
