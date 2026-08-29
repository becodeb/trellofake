import { notFound } from "next/navigation";

import { requireMember } from "@/server/auth/context";
import { getProject, subtreeIds } from "@/server/domain/projects";
import { db } from "@/server/db";
import { AttachmentGrid, FileDrop } from "@/components/app/attachments";
import { ResourceLinks } from "@/components/app/resource-links";
import { EmptyState, SectionHeader } from "@/components/ui/layout";

/**
 * Archivos y recursos.
 *
 * Lo que se sube a una tarea aparece también acá: si algo está en el proyecto,
 * tiene que poder encontrarse sin recordar en qué tarjeta se adjuntó.
 */
export default async function ProjectFiles({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireMember();
  if (!ctx.can("content.write")) notFound();

  const project = await getProject(projectId);
  if (!project) notFound();

  const ids = await subtreeIds(project.id, project.path);

  const attachments = await db.attachment.findMany({
    where: { projectId: { in: ids } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      storageKey: true,
      kind: true,
      createdAt: true,
      uploader: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
    },
  });

  const canWrite = ctx.can("content.write");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_312px]">
      <div className="min-w-0">
        <SectionHeader title="Archivos" count={attachments.length} />

        {canWrite && (
          <FileDrop
            projectId={project.id}
            className="mb-4"
            label="Arrastrá acá capturas, PDFs, diseños o lo que haga falta"
          />
        )}

        {attachments.length === 0 ? (
          <EmptyState
            compact
            title="Sin archivos todavía"
            description="Las imágenes que subas a una tarea también aparecen en esta lista."
          />
        ) : (
          <AttachmentGrid attachments={attachments} viewerId={ctx.user.id} />
        )}
      </div>

      <aside className="min-w-0">
        <SectionHeader title="Recursos" count={project.links.length} />
        <ResourceLinks
          projectId={project.id}
          links={project.links}
          canWrite={canWrite}
        />
        <p className="mt-2 text-2xs leading-relaxed text-ink-4">
          Pegá cualquier URL: el tipo (repositorio, diseño, documentación…) se deduce solo.
        </p>
      </aside>
    </div>
  );
}