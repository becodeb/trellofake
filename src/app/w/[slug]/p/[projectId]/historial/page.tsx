import { notFound } from "next/navigation";

import { requireWorkspace } from "@/server/auth/context";
import { getProject, subtreeIds } from "@/server/domain/projects";
import { projectHistory } from "@/server/domain/feed";
import { collapseNoise } from "@/lib/shared";
import { ActivityTimeline } from "@/components/app/activity";
import { EmptyState } from "@/components/ui/layout";

/**
 * Historial del proyecto.
 *
 * La memoria: quién hizo qué y cuándo, sin que nadie tenga que anotarlo. Es lo
 * que se lee cuando alguien vuelve después de una semana, o cuando hay que
 * reconstruir por qué algo terminó como terminó.
 */
export default async function ProjectHistory({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  const ctx = await requireWorkspace(slug);

  const project = await getProject(ctx.workspace.id, projectId);
  if (!project) notFound();

  const ids = await subtreeIds(project.id, project.path);
  const events = collapseNoise(await projectHistory(ids, { take: 200 }));

  return (
    <div className="max-w-2xl">
      {events.length === 0 ? (
        <EmptyState
          title="Todavía no pasó nada acá"
          description="Cada tarea que se cree, cada estado que cambie y cada comentario van a quedar registrados en esta página automáticamente."
        />
      ) : (
        <>
          <p className="mb-5 text-xs text-ink-4">
            {events.length} movimientos registrados
            {project.children.length > 0 && ", incluyendo los de sus subproyectos"}.
          </p>
          <ActivityTimeline
            events={events}
            slug={slug}
            currentUserId={ctx.user.id}
            showProject={project.children.length > 0}
          />
        </>
      )}
    </div>
  );
}
