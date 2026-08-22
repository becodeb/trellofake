import { db } from "@/server/db";
import { requireWorkspace } from "@/server/auth/context";
import { projectOptions, projectTree } from "@/server/domain/projects";
import { feedCounts } from "@/server/domain/feed";
import { workspaceMembers } from "@/server/domain/dashboard";
import { OPEN_TASK_STATUSES } from "@/lib/domain";
import { AppShell } from "@/components/app/shell";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);

  const [projects, options, members, counts, myOpenTasks] = await Promise.all([
    projectTree(ctx.workspace.id),
    projectOptions(ctx.workspace.id),
    workspaceMembers(ctx.workspace.id),
    feedCounts(ctx.workspace.id, ctx.user.id, ctx.lastSeenAt),
    db.item.count({
      where: {
        workspaceId: ctx.workspace.id,
        type: "task",
        status: { in: OPEN_TASK_STATUSES },
        project: { archivedAt: null },
        OR: [
          { assignments: { some: { userId: ctx.user.id } } },
          { assigneeScope: "team" },
        ],
      },
    }),
  ]);

  return (
    <AppShell
      slug={slug}
      workspaceName={ctx.workspace.name}
      user={ctx.user}
      role={ctx.role}
      canManage={ctx.can("workspace.manage")}
      projects={projects}
      projectOptions={options}
      members={members.map((m) => m.user)}
      unread={counts.unread}
      myOpenTasks={myOpenTasks}
    >
      {children}
    </AppShell>
  );
}
