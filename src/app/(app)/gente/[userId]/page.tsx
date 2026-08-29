import Link from "next/link";
import { notFound } from "next/navigation";

import { getTeamContext } from "@/server/auth/context";
import { db } from "@/server/db";
import { bucketTasks, listItems, sortByUrgency } from "@/server/domain/items";
import { collapseNoise } from "@/lib/shared";
import { OPEN_TASK_STATUSES, ROLE_LABEL, accentHex, type WorkspaceRole } from "@/lib/domain";
import { longDate, relativeTime } from "@/lib/format";
import { Page } from "@/components/app/shell";
import { ItemRow } from "@/components/app/item-row";
import { ActivityLine } from "@/components/app/activity";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, SectionHeader } from "@/components/ui/layout";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  return { title: user?.name ?? "Persona" };
}

/**
 * Perfil de una persona dentro del equipo.
 *
 * Responde "qué está haciendo cada uno" sin tener que revisar proyecto por
 * proyecto: en qué está metido, qué tiene abierto y qué movió últimamente.
 */
export default async function PersonPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const ctx = await getTeamContext();

  const membership = await db.membership.findUnique({
    where: { userId },
    select: {
      role: true,
      title: true,
      joinedAt: true,
      lastSeenAt: true,
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true, accentColor: true },
      },
    },
  });

  if (!membership) notFound();

  const [tasks, projects, activity, closedCount] = await Promise.all([
    listItems({
      types: ["task"],
      statuses: OPEN_TASK_STATUSES,
      assigneeId: userId,
      orderBy: "priority",
    }),
    db.projectMember.findMany({
      where: { userId, project: { archivedAt: null } },
      select: {
        role: true,
        project: {
          select: { id: true, name: true, accent: true, progress: true, status: true },
        },
      },
      orderBy: { addedAt: "desc" },
    }),
    db.activity.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        verb: true,
        targetType: true,
        targetId: true,
        targetLabel: true,
        meta: true,
        createdAt: true,
        actor: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
        project: { select: { id: true, name: true, accent: true } },
        item: { select: { id: true, type: true, title: true, projectId: true } },
      },
    }),
    db.item.count({
      where: {
        type: "task",
        status: "done",
        assignments: { some: { userId } },
      },
    }),
  ]);

  const buckets = bucketTasks(sortByUrgency(tasks));
  const isMe = ctx.user ? userId === ctx.user.id : false;

  const groups = [
    { key: "blocked", title: "Bloqueadas", items: buckets.blocked },
    { key: "overdue", title: "Vencidas", items: buckets.overdue },
    { key: "today", title: "Para hoy", items: buckets.today },
    { key: "week", title: "Esta semana", items: buckets.week },
    { key: "later", title: "Más adelante", items: buckets.later },
    { key: "noDate", title: "Sin fecha", items: buckets.noDate },
  ].filter((group) => group.items.length > 0);

  return (
    <Page>
      <header className="mb-7 flex flex-wrap items-start gap-4">
        <Avatar person={membership.user} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {membership.user.name}
            {isMe && <span className="ml-2 text-xs font-normal text-ink-4">vos</span>}
          </h1>
          <p className="mt-0.5 text-sm text-ink-3">
            {membership.title ?? ROLE_LABEL[membership.role as WorkspaceRole]}
            <span className="text-ink-4"> · {membership.user.email}</span>
          </p>
          <p className="mt-1.5 text-2xs text-ink-4">
            En el equipo desde el {longDate(membership.joinedAt)} · última visita{" "}
            {relativeTime(membership.lastSeenAt)}
          </p>
        </div>

        <div className="flex gap-5 rounded-[var(--r-lg)] border border-line bg-surface px-4 py-3">
          <Figure value={tasks.length} label="Abiertas" />
          <Figure value={closedCount} label="Cerradas" tone="var(--tone-done)" />
          <Figure value={projects.length} label="Proyectos" />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_312px]">
        <div className="min-w-0 space-y-7">
          <SectionHeader title="En qué está trabajando" count={tasks.length} />

          {groups.length === 0 ? (
            <EmptyState
              compact
              title="Sin tareas abiertas"
              description={`${membership.user.name.split(" ")[0]} no tiene nada asignado por ahora.`}
            />
          ) : (
            groups.map((group) => (
              <section key={group.key}>
                <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
                  {group.title}
                </h3>
                <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
                  {group.items.map((task) => (
                    <ItemRow key={task.id} item={task} showProject />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className="min-w-0 space-y-7">
          <section>
            <SectionHeader title="Participa en" count={projects.length} />
            <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
              {projects.map(({ project, role }) => (
                <Link
                  key={project.id}
                  href={`/p/${project.id}`}
                  className="row hairline flex items-center gap-2.5 px-3 py-2.5"
                >
                  <span
                    className="size-2 shrink-0 rounded-[3px]"
                    style={{ background: accentHex(project.accent) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{project.name}</span>
                    <span className="text-2xs text-ink-4">
                      {role === "lead" ? "Responsable" : "Colabora"}
                    </span>
                  </span>
                  <span className="text-2xs tabular text-ink-4">{project.progress}%</span>
                </Link>
              ))}
              {projects.length === 0 && (
                <p className="px-3 py-3 text-xs text-ink-4">Sin proyectos asignados.</p>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="Últimos movimientos" />
            <div className="pl-0.5">
              {collapseNoise(activity)
                .slice(0, 12)
                .map((event) => (
                  <ActivityLine
                    key={event.id}
                    event={event}
                    currentUserId={ctx.user?.id ?? ""}
                  />
                ))}
              {activity.length === 0 && (
                <p className="text-xs text-ink-4">Sin movimientos registrados.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </Page>
  );
}

function Figure({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div>
      <div
        className="text-lg font-semibold tabular leading-none"
        style={{ color: tone ?? "var(--ink)" }}
      >
        {value}
      </div>
      <div className="mt-1 text-2xs text-ink-4">{label}</div>
    </div>
  );
}