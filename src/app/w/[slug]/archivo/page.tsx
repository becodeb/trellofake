import Link from "next/link";
import { Archive } from "lucide-react";

import { requireWorkspace } from "@/server/auth/context";
import { listProjects } from "@/server/domain/projects";
import { PROJECT_STATUS_META, accentHex, type ProjectStatus } from "@/lib/domain";
import { longDate, pluralize } from "@/lib/format";
import { Page } from "@/components/app/shell";
import { RestoreProjectButton } from "@/components/app/restore-project";
import { AvatarStack } from "@/components/ui/avatar";
import { EmptyState, PageHeader } from "@/components/ui/layout";

export const metadata = { title: "Archivo" };

/**
 * Archivo.
 *
 * Terminar un proyecto no borra nada: sale del tablero activo y queda acá con
 * toda su información —tareas, decisiones, archivos e historial— por si hay
 * que consultarlo o retomarlo.
 */
export default async function ArchivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);

  const projects = await listProjects(ctx.workspace.id, {
    archived: true,
    viewer: { role: ctx.role, userId: ctx.user.id },
  });
  const roots = projects.filter((p) => !p.parentId);

  return (
    <Page>
      <PageHeader
        eyebrow={projects.length > 0 ? pluralize(roots.length, "proyecto", "proyectos") : undefined}
        title="Archivo"
        description="Lo que se terminó o se canceló. Nada se borra: se puede leer y se puede retomar."
      />

      {roots.length === 0 ? (
        <EmptyState
          icon={<Archive className="size-4" strokeWidth={1.8} />}
          title="El archivo está vacío"
          description="Cuando marques un proyecto como terminado o cancelado va a pasar acá, con todo lo que tenía adentro."
        />
      ) : (
        <div className="max-w-3xl space-y-2.5">
          {roots.map((project) => {
            const status = PROJECT_STATUS_META[project.status as ProjectStatus];
            const nested = projects.filter((p) => p.parentId === project.id);

            return (
              <article
                key={project.id}
                className="rounded-[var(--r-lg)] border border-line bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/w/${slug}/p/${project.id}`}
                      className="group flex items-center gap-2"
                    >
                      <span
                        className="size-2 shrink-0 rounded-[3px] opacity-50"
                        style={{ background: accentHex(project.accent) }}
                      />
                      <h2 className="text-md font-semibold tracking-tight text-ink group-hover:underline">
                        {project.name}
                      </h2>
                    </Link>

                    {project.description && (
                      <p className="mt-1.5 text-xs leading-relaxed text-ink-3 clamp-2">
                        {project.description}
                      </p>
                    )}

                    <p className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-ink-4">
                      <span>{status?.label}</span>
                      {project.completedAt && (
                        <>
                          <span className="opacity-50">·</span>
                          <span>Cerrado el {longDate(project.completedAt)}</span>
                        </>
                      )}
                      {project.rollup.total > 0 && (
                        <>
                          <span className="opacity-50">·</span>
                          <span className="tabular">
                            {project.rollup.done}/{project.rollup.total} tareas
                          </span>
                        </>
                      )}
                      {nested.length > 0 && (
                        <>
                          <span className="opacity-50">·</span>
                          <span>{pluralize(nested.length, "subproyecto", "subproyectos")}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2.5">
                    <AvatarStack people={project.members.map((m) => m.user)} size="xs" />
                    {ctx.can("project.archive") && (
                      <RestoreProjectButton slug={slug} projectId={project.id} name={project.name} />
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Page>
  );
}
