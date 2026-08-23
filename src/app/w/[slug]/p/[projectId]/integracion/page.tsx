import { notFound } from "next/navigation";

import { requireWorkspace } from "@/server/auth/context";
import { getProject, listProjects } from "@/server/domain/projects";
import { listKnowledgeResources } from "@/server/domain/resources";
import { ResourceLibrary } from "@/components/app/resource-library";
import { SectionHeader } from "@/components/ui/layout";

export const metadata = { title: "Cómo conectarse" };

export default async function ProjectIntegrationPage({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  const ctx = await requireWorkspace(slug);
  const viewer = { role: ctx.role, userId: ctx.user.id };
  const project = await getProject(ctx.workspace.id, projectId, viewer);
  if (!project) notFound();

  const [resources, projects] = await Promise.all([
    listKnowledgeResources(ctx.workspace.id, viewer, projectId),
    listProjects(ctx.workspace.id, { archived: false, viewer }),
  ]);

  return (
    <section>
      <SectionHeader title="Cómo conectarse con este proyecto" count={resources.length} />
      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-ink-3">
        Contratos de API, endpoints y contexto para reutilizar lo que ya existe desde otra
        aplicación. Las guías se pueden copiar como Markdown para dárselas a una IA.
      </p>
      <ResourceLibrary
        slug={slug}
        resources={resources}
        projects={projects.map((item) => ({ id: item.id, name: item.name }))}
        canManage={ctx.can("resource.manage")}
        defaultProjectId={projectId}
      />
    </section>
  );
}
