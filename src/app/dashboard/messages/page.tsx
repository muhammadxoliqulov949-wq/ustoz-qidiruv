import type { Metadata } from "next";
import { requireRolePage } from "@/server/auth/guards";
import { listConversations } from "@/server/messaging-service";
import { ConversationList } from "@/components/messaging/conversation-list";

export const metadata: Metadata = { title: "Xabarlar" };

/* -------------------------------------------------------------------------- */
/* /dashboard/messages — the student's private conversations (Phase 16).        */
/*                                                                              */
/* Server component. `listConversations` filters by the SESSION user inside SQL */
/* (the student is derived from the enrollment, never from a parameter), so the */
/* page has nothing to filter and nothing to leak.                              */
/* -------------------------------------------------------------------------- */

export default async function StudentMessagesPage() {
  const user = await requireRolePage("student", "/dashboard/messages");
  const conversations = await listConversations(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">Xabarlar</h1>
        <p className="max-w-prose text-base text-ink-500">
          Har bir suhbat bitta qabul qilingan yozilish so‘roviga tegishli. Suhbat
          ustoz bilan hisobingiz o‘rtasida — boshqa hech kim uni ko‘ra olmaydi.
        </p>
      </header>

      <ConversationList summaries={conversations} role="student" />
    </div>
  );
}
