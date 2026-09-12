"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import {
  addCourseGroupAction,
  addSyllabusModuleAction,
  deleteCourseGroupAction,
  deleteSyllabusModuleAction,
  moveSyllabusModuleAction,
  setCourseReadyAction,
  updateCourseDraftAction,
} from "@/server/actions/course-manage";

/* -------------------------------------------------------------------------- */
/* Server-backed course editor — Phase 12.                                     */
/*                                                                              */
/* Every mutation is a SERVER ACTION. The only identifiers this component sends */
/* are the course/group/module ids it was rendered with; the server re-checks   */
/* ownership against the session on every call, so nothing here is trusted.     */
/* No status control is offered beyond "ready for review" — publishing is not   */
/* a teacher-side action.                                                       */
/*                                                                              */
/* State lives on the server: after each action the router refreshes and the    */
/* page re-reads the database, so a reload (or a restart) shows the same data.  */
/* -------------------------------------------------------------------------- */

interface EditorGroup {
  id: string;
  title: string;
  days: string[];
  startTime: string;
  endTime: string | null;
  startDate: string;
  capacity: number;
}

interface EditorModule {
  id: string;
  position: number;
  title: string;
  description: string;
  lessons: number;
}

export interface DbCourseEditorProps {
  course: {
    id: string;
    slug: string;
    status: string;
    title: string;
    categoryId: string;
    level: string;
    format: string;
    city: string | null;
    location: string | null;
    priceUzs: number;
    summary: string;
    longDescription: string;
  };
  groups: EditorGroup[];
  modules: EditorModule[];
  categories: { id: string; name: string }[];
  cities: string[];
}

const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink-900 outline-none focus:border-accent-600";

