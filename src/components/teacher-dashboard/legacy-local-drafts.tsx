"use client";

import { useSyncExternalStore } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import { COURSE_DRAFTS_STORAGE_KEY } from "./course-draft-store";

/* -------------------------------------------------------------------------- */
/* Legacy Phase 10 local drafts — Phase 12 transition surface.                  */
/*                                                                              */
/* POLICY (requirement 10): `ustoz.course.drafts.v1` is NEVER silently          */
/* uploaded, deleted or overwritten. This component only READS the key and      */
/* reports what is there, clearly labelled as browser-only data that is not on  */
/* the server and not in the catalogue.                                         */
/*                                                                              */
/* We deliberately ship the "leave intact and label" option rather than a       */
/* one-click import: the Phase 10 draft shape is a prototype record with no     */
/* owner identity, so importing it would mean guessing which account it belongs */
/* to. The drafts stay exactly where the teacher left them and the copy tells   */
/* them to re-enter the course as a server draft. Nothing is destroyed.         */
/*                                                                              */
/* Rendered only when such drafts actually exist, so accounts that never used   */
/* the prototype see no confusing legacy section.                               */
/* -------------------------------------------------------------------------- */

interface LegacyDraft {
  id: string;
  title: string;
  updatedAt: string | null;
}

function readLegacyDrafts(): LegacyDraft[] {
  try {
    const raw = window.localStorage.getItem(COURSE_DRAFTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return [];
    const drafts = (parsed as { drafts?: unknown }).drafts;
    if (!Array.isArray(drafts)) return [];
    return drafts.flatMap((entry): LegacyDraft[] => {
      if (typeof entry !== "object" || entry === null) return [];
      const record = entry as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : null;
      if (!id) return [];
      const value = record.value as Record<string, unknown> | undefined;
      const title =
        typeof value?.title === "string" && value.title.trim() !== ""
          ? value.title
          : "Nomsiz qoralama";
      return [
        {
          id,
          title,
          updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
        },
      ];
    });
  } catch {
    // A corrupt or unreadable key is not an error worth surfacing — and it is
    // certainly not a reason to clear the user's data.
    return [];
  }
}

/* The snapshot is cached so useSyncExternalStore sees a stable reference; the
 * key is read once per mount and never written back. */
let cached: LegacyDraft[] | null = null;

function subscribe(): () => void {
  // Read-only view of a key this app no longer writes — nothing to subscribe to.
  return () => {};
}

function getSnapshot(): LegacyDraft[] {
  cached ??= readLegacyDrafts();
  return cached;
}

const EMPTY: LegacyDraft[] = [];

/** Server render shows nothing: localStorage does not exist there. */
function getServerSnapshot(): LegacyDraft[] {
  return EMPTY;
}

export function LegacyLocalDrafts() {
  const drafts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (drafts.length === 0) return null;

  return (
    <section aria-labelledby="legacy-drafts" className="flex flex-col gap-4">
      <h2 id="legacy-drafts" className="text-xl font-semibold text-ink-900">
        Eski brauzer qoralamalari{" "}
        <span className="text-base font-normal text-ink-500">({drafts.length})</span>
      </h2>

      <AuthNotice title="Bu yozuvlar faqat shu brauzerda">
        Quyidagilar oldingi prototip bosqichida faqat shu brauzer xotirasiga
        saqlangan qoralamalar. Ular serverda emas, hisobingizga bog‘lanmagan va
        katalogda ko‘rinmaydi. Biz ularni avtomatik yuklamaymiz va o‘chirmaymiz —
        matnlaringiz joyida turadi. Kursni davom ettirish uchun uni yuqoridagi
        “Yangi kurs qoralamasi” orqali server qoralamasi sifatida kiriting.
      </AuthNotice>

      <ul className="flex flex-col gap-3">
        {drafts.map((draft) => (
          <li key={draft.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-ink-900">{draft.title}</p>
                {draft.updatedAt ? (
                  <p className="text-sm text-ink-500">
                    Oxirgi o‘zgarish: {draft.updatedAt.slice(0, 10)}
                  </p>
                ) : null}
              </div>
              <Badge variant="neutral">
                <AlertTriangle aria-hidden="true" className="me-1 size-3.5" />
                Faqat brauzerda
              </Badge>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
