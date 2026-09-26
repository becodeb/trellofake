import { notFound } from "next/navigation";

import { getTeamContext } from "@/server/auth/context";
import { getProject, listProjects } from "@/server/domain/projects";
import { listKnowledgeResources } from "@/server/domain/resources";
import { ResourceLibrary } from "@/components/app/resource-library";
import { SectionHeader } from "@/components/ui/layout";

export const metadata = { title: "Recursos" };

/**
 * Recursos del proyecto (antes "Cómo conectarse" / `/integracion`).
 *
 * Reemplaza los dos lugares donde vivían los enlaces del proyecto: acá está
 * la biblioteca completa (con guía de acceso, markdown y captura), y el
 * resumen solo muestra un recorte arriba de todo. La ruta vieja sigue
 * andando: redirige acá para no romper marcadores ni el MCP.
 */
export default async function ProjectResourcesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await getTeamContext();
  const project = await getProject(projectId);
  if (!project) notFound();

  const [resources, projects] = await Promise.all([
    listKnowledgeResources(projectId),
    listProjects({ archived: false }),
  ]);

  return (
    <section>
      <SectionHeader title="Recursos del proyecto" count={resources.length} />
      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-ink-3">
        Sitio, repositorio, entornos locales, bases de datos, diseños y guías de acceso.
        Las guías se pueden copiar como Markdown para dárselas a una IA.
      </p>
      <ResourceLibrary
        resources={resources}
        projects={projects.map((item) => ({ id: item.id, name: item.name }))}
        canManage={ctx.can("resource.manage")}
        defaultProjectId={projectId}
      />
    </section>
  );
}
