import { requireWorkspace } from "@/server/auth/context";
import { listKnowledgeResources } from "@/server/domain/resources";
import { listProjects } from "@/server/domain/projects";
import { Page } from "@/components/app/shell";
import { ResourceLibrary } from "@/components/app/resource-library";
import { PageHeader } from "@/components/ui/layout";

export const metadata = { title: "Recursos compartidos" };

export default async function ResourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const viewer = { role: ctx.role, userId: ctx.user.id };
  const [resources, projects] = await Promise.all([
    listKnowledgeResources(ctx.workspace.id, viewer),
    listProjects(ctx.workspace.id, { archived: false, viewer }),
  ]);

  return (
    <Page>
      <PageHeader
        eyebrow="Biblioteca de la red"
        title="Recursos compartidos"
        description="Bases de datos, diseños, repositorios y servicios con instrucciones concretas de acceso. Las credenciales y tokens quedan fuera de Hilo."
      />
      <ResourceLibrary
        slug={slug}
        resources={resources}
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        canManage={ctx.can("resource.manage")}
      />
    </Page>
  );
}
