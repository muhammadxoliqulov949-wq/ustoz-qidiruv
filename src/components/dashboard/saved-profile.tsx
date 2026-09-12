import { Badge } from "@/components/ui";
import {
  languageLabel,
  onboardingCategories,
  onboardingCityLabel,
} from "@/lib/onboarding";
import type { StudentProfileRow } from "@/server/db/schema";

/* -------------------------------------------------------------------------- */
/* SavedProfile — what the DATABASE holds for the signed-in student, rendered   */
/* on the server. Shown next to the Phase 6 draft editor so the two sources are */
/* visibly distinct: this block is the persisted profile, the editor below is   */
/* an unsaved local form. The phone number is stored on the user row and        */
/* intentionally not rendered anywhere public.                                  */
/* -------------------------------------------------------------------------- */

const FORMAT_LABEL: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  both: "Ikkalasi ham",
};

export function SavedProfile({ profile }: { profile: StudentProfileRow | null }) {
  const rows: { label: string; value: string | null }[] = profile
    ? [
        { label: "Ism", value: profile.name.trim() === "" ? null : profile.name },
        { label: "Shahar", value: profile.city ? onboardingCityLabel(profile.city) : null },
        {
          label: "Format",
          value: profile.preferredFormat ? FORMAT_LABEL[profile.preferredFormat] ?? null : null,
        },
        {
          label: "Tillar",
          value:
            profile.languages.length === 0
              ? null
              : profile.languages.map((tag) => languageLabel(tag)).join(", "),
        },
        {
          label: "Yo‘nalishlar",
          value:
            profile.interests.length === 0
              ? null
              : profile.interests
                  .map((slug) => onboardingCategories.find((c) => c.slug === slug)?.name ?? slug)
                  .join(", "),
        },
      ]
    : [];

  return (
    <section
      aria-labelledby="saved-profile"
      className="rounded-xl border border-line bg-surface p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="saved-profile" className="text-xl font-semibold text-ink-900">
          Saqlangan profil
        </h2>
        <Badge variant="accent">Hisobingizda</Badge>
      </div>
      {profile === null || rows.every((row) => row.value === null) ? (
        <p className="mt-2 text-base text-ink-500">
          Profil ma’lumotlari hali saqlanmagan. Quyidagi shaklni to‘ldirib
          saqlasangiz, ular hisobingizga yoziladi.
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2">
          {rows
            .filter((row) => row.value !== null)
            .map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2"
              >
                <dt className="shrink-0 text-ink-500">{row.label}</dt>
                <dd className="text-end font-medium text-ink-900">{row.value}</dd>
              </div>
            ))}
        </dl>
      )}
    </section>
  );
}
