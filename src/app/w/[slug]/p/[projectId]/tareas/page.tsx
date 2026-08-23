import Link from "next/link";
import { notFound } from "next/navigation";
import { Columns3, List } from "lucide-react";

import { requireWorkspace } from "@/server/auth/context";
import { getProject, subtreeIds } from "@/server/domain/projects";
import { listItems, sortByUrgency } from "@/server/domain/items";
import { TASK_STATUSES } from "@/lib/domain";
import { cn } from "@/lib/cn";
import { TaskBoard } from "@/components/app/task-board";
import { ItemRow, InlineComposer } from "@/components/app/item-row";
import { EmptyState } from "@/components/ui/layout";

/**
 * Tareas del proyecto.
 *
 * Dos formas de mirar lo mismo: tablero para mover trabajo y lista para leer
 * rápido. Por defecto se incluyen las tareas de los subproyectos, porque un
 * proyecto padre casi no tiene tareas propias.
 */
export default async function ProjectTasks({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; projectId: string }>;
  searchParams: Promise<{ vista?: string; solo?: string }>;
}) {
  const { slug, projectId } = await params;
  const { vista, solo } = await searchParams;
  const ctx = await requireWorkspace(slug);
  if (!ctx.can("content.write")) notFound();

  const project = await getProject(ctx.workspace.id, projectId, {
    role: ctx.role,
    userId: ctx.user.id,
  });
  if (!project) notFound();

  const onlyThis = solo === "1";
  const ids = onlyThis ? [project.id] : await subtreeIds(project.id, project.path);

  const tasks = await listItems(ctx.workspace.id, {
    projectIds: ids,
    types: ["task"],
    rootOnly: true,
  });

  const listView = vista === "lista";
  const canWrite = ctx.can("content.write");

  const base = `/w/${slug}/p/${projectId}/tareas`;
  const query = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { vista, solo, ...next };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-[var(--r-md)] bg-surface-2 p-0.5">
          <Toggle href={query({ vista: undefined })} active={!listView}>
            <Columns3 className="size-3.5" strokeWidth={1.9} />
            Tablero
          </Toggle>
          <Toggle href={query({ vista: "lista" })} active={listView}>
            <List className="size-3.5" strokeWidth={1.9} />
            Lista
          </Toggle>
        </div>

        {project.children.length > 0 && (
          <Link
            href={query({ solo: onlyThis ? undefined : "1" })}
            className="text-xs text-ink-3 transition-colors hover:text-ink"
          >
            {onlyThis ? "Incluir subproyectos" : "Solo este proyecto"}
          </Link>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="Todavía no hay tareas"
          description="Escribí la primera abajo, o usá la tecla C desde cualquier pantalla."
          action={
            canWrite ? (
              <div className="w-full max-w-sm overflow-hidden rounded-[var(--r-md)] border border-line bg-surface">
                <InlineComposer slug={slug} projectId={project.id} />
              </div>
            ) : null
          }
        />
      ) : listView ? (
        <ListView slug={slug} projectId={project.id} tasks={tasks} canWrite={canWrite} />
      ) : (
        <TaskBoard
          slug={slug}
          projectId={project.id}
          tasks={tasks}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}

function Toggle({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-[var(--r-sm)] px-2.5 py-1 text-xs font-medium transition-all",
        active ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-3 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

/** Lista agrupada por estado, en el mismo orden que las columnas del tablero. */
function ListView({
  slug,
  projectId,
  tasks,
  canWrite,
}: {
  slug: string;
  projectId: string;
  tasks: Awaited<ReturnType<typeof listItems>>;
  canWrite: boolean;
}) {
  const groups = TASK_STATUSES.map((status) => ({
    ...status,
    items: sortByUrgency(tasks.filter((task) => task.status === status.value)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="max-w-3xl space-y-5">
      {groups.map((group) => (
        <section key={group.value}>
          <h3 className="mb-2 flex items-baseline gap-2 px-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
            {group.label}
            <span className="text-2xs tabular text-ink-4">{group.items.length}</span>
          </h3>
          <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
            {group.items.map((task) => (
              <ItemRow key={task.id} item={task} slug={slug} />
            ))}
            {canWrite && group.value === "todo" && (
              <InlineComposer
                slug={slug}
                projectId={projectId}
                className="border-t border-line-soft"
              />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
