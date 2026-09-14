import type { Metadata } from "next";
import { requireRolePage } from "@/server/auth/guards";
import { listConversations } from "@/server/messaging-service";
import { ConversationList } from "@/components/messaging/conversation-list";

export const metadata: Metadata = { title: "Xabarlar" };

/* -------------------------------------------------------------------------- */
/* /teacher/dashboard/messages — the teacher's private conversations (Phase 16).*/
/*                                                                              */
/* Same service as the student list: the participant predicate is the           */
/* authorization, and it matches the teacher only on threads whose COURSE this  */
/* account owns. A teacher can never enumerate another teacher's students.      */
/* -------------------------------------------------------------------------- */

export default async function TeacherMessagesPage() {
  const user = await requireRolePage("teacher", "/teacher/dashboard/messages");
  const conversations = await listConversations(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">Xabarlar</h1>
        <p className="max-w-prose text-base text-ink-500">
          Suhbat faqat kursingizga qabul qilingan o‘quvchilar bilan ochiladi.
          Telefon raqamlar ko‘rsatilmaydi va boshqa kurslarning suhbatlari bu
          yerda ko‘rinmaydi.
        </p>
      </header>

      <ConversationList summaries={conversations} role="teacher" />
    </div>
  );
}
