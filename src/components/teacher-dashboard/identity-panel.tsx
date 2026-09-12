"use client";

import { useTeacherWorkspace } from "./workspace-store";
import { WorkspaceIdentity, type WorkspaceOption } from "./workspace-picker";

/* -------------------------------------------------------------------------- */
/* Identity panel — resolves the chosen workspace from the COMPACT option list  */
/* only (id + name + specialization + photo + course count). The full directory */
/* projection stays on the server pages, so the shell island ships a few short  */
/* strings instead of every course and group.                                    */
/* -------------------------------------------------------------------------- */

export function TeacherIdentityPanel({ options }: { options: WorkspaceOption[] }) {
  const { ready, teacherId } = useTeacherWorkspace();
  const current = ready
    ? (options.find((option) => option.id === teacherId) ?? null)
    : null;

  return (
    <WorkspaceIdentity
      options={options}
      currentName={current?.name ?? null}
      currentSpecialization={current?.specialization ?? null}
      photo={current?.photo ?? null}
    />
  );
}
