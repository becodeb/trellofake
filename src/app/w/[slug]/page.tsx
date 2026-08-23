import Link from "next/link";
import { ArrowRight, BookOpen, Lightbulb, Plus, TriangleAlert } from "lucide-react";

import { requireWorkspace } from "@/server/auth/context";
import { listProjects } from "@/server/domain/projects";
import { myTasks } from "@/server/domain/items";
import {
  blockedWork,
  recentDecisions,
  recentUpdates,
  workspaceStats,
} from "@/server/domain/dashboard";
import { feedCounts, personalFeed } from "@/server/domain/feed";
import { db } from "@/server/db";
import { accentHex } from "@/lib/domain";
import { firstName, longDate, relativeTime } from "@/lib/format";
import { Page } from "@/components/app/shell";
import { ProjectCard } from "@/components/app/project-card";
import { ItemRow } from "@/components/app/item-row";
import { NewsStrip } from "@/components/app/news-strip";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionHeader } from "@/components/ui/layout";

export const metadata = { title: "Hoy" };

/**
 * Hoy.
 *
 * La pregunta que contesta esta pantalla es "¿qué está pasando?", y tiene que
 * contestarla en el tiempo que dura una mirada. Por eso el orden es: qué
 * cambió desde que no estás, cómo viene el equipo en números, en qué está
 * trabajando, qué te toca a vos y qué está frenado.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const ws = ctx.workspace.id;

  if (!ctx.can("content.write")) {
    return <CommunityHome slug={slug} ctx={ctx} />;
  }

  const [stats, projects, tasks, blocked, decisions, updates, counts, feed] =
    await Promise.all([
      workspaceStats(ws),
      listProjects(ws, {
        statuses: ["active"],
        archived: false,
        parentId: null,
        viewer: { role: ctx.role, userId: ctx.user.id },
      }),
      myTasks(ws, ctx.user.id, { take: 30 }),
      blockedWork(ws, 4),
      recentDecisions(ws, 3),
      recentUpdates(ws, 3),
      feedCounts(ws, ctx.user.id, ctx.lastSeenAt),
      personalFeed(ws, ctx.user.id, { take: 4, unreadOnly: true }),
    ]);

  const hour = new Date().getHours();
  const greeting = hour < 6 ? "Buenas noches" : hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  const blockedTotal = blocked.tasks.length + blocked.problems.length;

  return (
    <Page width="wide">
      <header className="mb-6">
        <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-4">
          {longDate(new Date())}
        </p>
        <h1 className="mt-1.5 font-display text-3xl leading-none text-ink">
          {greeting}, {firstName(ctx.user.name)}
        </h1>
        <p className="mt-2 text-sm text-ink-3">
          {summarize(stats.activeProjects, tasks.length, blockedTotal)}
        </p>
      </header>

      {counts.unread > 0 && (
        <NewsStrip
          slug={slug}
          events={feed}
          unread={counts.unread}
          direct={counts.direct}
          currentUserId={ctx.user.id}
          className="mb-6"
        />
      )}

      {/* Números: una fila, sin tarjetas, separados por hairlines. */}
      <section className="mb-8 grid grid-cols-2 divide-x divide-line-soft rounded-[var(--r-lg)] border border-line bg-surface sm:grid-cols-3 lg:grid-cols-6">
        <Figure value={stats.activeProjects} label="Proyectos activos" href={`/w/${slug}/proyectos`} />
        <Figure value={stats.openTasks} label="Tareas abiertas" />
        <Figure value={stats.inProgressTasks} label="En curso" tone="var(--tone-progress)" />
        <Figure
          value={stats.overdueTasks}
          label="Vencidas"
          tone={stats.overdueTasks > 0 ? "var(--tone-blocked)" : undefined}
        />
        <Figure value={stats.completedThisWeek} label="Cerradas esta semana" tone="var(--tone-done)" />
        <Figure value={`${stats.overallProgress}%`} label="Progreso general" />
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_356px]">
        <div className="min-w-0 space-y-8">
          <section>
            <SectionHeader
              title="En qué está trabajando el equipo"
              count={projects.length}
              action={
                <Link
                  href={`/w/${slug}/proyectos`}
                  className="inline-flex items-center gap-1 text-xs text-ink-3 transition-colors hover:text-ink"
                >
                  Ver todos <ArrowRight className="size-3" strokeWidth={2} />
                </Link>
              }
            />

            {projects.length === 0 ? (
              <EmptyState
                title="Todavía no hay proyectos activos"
                description="Un proyecto es el lugar donde viven las tareas, las decisiones y los archivos de un frente de trabajo."
                action={
                  <Button variant="primary" size="sm" asChild>
                    <Link href={`/w/${slug}/proyectos?nuevo=1`}>
                      <Plus className="size-3.5" strokeWidth={2.4} />
                      Crear el primero
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} slug={slug} />
                ))}
              </div>
            )}
          </section>

          {blockedTotal > 0 && (
            <section>
              <SectionHeader
                title="Lo que está frenado"
                count={blockedTotal}
                action={
                  <span className="inline-flex items-center gap-1.5 text-2xs text-ink-4">
                    <TriangleAlert
                      className="size-3"
                      strokeWidth={2.2}
                      style={{ color: "var(--tone-blocked)" }}
                    />
                    Necesita una decisión
                  </span>
                }
              />
              <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
                {[...blocked.tasks, ...blocked.problems].map((item) => (
                  <ItemRow key={item.id} item={item} slug={slug} showProject />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-8">
          <section>
            <SectionHeader
              title="Tu trabajo"
              count={tasks.length}
              action={
                tasks.length > 6 ? (
                  <Link
                    href={`/w/${slug}/mi-trabajo`}
                    className="text-xs text-ink-3 transition-colors hover:text-ink"
                  >
                    Ver todo
                  </Link>
                ) : null
              }
            />
            {tasks.length === 0 ? (
              <EmptyState
                compact
                title="No tenés nada asignado"
                description="Cuando alguien te asigne una tarea vas a verla acá."
              />
            ) : (
              <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
                {tasks.slice(0, 6).map((task) => (
                  <ItemRow key={task.id} item={task} slug={slug} showProject compact />
                ))}
              </div>
            )}
          </section>

          {updates.length > 0 && (
            <section>
              <SectionHeader title="Últimos avances" />
              <div className="space-y-2.5">
                {updates.map((update) => (
                  <Link
                    key={update.id}
                    href={`/w/${slug}/p/${update.projectId}?item=${update.id}`}
                    className="block rounded-[var(--r-lg)] border border-line bg-surface p-3 transition-colors hover:border-line-strong"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar person={update.createdBy} size="xs" />
                      <span className="text-2xs text-ink-4">
                        {firstName(update.createdBy.name)} · {relativeTime(update.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium leading-snug text-ink">
                      {update.title}
                    </p>
                    {update.body && (
                      <p className="mt-1 text-xs leading-relaxed text-ink-3 clamp-2">
                        {update.body}
                      </p>
                    )}
                    <p className="mt-2 flex items-center gap-1.5 text-2xs text-ink-4">
                      <span
                        className="size-1.5 rounded-[2px]"
                        style={{ background: accentHex(update.project.accent) }}
                      />
                      {update.project.name}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {decisions.length > 0 && (
            <section>
              <SectionHeader title="Decisiones que tomamos" />
              <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
                {decisions.map((decision) => (
                  <Link
                    key={decision.id}
                    href={`/w/${slug}/p/${decision.projectId}?item=${decision.id}`}
                    className="row hairline block px-3 py-2.5"
                  >
                    <p className="text-sm font-medium leading-snug text-ink">
                      {decision.title}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-2xs text-ink-4">
                      <span
                        className="size-1.5 rounded-[2px]"
                        style={{ background: accentHex(decision.project.accent) }}
                      />
                      {decision.project.name}
                      <span className="opacity-50">·</span>
                      {relativeTime(decision.createdAt)}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Page>
  );
}

async function CommunityHome({
  slug,
  ctx,
}: {
  slug: string;
  ctx: Awaited<ReturnType<typeof requireWorkspace>>;
}) {
  const viewer = { role: ctx.role, userId: ctx.user.id };
  const [projects, proposalCount, latestProposals, resourceCount] = await Promise.all([
    listProjects(ctx.workspace.id, {
      statuses: ["active", "paused"],
      archived: false,
      parentId: null,
      viewer,
    }),
    db.proposal.count({ where: { workspaceId: ctx.workspace.id } }),
    db.proposal.findMany({
      where: { workspaceId: ctx.workspace.id },
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    db.knowledgeResource.count({
      where: { workspaceId: ctx.workspace.id, visibility: "community" },
    }),
  ]);

  return (
    <Page width="wide">
      <header className="mb-7 max-w-3xl">
        <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-4">
          Comunidad · {ctx.workspace.name}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-[1.05] text-ink">
          Lo que estamos construyendo, a la vista de todos.
        </h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ink-3">
          Seguí el estado de los proyectos de la red, acercá una necesidad y dejá contexto
          para que el equipo de desarrollo pueda convertirla en trabajo concreto.
        </p>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <Link href={`/w/${slug}/ideas`} className="group rounded-[var(--r-lg)] border border-line bg-accent-wash p-4 transition-colors hover:border-accent-line">
          <Lightbulb className="size-5 text-accent-ink" strokeWidth={1.8} />
          <p className="mt-3 text-base font-semibold text-ink">Proponer o conversar una idea</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">{proposalCount} propuestas compartidas. Las ideas aceptadas se vinculan o se convierten en proyectos.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-ink">Ir al buzón <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
        <Link href={`/w/${slug}/recursos`} className="group rounded-[var(--r-lg)] border border-line bg-surface p-4 transition-colors hover:border-line-strong">
          <BookOpen className="size-5 text-ink-3" strokeWidth={1.8} />
          <p className="mt-3 text-base font-semibold text-ink">Reutilizar recursos de la red</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">{resourceCount} recursos con enlaces e instrucciones de acceso para evitar empezar de cero.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-2">Abrir biblioteca <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <SectionHeader title="Proyectos visibles" count={projects.length} />
          {projects.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((project) => <ProjectCard key={project.id} project={project} slug={slug} />)}
            </div>
          ) : (
            <EmptyState compact title="No hay proyectos publicados" description="El equipo define qué proyectos comparte con la comunidad." />
          )}
        </section>
        <section>
          <SectionHeader title="Ideas recientes" />
          <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
            {latestProposals.map((proposal) => (
              <Link key={proposal.id} href={`/w/${slug}/ideas`} className="row hairline block px-3 py-2.5">
                <p className="text-sm font-medium text-ink">{proposal.title}</p>
                <p className="mt-1 text-2xs text-ink-4">{relativeTime(proposal.createdAt)}</p>
              </Link>
            ))}
            {latestProposals.length === 0 && <p className="px-3 py-4 text-xs text-ink-4">Todavía no hay propuestas.</p>}
          </div>
        </section>
      </div>
    </Page>
  );
}

function Figure({
  value,
  label,
  tone,
  href,
}: {
  value: React.ReactNode;
  label: string;
  tone?: string;
  href?: string;
}) {
  const body = (
    <>
      <div
        className="text-xl font-semibold tabular leading-none tracking-tight"
        style={{ color: tone ?? "var(--ink)" }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-2xs leading-tight text-ink-3">{label}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="px-3.5 py-3 transition-colors hover:bg-surface-2">
        {body}
      </Link>
    );
  }
  return <div className="px-3.5 py-3">{body}</div>;
}

/** Una frase que resume el estado. Es lo primero que se lee. */
function summarize(projects: number, tasks: number, blocked: number): string {
  const parts: string[] = [];

  parts.push(
    projects === 0
      ? "Sin proyectos activos"
      : projects === 1
        ? "Un proyecto activo"
        : `${projects} proyectos activos`,
  );

  if (tasks > 0) {
    parts.push(tasks === 1 ? "una tarea tuya abierta" : `${tasks} tareas tuyas abiertas`);
  }

  if (blocked > 0) {
    parts.push(blocked === 1 ? "y algo frenado esperando" : `y ${blocked} cosas frenadas esperando`);
  }

  return `${parts.join(", ").replace(/, y /, " y ")}.`;
}
