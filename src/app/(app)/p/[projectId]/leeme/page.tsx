import { notFound } from "next/navigation";

import { getTeamContext } from "@/server/auth/context";
import { getProject } from "@/server/domain/projects";
import { getProjectDoc, renderDoc } from "@/server/domain/doc";
import { hasTeamOnlyContent } from "@/lib/doc";
import { longDate } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/layout";
import { DocBody, HiddenForYouNote } from "@/components/app/project-doc";
import { ProjectDocPanel, StartDocButton } from "@/components/app/project-doc-panel";

export const metadata = { title: "Léeme" };

/**
 * El léeme del proyecto, completo.
 *
 * En el resumen aparece plegado; acá se lee entero y se edita. El markdown
 * crudo sólo cruza al cliente cuando quien mira puede escribir: para el resto
 * lo único que sale del servidor es el HTML ya recortado.
 */
export default async function ProjectDocPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await getTeamContext();

  const project = await getProject(projectId);
  if (!project) notFound();

  const canWrite = ctx.can("content.write");
  const doc = await getProjectDoc(projectId);
  const segments = doc ? renderDoc(doc.markdown, { includeTeamOnly: canWrite }) : [];

  // Un documento escrito entero dentro de `:::equipo` deja al visitante sin
  // nada que leer. Decirle "todavía no tiene léeme" sería mentirle: existe,
  // pero no es para él.
  if (doc && segments.length === 0) {
    return (
      <div className="max-w-3xl">
        <EmptyState
          title="El léeme de este proyecto es del equipo"
          description="El equipo escribió el contexto de este proyecto, pero lo reservó para quienes trabajan en él."
        />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="max-w-3xl">
        <EmptyState
          title="Este proyecto todavía no tiene léeme"
          description={
            canWrite
              ? "Es el lugar para explicar de qué se trata, cómo se trabaja con él y los datos que hacen falta para empezar: accesos, entornos, a quién preguntarle."
              : "Cuando el equipo escriba el contexto del proyecto, va a aparecer acá."
          }
          action={canWrite ? <StartDocButton projectId={project.id} /> : null}
        />
      </div>
    );
  }

  const body = (
    <article className="max-w-3xl">
      <DocBody segments={segments} />

      <footer className="mt-8 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3 text-2xs text-ink-4">
        <Avatar person={doc.updatedBy} size="xs" />
        <span>
          Última edición de {doc.updatedBy.name.split(" ")[0]} el {longDate(doc.updatedAt)}
        </span>
        {!canWrite && hasTeamOnlyContent(doc.markdown) && (
          <HiddenForYouNote className="w-full" />
        )}
      </footer>
    </article>
  );

  if (!canWrite) return body;

  return (
    <div className="max-w-3xl">
      <ProjectDocPanel projectId={project.id} markdown={doc.markdown}>
        {body}
      </ProjectDocPanel>
    </div>
  );
}
