import Link from "next/link";
import { Inbox } from "lucide-react";

import { requireWorkspace } from "@/server/auth/context";
import { feedCounts, personalFeed, workspaceFeed } from "@/server/domain/feed";
import { collapseNoise } from "@/lib/shared";
import { FEED_REASON_LABEL, type FeedReason } from "@/lib/domain";
import { cn } from "@/lib/cn";
import { Page } from "@/components/app/shell";
import { ActivityTimeline } from "@/components/app/activity";
import { MarkAllRead } from "@/components/app/mark-all-read";
import { EmptyState, PageHeader } from "@/components/ui/layout";

export const metadata = { title: "Novedades" };

/**
 * Novedades.
 *
 * Dos lecturas de lo mismo. "Para vos" trae únicamente lo que te involucra
 * —te asignaron, te mencionaron, se movió algo en un proyecto tuyo— y es lo
 * que se abre por defecto. "Todo el equipo" es el registro completo, para
 * cuando querés enterarte de lo que no te tocaba.
 */
export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ vista?: string; filtro?: string }>;
}) {
  const { slug } = await params;
  const { vista, filtro } = await searchParams;
  const ctx = await requireWorkspace(slug);

  const teamView = vista === "equipo";
  const onlyUnread = filtro === "sin-leer";

  const [mine, team, counts] = await Promise.all([
    personalFeed(ctx.workspace.id, ctx.user.id, {
      take: 80,
      unreadOnly: onlyUnread,
    }),
    teamView ? workspaceFeed(ctx.workspace.id, { take: 120 }) : Promise.resolve([]),
    feedCounts(ctx.workspace.id, ctx.user.id, ctx.lastSeenAt),
  ]);

  const events = collapseNoise(teamView ? team : mine);

  return (
    <Page>
      <PageHeader
        title="Novedades"
        description={
          teamView
            ? "Todo lo que pasó en el workspace, en orden."
            : "Lo que te involucra: asignaciones, menciones y movimiento en tus proyectos."
        }
        actions={counts.unread > 0 ? <MarkAllRead slug={slug} count={counts.unread} /> : null}
      />

      <nav className="mb-5 flex flex-wrap items-center gap-1 border-b border-line pb-px">
        <Tab href={`/w/${slug}/novedades`} active={!teamView && !onlyUnread}>
          Para vos
        </Tab>
        <Tab
          href={`/w/${slug}/novedades?filtro=sin-leer`}
          active={!teamView && onlyUnread}
          badge={counts.unread}
        >
          Sin leer
        </Tab>
        <Tab href={`/w/${slug}/novedades?vista=equipo`} active={teamView}>
          Todo el equipo
        </Tab>
      </nav>

      {events.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-4" strokeWidth={1.8} />}
          title={onlyUnread ? "Estás al día" : "Todavía no pasó nada"}
          description={
            onlyUnread
              ? "No quedan novedades sin leer. Cuando alguien mueva algo tuyo, aparece acá."
              : "Cuando el equipo empiece a trabajar, cada movimiento importante va a quedar registrado en esta página."
          }
        />
      ) : (
        <div className="max-w-2xl">
          {!teamView && <ReasonLegend events={mine} />}
          <ActivityTimeline
            events={events}
            slug={slug}
            currentUserId={ctx.user.id}
          />
        </div>
      )}
    </Page>
  );
}

function Tab({
  href,
  active,
  badge,
  children,
}: {
  href: string;
  active: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
        active
          ? "border-accent font-medium text-ink"
          : "border-transparent text-ink-3 hover:text-ink",
      )}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold tabular",
            active ? "bg-accent text-on-accent" : "bg-surface-3 text-ink-3",
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

/** Resumen de por qué te llegó cada cosa. Explica el filtro sin un manual. */
function ReasonLegend({ events }: { events: Array<{ reason?: string }> }) {
  const counts = new Map<FeedReason, number>();
  for (const event of events) {
    if (!event.reason) continue;
    const reason = event.reason as FeedReason;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const order: FeedReason[] = ["mentioned", "assigned", "reply", "author", "participant"];

  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-4">
      {order
        .filter((reason) => counts.has(reason))
        .map((reason) => (
          <span key={reason}>
            {FEED_REASON_LABEL[reason]}
            <span className="ml-1 tabular opacity-70">{counts.get(reason)}</span>
          </span>
        ))}
    </p>
  );
}
