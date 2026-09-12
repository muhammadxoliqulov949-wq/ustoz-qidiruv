import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "./db/client";

/* -------------------------------------------------------------------------- */
/* Notification service — Phase 13. In-app only.                               */
/*                                                                              */
/* PRIVACY IS STRUCTURAL: every function here takes the recipient id from the   */
/* CALLER, which got it from the session, and puts it in the WHERE clause. No   */
/* function accepts a "list notifications for user X" parameter that a client   */
/* could influence, and the mark-as-read mutations match on                     */
/* (id AND user_id), so another user's notification id simply updates zero      */
/* rows rather than relying on a check somebody could forget.                   */
/*                                                                              */
/* There is no email, SMS or push transport. Nothing here implies delivery      */
/* outside the app.                                                             */
/* -------------------------------------------------------------------------- */

export interface NotificationView {
  id: string;
  type: (typeof schema.notificationType.enumValues)[number];
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: Date;
}

/** This user's notifications, newest first. */
export async function listNotifications(
  userId: string,
  options: { limit?: number } = {},
): Promise<NotificationView[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.notifications.id,
      type: schema.notifications.type,
      title: schema.notifications.title,
      body: schema.notifications.body,
      href: schema.notifications.href,
      readAt: schema.notifications.readAt,
      createdAt: schema.notifications.createdAt,
    })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(options.limit ?? 50);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.readAt !== null,
    createdAt: row.createdAt,
  }));
}

/** Unread count for this user — backs the navigation badge. */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ total: count(schema.notifications.id) })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return Number(rows[0]?.total ?? 0);
}

/**
 * Mark one notification read. Idempotent: re-marking an already-read row is a
 * no-op success, and an id belonging to somebody else matches nothing.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<{ ok: boolean }> {
  const db = getDb();
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, userId),
        // Preserve the original read time when it is already read.
        isNull(schema.notifications.readAt),
      ),
    );
  return { ok: true };
}

/** Mark every unread notification for this user read. Idempotent. */
export async function markAllNotificationsRead(userId: string): Promise<{ ok: boolean }> {
  const db = getDb();
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return { ok: true };
}
