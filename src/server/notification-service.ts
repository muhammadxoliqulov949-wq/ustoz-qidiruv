import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { newId } from "./auth/ids";

/* -------------------------------------------------------------------------- */
/* Notification service — in-app only.                                         */
/*                                                                              */
/* Every reader is recipient-scoped. The write helpers are intended for domain  */
/* transactions, so a notification cannot claim that an event happened when    */
/* the event rolled back. There is no email, SMS or push provider in Phase 23.  */
/* -------------------------------------------------------------------------- */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
export type NotificationType = (typeof schema.notificationType.enumValues)[number];

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: Date;
}

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string | null;
}

/** Insert one notification inside an existing domain transaction. */
export async function insertNotification(tx: Tx, input: NotificationInput): Promise<void> {
  await tx.insert(schema.notifications).values({
    id: newId("ntf"),
    userId: input.userId,
    type: input.type,
    title: input.title.slice(0, 160),
    body: (input.body ?? "").slice(0, 500),
    href: input.href ?? null,
  });
}

/**
 * Notify active operators without exposing their credentials or accepting a
 * recipient id from a client. This is used for work that needs a human: support
 * reports, verification submissions and moderation submissions.
 */
export async function notifyActiveAdmins(
  tx: Tx,
  input: Omit<NotificationInput, "userId">,
): Promise<number> {
  const admins = await tx
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.role, "admin"), eq(schema.users.accountStatus, "active")));
  for (const admin of admins) {
    await insertNotification(tx, { ...input, userId: admin.id });
  }
  return admins.length;
}

/** This user's notifications, newest first. */
export async function listNotifications(
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<NotificationView[]> {
  const db = getDb();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
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
    .orderBy(desc(schema.notifications.createdAt), desc(schema.notifications.id))
    .limit(limit)
    .offset(offset);

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

export async function countNotifications(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ total: count(schema.notifications.id) })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId));
  return Number(rows[0]?.total ?? 0);
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

/** Mark one notification read. Idempotent and recipient-scoped. */
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
