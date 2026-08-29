import { db } from "@/server/db";
import { getTeamContext } from "@/server/auth/context";
import { projectOptions, projectTree } from "@/server/domain/projects";
import { feedCounts } from "@/server/domain/feed";
import { teamMembers } from "@/server/domain/dashboard";
import { OPEN_TASK_STATUSES } from "@/lib/domain";
import { AppShell } from "@/components/app/shell";

/**
 * Marco de la app (grupo de rutas `(app)`).
 *
 * Guest-safe: sin sesión el shell se sirve igual, con la navegación pública y
 * los CTAs de Ingresar/Registrarse en lugar de las acciones de usuario.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTeamContext();

  const [projects, options, members, counts, myOpenTasks] = await Promise.all([
    projectTree(false),
    projectOptions(),
    teamMembers(),
    ctx.membershipId && ctx.lastSeenAt
      ? feedCounts(ctx.user!.id, ctx.lastSeenAt)
      : Promise.resolve({ unread: 0, direct: 0, sinceLastVisit: 0 }),
    ctx.user
      ? db.item.count({
          where: {
            type: "task",
            status: { in: OPEN_TASK_STATUSES },
            project: { archivedAt: null },
            OR: [
              { assignments: { some: { userId: ctx.user.id } } },
              { assigneeScope: "team" },
            ],
          },
        })
      : Promise.resolve(0),
  ]);

  const people = members
    .filter((member) => member.role !== "community")
    .map((member) => member.user);

  return (
    <AppShell
      teamName={ctx.team.name}
      user={ctx.user}
      role={ctx.role}
      isGuest={ctx.role === "guest"}
      canManage={ctx.can("workspace.manage")}
      canWork={ctx.can("content.write")}
      projects={projects}
      projectOptions={options}
      members={people}
      unread={counts.unread}
      myOpenTasks={myOpenTasks}
    >
      {children}
    </AppShell>
  );
}