export function DbCourseEditor({
  course,
  groups,
  modules,
  categories,
  cities,
}: DbCourseEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  /** Run a server action, surface its typed error, then re-read from the DB. */
  function run(action: (form: FormData) => Promise<{ ok: boolean; message?: string }>) {
    return (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const element = event.currentTarget;
      startTransition(async () => {
        const result = await action(form);
        if (result.ok) {
          setMessage({ tone: "ok", text: "Saqlandi." });
          element.reset();
          router.refresh();
        } else {
          setMessage({ tone: "error", text: result.message ?? "Amal bajarilmadi." });
        }
      });
    };
  }

  const isPublished = course.status === "published";

  return (
    <div className="flex flex-col gap-8">
      {message ? (
        <p
          role="status"
          className={
            message.tone === "ok"
              ? "text-base font-medium text-accent-700"
              : "text-base font-medium text-red-700"
          }
        >
          {message.text}
        </p>
      ) : null}

      {isPublished ? (
        <AuthNotice title="Bu kurs katalogda">
          O‘zgarishlar ommaviy sahifada darhol ko‘rinadi.
        </AuthNotice>
      ) : (
        <AuthNotice title="Bu kurs hali ommaviy emas">
          Qoralama serverda saqlanadi, lekin katalogda, qidiruvda va profilingizda
          ko‘rinmaydi. To‘liq to‘ldirilgani uni avtomatik e’lon qilmaydi.
        </AuthNotice>
      )}

      {/* ------------------------------- body -------------------------------- */}
      <Card>
        <form className="flex flex-col gap-4" onSubmit={run(updateCourseDraftAction)}>
          <input type="hidden" name="courseId" value={course.id} />
          <h2 className="text-xl font-semibold text-ink-900">Asosiy ma’lumotlar</h2>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Kurs nomi</span>
            <input name="title" defaultValue={course.title} className={field} required />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Yo‘nalish</span>
              <select name="categoryId" defaultValue={course.categoryId} className={field}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Daraja</span>
              <select name="level" defaultValue={course.level} className={field}>
                <option value="boshlangich">Boshlang‘ich</option>
                <option value="orta">O‘rta</option>
                <option value="yuqori">Yuqori</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Format</span>
              <select name="format" defaultValue={course.format} className={field}>
                <option value="online">Onlayn</option>
                <option value="offline">Oflayn</option>
                <option value="hybrid">Aralash</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Shahar</span>
              <select name="city" defaultValue={course.city ?? ""} className={field}>
                <option value="">— (onlayn)</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Manzil</span>
              <input name="location" defaultValue={course.location ?? ""} className={field} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Narx (so‘m / oyiga)</span>
              <input
                name="priceUzs"
                type="number"
                min={0}
                defaultValue={course.priceUzs}
                className={field}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Qisqa tavsif</span>
            <textarea name="summary" defaultValue={course.summary} rows={3} className={field} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">To‘liq tavsif</span>
            <textarea
              name="longDescription"
              defaultValue={course.longDescription}
              rows={6}
              className={field}
            />
          </label>

          <div>
            <Button type="submit" disabled={pending}>
              Saqlash
            </Button>
          </div>
        </form>
      </Card>

      {/* ------------------------------ groups ------------------------------- */}
      <Card>
        <h2 className="text-xl font-semibold text-ink-900">Guruhlar</h2>
        <p className="mt-1 text-sm text-ink-500">
          Faqat rejalashtirilgan jadval va sig‘im saqlanadi. Bo‘sh joylar soni
          haqiqiy so‘rovlardan hisoblanadi.
        </p>

        {groups.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {groups.map((group) => (
              <li
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">{group.title}</p>
                  <p className="text-sm text-ink-500">
                    {group.days.join(", ")} · {group.startTime}
                    {group.endTime ? `–${group.endTime}` : ""} · {group.startDate} ·{" "}
                    {group.capacity} o‘rin
                  </p>
                </div>
                <form onSubmit={run(deleteCourseGroupAction)}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <Button type="submit" variant="outline" size="sm" disabled={pending}>
                    <Trash2 aria-hidden="true" className="size-4" />
                    <span className="sr-only">Guruhni o‘chirish</span>
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-base text-ink-500">Guruh qo‘shilmagan.</p>
        )}

        <form className="mt-5 flex flex-col gap-4" onSubmit={run(addCourseGroupAction)}>
          <input type="hidden" name="courseId" value={course.id} />
          <h3 className="text-base font-semibold text-ink-900">Yangi guruh</h3>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Guruh nomi</span>
            <input name="title" className={field} required />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink-700">Dars kunlari</legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((day) => (
                <label key={day} className="inline-flex items-center gap-1.5 text-base">
                  <input type="checkbox" name="days" value={day} className="size-4" />
                  {day}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Boshlanish vaqti</span>
              <input name="startTime" type="time" className={field} required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Tugash vaqti</span>
              <input name="endTime" type="time" className={field} required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Boshlanish sanasi</span>
              <input name="startDate" type="date" className={field} required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-700">Sig‘im</span>
              <input name="capacity" type="number" min={1} defaultValue={12} className={field} />
            </label>
          </div>

          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              Guruh qo‘shish
            </Button>
          </div>
        </form>
      </Card>

      {/* ----------------------------- syllabus ------------------------------ */}
      <Card>
        <h2 className="text-xl font-semibold text-ink-900">Dastur modullari</h2>
        <p className="mt-1 text-sm text-ink-500">
          Tartib serverda saqlanadi; strelkalar ikki modul o‘rnini almashtiradi.
        </p>

        {modules.length > 0 ? (
          <ol className="mt-4 flex flex-col gap-3">
            {modules.map((item, index) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">
                    <Badge variant="neutral">{index + 1}</Badge> {item.title}
                  </p>
                  <p className="text-sm text-ink-500">
                    {item.lessons} ta dars
                    {item.description ? ` · ${item.description}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form onSubmit={run(moveSyllabusModuleAction)}>
                    <input type="hidden" name="moduleId" value={item.id} />
                    <input type="hidden" name="direction" value="up" />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={pending || index === 0}
                    >
                      <ArrowUp aria-hidden="true" className="size-4" />
                      <span className="sr-only">Yuqoriga</span>
                    </Button>
                  </form>
                  <form onSubmit={run(moveSyllabusModuleAction)}>
                    <input type="hidden" name="moduleId" value={item.id} />
                    <input type="hidden" name="direction" value="down" />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={pending || index === modules.length - 1}
                    >
                      <ArrowDown aria-hidden="true" className="size-4" />
                      <span className="sr-only">Pastga</span>
                    </Button>
                  </form>
                  <form onSubmit={run(deleteSyllabusModuleAction)}>
                    <input type="hidden" name="moduleId" value={item.id} />
                    <Button type="submit" variant="outline" size="sm" disabled={pending}>
                      <Trash2 aria-hidden="true" className="size-4" />
                      <span className="sr-only">Modulni o‘chirish</span>
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-base text-ink-500">Modul qo‘shilmagan.</p>
        )}

        <form className="mt-5 flex flex-col gap-4" onSubmit={run(addSyllabusModuleAction)}>
          <input type="hidden" name="courseId" value={course.id} />
          <h3 className="text-base font-semibold text-ink-900">Yangi modul</h3>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Modul nomi</span>
            <input name="title" className={field} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Tavsif</span>
            <textarea name="description" rows={2} className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Darslar soni</span>
            <input name="lessons" type="number" min={1} defaultValue={4} className={field} />
          </label>
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              Modul qo‘shish
            </Button>
          </div>
        </form>
      </Card>

      {/* ------------------------------ lifecycle ----------------------------- */}
      {!isPublished ? (
        <Card>
          <h2 className="text-xl font-semibold text-ink-900">Holat</h2>
          <p className="mt-1 text-sm text-ink-500">
            Hozirgi holat:{" "}
            <strong className="text-ink-900">
              {course.status === "ready" ? "Ko‘rib chiqishga tayyor" : "Qoralama"}
            </strong>
            . Bu belgi kursni ommaviy qilmaydi.
          </p>
          <form className="mt-4" onSubmit={run(setCourseReadyAction)}>
            <input type="hidden" name="courseId" value={course.id} />
            <input type="hidden" name="ready" value={course.status === "ready" ? "0" : "1"} />
            <Button type="submit" variant="outline" disabled={pending}>
              {course.status === "ready"
                ? "Qoralamaga qaytarish"
                : "Ko‘rib chiqishga tayyor deb belgilash"}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
