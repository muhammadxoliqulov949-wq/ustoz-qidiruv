import Link from "next/link";
import { Badge } from "@/components/ui";
import {
  languageLabel,
  onboardingCategories,
  onboardingCityLabel,
} from "@/lib/onboarding";
import { courseLevelLabels } from "@/data/courses";
import type { TeacherProfileRow } from "@/server/db/schema";

/* -------------------------------------------------------------------------- */
/* TeacherSavedProfile — the teacher's PERSISTED profile row, rendered on the  */
/* server from the session. Verification is read-only HERE: the application is */
/* submitted from the “Profil tasdig‘i” section and decided by an admin —      */
/* saving the profile never verifies it.                                       */
/* The phone number is never rendered here.                                    */
/* -------------------------------------------------------------------------- */

export function TeacherSavedProfile({ profile }: { profile: TeacherProfileRow | null }) {
  const rows: { label: string; value: string | null }[] = profile
    ? [
        { label: "Ism", value: profile.name.trim() === "" ? null : profile.name },
        {
          /* The public “Yo‘nalish” label — a verification requirement, so it is
           * echoed here exactly as the reviewer will see it. */
          label: "Yo‘nalish (mutaxassislik)",
          value:
            profile.specialization === null || profile.specialization.trim() === ""
              ? null
              : profile.specialization,
        },
        {
          label: "Yo‘nalishlar (fanlar)",
          value:
            profile.categories.length === 0
              ? null
              : profile.categories
                  .map((slug) => onboardingCategories.find((c) => c.slug === slug)?.name ?? slug)
                  .join(", "),
        },
        {
          label: "Joylashuv",
          value: profile.city
            ? [onboardingCityLabel(profile.city), (profile.district ?? "").trim()]
                .filter((part) => part !== "")
                .join(" · ")
            : null,
        },
        {
          label: "Darajalar",
          value:
            profile.levels.length === 0
              ? null
              : profile.levels
                  .map((level) => courseLevelLabels[level as keyof typeof courseLevelLabels] ?? level)
                  .join(", "),
        },
        {
          label: "Tillar",
          value:
            profile.languages.length === 0
              ? null
              : profile.languages.map((tag) => languageLabel(tag)).join(", "),
        },
        {
          label: "Tajriba",
          value: profile.experienceYears === null ? null : `${profile.experienceYears} yil`,
        },
      ]
    : [];

  const filled = rows.filter((row) => row.value !== null);

  return (
    <section
      aria-labelledby="teacher-saved-profile"
      className="rounded-xl border border-line bg-surface p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="teacher-saved-profile" className="text-xl font-semibold text-ink-900">
          Saqlangan profil
        </h2>
        <Badge variant="neutral">
          {profile?.verification === "verified"
            ? "Tasdiqlangan"
            : profile?.verification === "pending"
              ? "Tekshiruv kutilmoqda"
              : "Tasdiqlanmagan"}
        </Badge>
      </div>
      {filled.length === 0 ? (
        <p className="mt-2 text-base text-ink-500">
          Profil ma’lumotlari hali saqlanmagan.{" "}
          <Link href="/onboarding" className="font-medium text-accent-700 underline underline-offset-2">
            Onboarding orqali to‘ldiring
          </Link>
          .
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2">
            {filled.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2"
              >
                <dt className="shrink-0 text-ink-500">{row.label}</dt>
                <dd className="text-end font-medium text-ink-900">{row.value}</dd>
              </div>
            ))}
          </dl>
          {profile?.bio ? (
            <p className="mt-3 text-sm leading-relaxed text-ink-700">{profile.bio}</p>
          ) : null}
          {profile?.approach ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-700">
              <span className="font-semibold text-ink-900">O‘qitish uslubi: </span>
              {profile.approach}
            </p>
          ) : null}
        </>
      )}
      <p className="mt-3 text-xs text-ink-500">
        {profile?.verification === "verified" ? (
          "Profilingiz tasdiqlangan. Ommaviy katalogda chiqish uchun kamida bitta kursingiz e’lon qilingan bo‘lishi kerak."
        ) : (
          <>
            Tasdiqlash arizasi —{" "}
            <Link
              href="/teacher/dashboard/verification"
              className="font-medium text-accent-700 underline underline-offset-2"
            >
              “Profil tasdig‘i” bo‘limida
            </Link>
            {profile?.verification === "pending"
              ? "; arizangiz hozir ko‘rib chiqilmoqda."
              : "; uni administrator ko‘rib chiqadi."}
          </>
        )}
      </p>
    </section>
  );
}
