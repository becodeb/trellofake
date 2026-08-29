import Link from "next/link";

import { getTeamContext } from "@/server/auth/context";
import { listProjects } from "@/server/domain/projects";
import { teamMembers } from "@/server/domain/dashboard";
import { PROJECT_STATUS_META, type ProjectStatus } from "@/lib/domain";
import { cn } from "@/lib/cn";
import { Page } from "@/components/app/shell";
import { ProjectCard } from "@/components/app/project-card";
import { NewProjectButton } from "@/components/app/new-project";
import { EmptyState, PageHeader, SectionHeader } from "@/components/ui/layout";

export const metadata = { title: "Proyectos" };

const FILTERS: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: "activos", label: "Activos", statuses: ["active"] },
  { key: "pausa", label: "En pausa", statuses: ["paused"] },
  { key: "todos", label: "Todos", statuses: ["active", "paused"] },
];

/**
 * Proyectos.
 *
 * Los frentes de trabajo se muestran como tarjetas; los subproyectos cuelgan
 * de su padre en vez de competir con él en la misma grilla, que es como el
 * equipo los piensa.
 */
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const ctx = await getTeamContext();

  const filter = FILTERS.find((f) => f.key === estado) ?? FILTERS[0];

  const [roots, members] = await Promise.all([
    listProjects({
      parentId: null,
      archived: false,
      statuses: filter.statuses,
    }),
    teamMembers(),
  ]);

  const children = await Promise.all(
    roots.map((root) =>
      listProjects({
        parentId: root.id,
        archived: false,
      }),
    ),
  );

  return (
    <Page width="wide">
      <PageHeader
        title="Proyectos"
        description="Cada proyecto reúne sus tareas, su gente, sus archivos y su historia."
        actions={
          ctx.can("project.create") ? (
            <NewProjectButton
              members={members.map((m) => m.user)}
              parents={roots.map((r) => ({
                id: r.id,
                name: r.name,
                depth: 0,
                accent: r.accent,
              }))}
            />
          ) : null
        }
      />

      <nav className="mb-5 flex flex-wrap items-center gap-1 border-b border-line pb-px">
        {FILTERS.map((option) => (
          <Link
            key={option.key}
            href={`/proyectos${option.key === "activos" ? "" : `?estado=${option.key}`}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              option.key === filter.key
                ? "border-accent font-medium text-ink"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {option.label}
          </Link>
        ))}
        <Link
          href="/archivo"
          className="-mb-px ml-auto border-b-2 border-transparent px-3 py-2 text-sm text-ink-3 transition-colors hover:text-ink"
        >
          Archivo
        </Link>
      </nav>

      {roots.length === 0 ? (
        <EmptyState
          title="No hay proyectos acá"
          description={
            filter.key === "activos"
              ? "Cuando el equipo arranque algo, va a vivir en un proyecto: tareas, decisiones, archivos e historia en un solo lugar."
              : "Probá con otro filtro o mirá el archivo."
          }
        />
      ) : (
        <div className="space-y-9">
          {roots.map((project, index) => {
            const subprojects = children[index];
            const status = PROJECT_STATUS_META[project.status as ProjectStatus];

            return (
              <section key={project.id}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <ProjectCard project={project} />

                  {subprojects.length > 0 && (
                    <div className="sm:col-span-1 xl:col-span-2">
                      <SectionHeader
                        title={`Dentro de ${project.name}`}
                        count={subprojects.length}
                      />
                      <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
                        {subprojects.map((child) => (
                          <SubprojectRow key={child.id} project={child} />
                        ))}
                      </div>
                      {status && !status.closed && (
                        <p className="mt-2 text-2xs text-ink-4">
                          El progreso del proyecto sale del promedio de sus subproyectos y
                          sus tareas de primer nivel.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Page>
  );
}

function SubprojectRow({
  project,
}: {
  project: Awaited<ReturnType<typeof listProjects>>[number];
}) {
  const status = PROJECT_STATUS_META[project.status as ProjectStatus];

  return (
    <Link href={`/p/${project.id}`} className="row hairline flex items-center gap-3 px-3.5 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{project.name}</span>
        <span className="mt-0.5 flex items-center gap-2 text-2xs text-ink-4">
          <span>{status?.label}</span>
          {project.rollup.total > 0 && (
            <>
              <span className="opacity-50">·</span>
              <span className="tabular">
                {project.rollup.done}/{project.rollup.total} tareas
              </span>
            </>
          )}
          {project.rollup.blocked > 0 && (
            <>
              <span className="opacity-50">·</span>
              <span style={{ color: "var(--tone-blocked)" }}>
                {project.rollup.blocked} bloqueada{project.rollup.blocked > 1 ? "s" : ""}
              </span>
            </>
          )}
        </span>
      </span>

      <span className="flex w-32 shrink-0 items-center gap-2">
        <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${project.progress}%`,
              background: project.progress === 100 ? "var(--tone-done)" : "var(--tone-progress)",
            }}
          />
        </span>
        <span className="w-8 text-right text-2xs tabular text-ink-3">{project.progress}%</span>
      </span>
    </Link>
  );
}