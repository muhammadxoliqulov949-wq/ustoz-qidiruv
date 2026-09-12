"use client";

import { Avatar, Badge, Button, SelectField } from "@/components/ui";
import { useTeacherWorkspace } from "./workspace-store";

/* -------------------------------------------------------------------------- */
/* Workspace identity + picker.                                                 */
/*                                                                              */
/* The honest replacement for an account header: there is NO signed-in teacher, */
/* so instead of silently pretending some catalog record is "you", the shell     */
/* asks which canonical teacher's workspace to inspect and keeps saying that     */
/* the choice is prototype state. The picker writes a single canonical id        */
/* (workspace-store.ts) — never a session.                                        */
/* -------------------------------------------------------------------------- */

export interface WorkspaceOption {
  id: string;
  name: string;
  specialization: string;
  photo: string | null;
  courseCount: number;
}

export function WorkspaceIdentity({
  options,
  currentName,
  currentSpecialization,
  photo,
}: {
  options: WorkspaceOption[];
  currentName: string | null;
  currentSpecialization: string | null;
  photo: string | null;
}) {
  const { ready, teacherId, select } = useTeacherWorkspace();
  const chosen = ready && teacherId !== null && currentName !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar
          name={chosen && currentName ? currentName : "?"}
          src={chosen ? photo : null}
          size="md"
          fallback={chosen ? undefined : "?"}
        />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink-900">
            {chosen && currentName ? currentName : "Ish maydoni tanlanmagan"}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink-500">
            {chosen && currentSpecialization ? currentSpecialization : "Prototip ko‘rinishi"}
          </p>
        </div>
      </div>

      <Badge variant="neutral">Ustoz · prototip ish maydoni</Badge>

      <SelectField
        label="Ish maydoni (prototip)"
        hint="Bu tizimga kirish emas — ko‘rish uchun katalogdagi ustozni tanlaysiz."
        value={ready ? (teacherId ?? "") : ""}
        onChange={(event) => select(event.target.value === "" ? null : event.target.value)}
      >
        <option value="">Tanlanmagan</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} — {option.courseCount} ta kurs
          </option>
        ))}
      </SelectField>

      {chosen ? (
        <Button variant="ghost" size="sm" onClick={() => select(null)}>
          Tanlovni tozalash
        </Button>
      ) : null}
    </div>
  );
}
