import { getTeamContext } from "@/server/auth/context";
import { listProjects } from "@/server/domain/projects";
import { db } from "@/server/db";
import { Page } from "@/components/app/shell";
import { ProposalsBoard } from "@/components/app/proposals-board";
import { PageHeader } from "@/components/ui/layout";

export const metadata = { title: "Ideas propuestas" };

export default async function IdeasPage() {
  const ctx = await getTeamContext();

  const [proposals, projects] = await Promise.all([
    db.proposal.findMany({
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        status: true,
        createdAt: true,
        author: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
        targetProject: { select: { id: true, name: true } },
        promotedProject: { select: { id: true, name: true } },
        replies: {
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    listProjects({ archived: false }),
  ]);

  const statusOrder: Record<string, number> = {
    proposed: 0,
    reviewing: 1,
    accepted: 2,
    planned: 3,
    declined: 4,
  };
  const safeProposals = proposals
    .sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));

  return (
    <Page>
      <PageHeader
        eyebrow="Participación"
        title="Ideas propuestas"
        description="Un solo buzón para necesidades, mejoras y proyectos nuevos. Acá se conversa antes de convertir una idea en trabajo."
      />
      <ProposalsBoard
        proposals={safeProposals}
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        canManage={ctx.can("proposal.manage")}
        viewer={ctx.user}
      />
    </Page>
  );
}