"use client";

import Link from "next/link";
import { AuthNotice } from "@/components/auth/auth-notice";
import { EmptyState } from "./empty-state";
import { RequestCard } from "./request-card";
import { useStudentState } from "./use-student-state";
import type { DashCatalog } from "@/lib/dashboard";

/* -------------------------------------------------------------------------- */
/* Requests panel — the Phase 7 enrollment draft, read-only, as a dashboard      */
/* record. The Phase 7 store holds exactly ONE draft (one course at a time), so  */
/* this list has zero or one entry; the copy says so instead of implying a       */
/* request history that the prototype cannot keep.                               */
/* -------------------------------------------------------------------------- */

export function RequestsPanel({ catalog }: { catalog: DashCatalog }) {
  const { ready, requests } = useStudentState(catalog);

  if (!ready) {
    return (
      <section aria-labelledby="requests-heading">
        <h2 id="requests-heading" className="text-xl font-semibold text-ink-900">
          Yozilish so‘rovlari
        </h2>
        <p className="mt-2 text-base text-ink-500" role="status">
          Brauzer holati o‘qilmoqda…
        </p>
      </section>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState title="Yozilish so‘rovi yo‘q" as="h2">
        Siz hali birorta kursga yozilish jarayonini boshlamagansiz. Kursni
        tanlab, guruh va jadval bilan so‘rov tayyorlashingiz mumkin — u shu
        yerda ko‘rinadi.
        <p className="mt-3">
          <Link
            href="/courses"
            className="font-medium text-accent-700 underline underline-offset-2"
          >
            Kurslarni ko‘rish
          </Link>
        </p>
      </EmptyState>
    );
  }

  return (
    <section aria-labelledby="requests-heading" className="flex flex-col gap-4">
      <h2 id="requests-heading" className="sr-only">
        Yozilish so‘rovlari
      </h2>
      <AuthNotice title="So‘rovlar hali serverga yuborilmaydi">
        Yozilish infratuzilmasi ulanmagan. Quyidagi yozuv faqat shu
        brauzeringizda saqlangan qoralama: ustoz uni ko‘rmaydi, joy band
        qilinmaydi va to‘lov amalga oshmaydi. Bir vaqtda bitta kurs uchun
        qoralama saqlanadi.
      </AuthNotice>
      {requests.map((request) => (
        <RequestCard key={request.courseSlug} request={request} />
      ))}
    </section>
  );
}
