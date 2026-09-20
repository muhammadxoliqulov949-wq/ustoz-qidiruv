import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  MarkAllReadButton,
  MarkOneReadButton,
} from "@/components/notifications/mark-read-buttons";
import { requireUserPage } from "@/server/auth/guards";
import { countNotifications, countUnreadNotifications, listNotifications } from "@/server/notification-service";
import { cn, focusRing } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Bildirishnomalar",
  robots: { index: false, follow: false },
};

/* -------------------------------------------------------------------------- */
/* /notifications — Phase 13, in-app notifications for BOTH roles.             */
/*                                                                              */
/* A quiet, server-rendered page rather than a header dropdown or a social      */
/* feed: notifications here exist to tell you that a real enrollment decision   */
/* happened, and each one links straight to the thing it is about.              */
/*                                                                              */
/* NO POLLING, no websockets, no realtime layer. The list is fetched once per   */
/* navigation, which matches how often these events actually occur.             */
/*                                                                              */
/* AUTHORIZATION: the list is read with the session user's id in the WHERE      */
/* clause. There is no route parameter and no query string that could point at  */
/* another user's notifications.                                                */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUserPage("/notifications");
  const params = await searchParams;
  const rawPage = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const requestedPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = 50;
  const [total, unread] = await Promise.all([
    countNotifications(user.id),
    countUnreadNotifications(user.id),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, pageCount);
  const notifications = await listNotifications(user.id, {
    limit,
    offset: (page - 1) * limit,
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Bildirishnomalar
        </h1>
        <p className="text-base text-ink-500">
          {unread > 0
            ? `${unread} ta o‘qilmagan bildirishnoma.`
            : "O‘qilmagan bildirishnoma yo‘q."}
        </p>
      </header>

      {notifications.length === 0 ? (
        <EmptyState title="Hozircha bildirishnoma yo‘q" as="h2">
          Yozilish so‘rovingiz bo‘yicha qaror qabul qilinganda yoki kursingizga
          yangi so‘rov kelganda, shu yerda xabar ko‘rinadi. Bildirishnomalar
          faqat shu ilova ichida — SMS yoki e-pochta yuborilmaydi.
        </EmptyState>
      ) : (
        <>
          <MarkAllReadButton disabled={unread === 0} />
          <ul className="flex flex-col gap-2.5">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-4 shadow-xs",
                  notification.read
                    ? "border-line bg-surface"
                    : "border-accent-100 bg-accent-50",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-ink-900">
                    {notification.title}
                  </h2>
                  {/* Unread state is a text badge, not just a colour. */}
                  {notification.read ? null : <Badge variant="accent">Yangi</Badge>}
                </div>

                <p className="text-sm text-ink-700">{notification.body}</p>
                <p className="text-sm text-ink-500">{formatDate(notification.createdAt)}</p>

                <div className="flex flex-wrap items-center gap-3">
                  {notification.href ? (
                    <Link
                      href={notification.href}
                      className={cn(
                        "text-sm font-medium text-accent-700 underline underline-offset-2",
                        focusRing,
                      )}
                    >
                      Ko‘rish
                    </Link>
                  ) : null}
                  {notification.read ? null : (
                    <MarkOneReadButton notificationId={notification.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
          {total > limit ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-sm text-ink-500">{(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}</span>
              <div className="flex gap-2">
                {page > 1 ? <ButtonLink href={`/notifications?page=${page - 1}`} variant="outline" size="sm">Oldingi</ButtonLink> : null}
                {page < pageCount ? <ButtonLink href={`/notifications?page=${page + 1}`} variant="outline" size="sm">Keyingi</ButtonLink> : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
