import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { getTeamContext } from "@/server/auth/context";
import { getProject, subtreeIds } from "@/server/domain/projects";
import { listItems } from "@/server/domain/items";
import { projectHistory } from "@/server/domain/feed";
import { teamMembers } from "@/server/domain/dashboard";
import { db } from "@/server/db";
import { collapseNoise } from "@/lib/shared";
import { OPEN_TASK_STATUSES, accentHex } from "@/lib/domain";
import { relativeTime } from "@/lib/format";
import { ItemRow, InlineComposer } from "@/components/app/item-row";
import { ActivityLine } from "@/components/app/activity";
import { CommentThread } from "@/components/app/comments";
import { ResourceLinks } from "@/components/app/resource-links";
import { EmptyState, SectionHeader } from "@/components/ui/layout";
import { ProgressBar } from "@/components/ui/glyphs";

/**
 * Resumen del proyecto.
 *
 * La versión corta de todo: en qué se divide, qué se está haciendo, qué se
 * decidió, dónde están los recursos y qué pasó último. Cada bloque enlaza a su
 * pestaña cuando hace falta el detalle.
 */
export default async function ProjectOverview({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await getTeamContext();

  const project = await getProject(projectId);
  if (!project) notFound();

  if (!ctx.can("content.write") || !ctx.user) {
    return <CommunityProjectOverview ctx={ctx} project={project} />;
  }

  const userId = ctx.user.id;
  const ids = await subtreeIds(project.id, project.path);

  const [openTasks, decisions, problems, activity, members, comments] = await Promise.all([
    listItems({
      projectIds: ids,
      types: ["task"],
      statuses: OPEN_TASK_STATUSES,
      rootOnly: true,
      orderBy: "priority",
      take: 8,
    }),
    listItems({
      projectIds: ids,
      types: ["decision"],
      orderBy: "recent",
      take: 4,
    }),
    listItems({
      projectIds: ids,
      types: ["problem"],
      statuses: ["open", "investigating"],
      orderBy: "recent",
      take: 4,
    }),
    projectHistory(ids, { take: 12 }),
    teamMembers(),
    db.comment.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        author: {
          select: { id: true, name: true, avatarUrl: true, accentColor: true },
        },
      },
    }),
  ]);

  const people = members.map((m) => m.user);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_312px]">
      <div className="min-w-0 space-y-8">
        {project.children.length > 0 && (
          <section>
            <SectionHeader title="Se divide en" count={project.children.length} />
            <div className="grid gap-2.5 sm:grid-cols-2">
              {project.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/p/${child.id}`}
                  className="group rounded-[var(--r-lg)] border border-line bg-surface p-3.5 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[var(--shadow-sm)]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-[3px]"
                      style={{ background: accentHex(child.accent) }}
                    />
                    <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {child.name}
                    </h3>
                    <span className="text-2xs tabular text-ink-4">{child.progress}%</span>
                  </div>

                  {child.description && (
                    <p className="mt-1.5 text-2xs leading-relaxed text-ink-4 clamp-2">
                      {child.description}
                    </p>
                  )}

                  <ProgressBar
                    value={child.progress}
                    tone={child.progress === 100 ? "done" : "progress"}
                    className="mt-2.5"
                  />

                  <p className="mt-2 flex items-center gap-2 text-2xs text-ink-4">
                    <span className="tabular">
                      {child.rollup.done}/{child.rollup.total} tareas
                    </span>
                    {child.rollup.blocked > 0 && (
                      <span style={{ color: "var(--tone-blocked)" }}>
                        {child.rollup.blocked} frenada{child.rollup.blocked > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHeader
            title="En curso"
            count={project.subtreeRollup.open}
            action={
              <Link
                href={`/p/${projectId}/tareas`}
                className="inline-flex items-center gap-1 text-xs text-ink-3 transition-colors hover:text-ink"
              >
                Ver el tablero <ArrowRight className="size-3" strokeWidth={2} />
              </Link>
            }
          />
          <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
            {openTasks.map((task) => (
              <ItemRow
                key={task.id}
                item={task}
                showProject={task.projectId !== project.id}
              />
            ))}
            <InlineComposer
              projectId={project.id}
              placeholder="Nueva tarea…"
              className={openTasks.length > 0 ? "border-t border-line-soft" : undefined}
            />
          </div>
        </section>

        {problems.length > 0 && (
          <section>
            <SectionHeader title="Problemas abiertos" count={problems.length} />
            <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--tone-blocked)]/25 bg-surface">
              {problems.map((problem) => (
                <ItemRow key={problem.id} item={problem} />
              ))}
            </div>
          </section>
        )}

        {decisions.length > 0 && (
          <section>
            <SectionHeader
              title="Decisiones"
              count={decisions.length}
              action={
                <Link
                  href={`/p/${projectId}/espacio?tipo=decision`}
                  className="text-xs text-ink-3 transition-colors hover:text-ink"
                >
                  Ver todas
                </Link>
              }
            />
            <div className="space-y-2">
              {decisions.map((decision) => (
                <Link
                  key={decision.id}
                  href={`/p/${projectId}?item=${decision.id}`}
                  className="block rounded-[var(--r-lg)] border border-line bg-surface p-3.5 transition-colors hover:border-line-strong"
                >
                  <p className="text-sm font-medium leading-snug text-ink">{decision.title}</p>
                  {decision.body && (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-3 clamp-3">
                      {decision.body}
                    </p>
                  )}
                  <p className="mt-2 text-2xs text-ink-4">
                    {decision.createdBy.name.split(" ")[0]} ·{" "}
                    {relativeTime(decision.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHeader title="Conversación del proyecto" count={comments.length} />
          <div className="rounded-[var(--r-lg)] border border-line bg-surface p-4">
            <CommentThread
              projectId={project.id}
              comments={comments}
              members={people}
              viewerId={ctx.user.id}
              emptyHint="Para lo que es del proyecto entero y no de una tarea en particular."
            />
          </div>
        </section>
      </div>

      <aside className="min-w-0 space-y-8">
        <section>
          <SectionHeader title="Enlaces del proyecto" count={project.links.length} />
          <ResourceLinks
            projectId={project.id}
            links={project.links}
            canWrite={ctx.can("content.write")}
          />
        </section>

        <section>
          <SectionHeader
            title="Lo último"
            action={
              <Link
                href={`/p/${projectId}/historial`}
                className="text-xs text-ink-3 transition-colors hover:text-ink"
              >
                Historial
              </Link>
            }
          />
          {activity.length === 0 ? (
            <EmptyState compact title="Sin movimientos todavía" />
          ) : (
            <div className="pl-0.5">
              {collapseNoise(activity)
                .slice(0, 8)
                .map((event) => (
                  <ActivityLine
                    key={event.id}
                    event={event}
                    currentUserId={userId}
                    showProject={false}
                  />
                ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

async function CommunityProjectOverview({
  ctx,
  project,
}: {
  ctx: Awaited<ReturnType<typeof getTeamContext>>;
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>;
}) {
  const [members, comments, guides] = await Promise.all([
    teamMembers(),
    db.comment.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        author: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
      },
    }),
    db.knowledgeResource.count({
      where: { projectId: project.id },
    }),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-8">
        {project.children.length > 0 && (
          <section>
            <SectionHeader title="Partes del proyecto" count={project.children.length} />
            <div className="grid gap-2.5 sm:grid-cols-2">
              {project.children.map((child) => (
                <Link key={child.id} href={`/p/${child.id}`} className="rounded-[var(--r-lg)] border border-line bg-surface p-3.5 transition-colors hover:border-line-strong">
                  <p className="text-sm font-medium text-ink">{child.name}</p>
                  {child.description && <p className="mt-1 text-xs leading-relaxed text-ink-3 clamp-2">{child.description}</p>}
                  <ProgressBar value={child.progress} tone={child.progress === 100 ? "done" : "progress"} className="mt-3" />
                  <p className="mt-1.5 text-right text-2xs tabular text-ink-4">{child.progress}%</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHeader title="Conversación del proyecto" count={comments.length} />
          <div className="rounded-[var(--r-lg)] border border-line bg-surface p-4">
            <CommentThread
              projectId={project.id}
              comments={comments}
              members={members.map((member) => member.user)}
              viewerId={ctx.user?.id ?? null}
              emptyHint="Podés preguntar, sugerir una mejora o sumar contexto para el equipo."
            />
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <div className="rounded-[var(--r-lg)] border border-line bg-surface p-4">
          <p className="text-2xs font-semibold uppercase tracking-[0.07em] text-ink-4">Estado compartido</p>
          <p className="mt-3 text-3xl font-semibold tabular tracking-tight text-ink">{project.progress}%</p>
          <ProgressBar value={project.progress} tone={project.progress === 100 ? "done" : "progress"} className="mt-2" />
          <p className="mt-3 text-xs leading-relaxed text-ink-3">El progreso se actualiza a medida que el equipo termina las partes planificadas.</p>
        </div>
        <Link href={`/p/${project.id}/integracion`} className="group block rounded-[var(--r-lg)] border border-line bg-surface p-4 transition-colors hover:border-line-strong">
          <p className="text-sm font-semibold text-ink">Cómo conectarse</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">{guides ? `${guides} recursos y guías disponibles.` : "Todavía no hay una guía pública."}</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-ink">Ver integración <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
      </aside>
    </div>
  );
}