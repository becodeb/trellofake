import Link from "next/link";

import { db } from "@/server/db";
import { getTeamContext } from "@/server/auth/context";
import { teamMembers } from "@/server/domain/dashboard";
import { itemWhere } from "@/server/domain/items";
import { OPEN_TASK_STATUSES, ROLE_LABEL, type WorkspaceRole } from "@/lib/domain";
import { relativeTime } from "@/lib/format";
import { Page } from "@/components/app/shell";
import { PageHeader, EmptyState } from "@/components/ui/layout";
import { Avatar } from "@/components/ui/avatar";

export const metadata = { title: "Gente" };

/**
 * Quién forma el equipo, a un click de cada perfil.
 *
 * Contenido público: la comunidad también puede ver quién está construyendo,
 * igual que hace con los proyectos. Las cuentas de comunidad no aparecen acá
 * porque no tienen trabajo asignado que mostrar; su lugar es "Ideas propuestas".
 */
export default async function PeoplePage() {
  const ctx = await getTeamContext();
  const members = (await teamMembers()).filter((member) => member.role !== "community");

  const openTaskCounts = await Promise.all(
    members.map((member) =>
      db.item.count({
        where: itemWhere({
          types: ["task"],
          statuses: OPEN_TASK_STATUSES,
          assigneeId: member.user.id,
        }),
      }),
    ),
  );

  return (
    <Page>
      <PageHeader
        title="Gente"
        description="El equipo que construye, con lo que tiene abierto ahora mismo."
      />

      {members.length === 0 ? (
        <EmptyState title="Todavía no hay nadie en el equipo" compact />
      ) : (
        <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
          {members.map((member, index) => (
            <Link
              key={member.id}
              href={`/gente/${member.user.id}`}
              className="row hairline flex items-center gap-3 px-3.5 py-2.5"
            >
              <Avatar person={member.user} size="lg" />

              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {member.user.name}
                  {ctx.user?.id === member.user.id && (
                    <span className="ml-1.5 text-2xs font-normal text-ink-4">vos</span>
                  )}
                </span>
                <span className="block truncate text-2xs text-ink-4">
                  {member.title ?? ROLE_LABEL[member.role as WorkspaceRole] ?? member.role}
                </span>
              </div>

              <span className="hidden text-2xs text-ink-4 sm:block">
                Visto {relativeTime(member.lastSeenAt)}
              </span>

              <span className="shrink-0 text-2xs tabular text-ink-4">
                {openTaskCounts[index]}{" "}
                {openTaskCounts[index] === 1 ? "tarea abierta" : "tareas abiertas"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
