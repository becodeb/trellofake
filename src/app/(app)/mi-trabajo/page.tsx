import Link from "next/link";
import { ListChecks } from "lucide-react";

import { requireMember } from "@/server/auth/context";
import { bucketTasks, myTasks, type ItemRow as ItemRowData } from "@/server/domain/items";
import { cn } from "@/lib/cn";
import { Page } from "@/components/app/shell";
import { ItemRow } from "@/components/app/item-row";
import { EmptyState, PageHeader } from "@/components/ui/layout";

export const metadata = { title: "Mi trabajo" };

/**
 * Mi trabajo.
 *
 * Agrupado por urgencia y no por proyecto: cuando alguien abre esta pantalla
 * la pregunta es "¿qué hago ahora?", y esa respuesta cruza los proyectos.
 */
export default async function MyWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ cerradas?: string }>;
}) {
  const { cerradas } = await searchParams;
  const ctx = await requireMember();

  const includeDone = cerradas === "1";
  const tasks = await myTasks(ctx.user.id, { includeDone });
  const open = tasks.filter((t) => t.status !== "done");
  const buckets = bucketTasks(open);
  const done = tasks.filter((t) => t.status === "done");

  const groups: Array<{ key: string; title: string; tone?: string; items: ItemRowData[] }> = [
    { key: "blocked", title: "Bloqueadas", tone: "var(--tone-blocked)", items: buckets.blocked },
    { key: "overdue", title: "Vencidas", tone: "var(--tone-blocked)", items: buckets.overdue },
    { key: "today", title: "Para hoy", tone: "var(--tone-progress)", items: buckets.today },
    { key: "week", title: "Esta semana", items: buckets.week },
    { key: "later", title: "Más adelante", items: buckets.later },
    { key: "noDate", title: "Sin fecha", items: buckets.noDate },
  ].filter((group) => group.items.length > 0);

  return (
    <Page>
      <PageHeader
        eyebrow={`${open.length} abiertas`}
        title="Mi trabajo"
        description="Tus tareas y las del equipo en las que participás, ordenadas por urgencia."
        actions={
          <Link
            href={`/mi-trabajo${includeDone ? "" : "?cerradas=1"}`}
            className="text-xs text-ink-3 transition-colors hover:text-ink"
          >
            {includeDone ? "Ocultar completadas" : "Ver completadas"}
          </Link>
        }
      />

      {open.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-4" strokeWidth={1.8} />}
          title="No tenés nada pendiente"
          description="Cuando alguien te asigne una tarea, o se cree una para todo el equipo, la vas a ver acá."
        />
      ) : (
        <div className="max-w-3xl space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.07em]">
                <span style={{ color: group.tone ?? "var(--ink-3)" }}>{group.title}</span>
                <span className="text-2xs font-medium tabular text-ink-4">
                  {group.items.length}
                </span>
              </h2>
              <div
                className={cn(
                  "overflow-hidden rounded-[var(--r-lg)] border bg-surface",
                  group.tone ? "border-[var(--tone-blocked)]/25" : "border-line",
                )}
              >
                {group.items.map((task) => (
                  <ItemRow key={task.id} item={task} showProject />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {includeDone && done.length > 0 && (
        <section className="mt-8 max-w-3xl">
          <h2 className="mb-2 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.07em] text-ink-3">
            Completadas
            <span className="text-2xs font-medium tabular text-ink-4">{done.length}</span>
          </h2>
          <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
            {done.map((task) => (
              <ItemRow key={task.id} item={task} showProject compact />
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}