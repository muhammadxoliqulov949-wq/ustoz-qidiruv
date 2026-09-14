import type { ReactNode } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { AdminSidebarNav, AdminTabNav } from "@/components/admin/admin-nav";
import {
  ADMIN_ACCESS_DENIED_BODY,
  ADMIN_ACCESS_DENIED_TITLE,
  ADMIN_AREA_DESCRIPTION,
  ADMIN_AREA_TITLE,
} from "@/lib/admin-workspace";
import { requireAdminPage } from "@/server/auth/guards";
import { getVerificationQueueCounts } from "@/server/verification-service";
import { getModerationCounts } from "@/server/moderation-service";
import { getRefundQueueCounts } from "@/server/refund-service";

/* -------------------------------------------------------------------------- */
/* /admin — the ADMIN control-plane shell (Phase 15).                          */
/*                                                                              */
/* AUTHORIZATION HAPPENS HERE, ONCE, ON THE SERVER, BEFORE ANY CHILD RENDERS.    */
/*                                                                              */
/*   anonymous visitor → redirected to /login?next=/admin (auth gate)            */
/*   student / teacher → an explicit, in-shell "this area is not yours" screen   */
/*                        with a route to THEIR OWN dashboard. Never a silent    */
/*                        cross-dashboard redirect: a teacher who opens /admin   */
/*                        is told they are not an admin, rather than being       */
/*                        bounced somewhere that makes the attempt invisible.    */
/*   admin             → the shell, with factual counts                          */
/*                                                                              */
/* The denial screen is rendered instead of using Next's `forbidden()` because   */
/* that helper is gated behind `experimental.authInterrupts` and we do not turn  */
/* on experimental flags for a production feature.                               */
/*                                                                              */
/* The counts in the rail come from the two queue services, so the badge in the  */
/* navigation and the number on the overview page are the same query result.     */
/* -------------------------------------------------------------------------- */

/*
 * EXPLICITLY DYNAMIC — and this is a BUILD-SAFETY requirement, not a
 * performance preference.
 *
 * Every admin screen reads the database. Without this declaration Next would
 * try to prerender the segment at build time; because the pages do not read
 * cookies themselves, it would actually EXECUTE their queries, which is exactly
 * the failure the marketplace hit on Vercel (see README → "Building with no
 * database"). `force-dynamic` in the layout covers every nested admin route, so
 * no future admin page can reintroduce a build-time database read by forgetting
 * a per-page declaration.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  /*
   * A layout cannot read the current URL, so the post-login return path is the
   * admin root. That is deliberate: a deep admin link is followed after login
   * would be nice, but guessing a path here would be worse than landing on the
   * overview, which links to everything.
   */
  const admin = await requireAdminPage("/admin");

  if (!admin) {
    /*
     * The signed-in-but-not-admin case. (The anonymous case never reaches this
     * layout: `requireAdminPage` redirects to the login gate first.)
     */
    return (
      <div className="site-container py-14 lg:py-20">
        <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-xs md:p-8">
          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink-900 md:text-3xl">
            {ADMIN_ACCESS_DENIED_TITLE}
          </h1>
          <p className="text-base leading-relaxed text-ink-700">{ADMIN_ACCESS_DENIED_BODY}</p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/teacher/dashboard" variant="outline">
              Ustoz paneli
            </ButtonLink>
            <ButtonLink href="/dashboard" variant="outline">
              O‘quvchi paneli
            </ButtonLink>
          </div>
          <p className="text-sm text-ink-500">
            Administrator huquqi faqat serverdagi buyruq orqali beriladi
            (<code className="rounded bg-ink-900/[0.05] px-1.5 py-0.5">npm run admin:create</code>).
            Sayt ichida uni olish yo‘li yo‘q.
          </p>
        </div>
      </div>
    );
  }

  const [verification, moderation, refundQueue] = await Promise.all([
    getVerificationQueueCounts(),
    getModerationCounts(),
    getRefundQueueCounts(),
  ]);
  const counts = {
    teachers: verification.pending,
    courses: moderation.pendingReviews,
    // Live refund work: a request nobody has decided yet, or an approved refund
    // the provider still has to return.
    refunds: refundQueue.live,
  };

  return (
    <div className="site-container py-8 lg:py-12">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        {/* ------------------------------- sidebar ------------------------------- */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-28">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
            <p className="text-sm font-semibold tracking-[0.02em] text-accent-700 uppercase">
              {ADMIN_AREA_TITLE}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">
              {ADMIN_AREA_DESCRIPTION}
            </p>
          </div>
          <AdminSidebarNav counts={counts} />
          <p className="text-sm leading-relaxed text-ink-500 max-lg:hidden">
            Har bir qaror jurnalga yoziladi va ustozga bildirishnoma yuboriladi.
            Pulni qaytarish so‘rovlari shu panelda ko‘rib chiqiladi, lekin pulni
            Payme’ning merchant kabinetida qaytarishni operator bajaradi — bu
            ilova tashqariga qaytarish chaqiruvini yubormaydi.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-accent-700 underline underline-offset-2 max-lg:hidden"
          >
            Ommaviy saytga qaytish
          </Link>
        </div>

        {/* ------------------------------- content ------------------------------- */}
        <div className="flex min-w-0 flex-col gap-6">
          <AdminTabNav counts={counts} />
          {children}
        </div>
      </div>
    </div>
  );
}
