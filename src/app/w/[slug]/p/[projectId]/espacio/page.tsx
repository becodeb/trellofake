import Link from "next/link";
import { notFound } from "next/navigation";

import { requireWorkspace } from "@/server/auth/context";
import { getProject, subtreeIds } from "@/server/domain/projects";
import { listItems } from "@/server/domain/items";
import { ITEM_TYPE_META, type ItemType } from "@/lib/domain";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { InlineComposer } from "@/components/app/item-row";
import { ProgressGlyph } from "@/components/ui/glyphs";
import { EmptyState } from "@/components/ui/layout";

const KINDS: ItemType[] = ["idea", "note", "problem", "decision", "update"];

/**
 * Espacio del proyecto.
 *
 * Todo lo que no es una tarea pero el equipo necesita conservar: ideas que
 * todavía no son trabajo, notas, problemas, decisiones y los avances diarios.
 * Es la parte que evita que el contexto viva en un chat.
 */
export default async function ProjectSpace({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; projectId: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { slug, projectId } = await params;
  const { tipo } = await searchParams;
  const ctx = await requireWorkspace(slug);
  if (!ctx.can("content.write")) notFound();

  const project = await getProject(ctx.workspace.id, projectId, {
    role: ctx.role,
    userId: ctx.user.id,
  });
  if (!project) notFound();

  const ids = await subtreeIds(project.id, project.path);
  const active = KINDS.includes(tipo as ItemType) ? (tipo as ItemType) : null;

  const items = await listItems(ctx.workspace.id, {
    projectIds: ids,
    types: active ? [active] : KINDS,
    rootOnly: true,
    orderBy: "recent",
  });

  const counts = new Map<string, number>();
  const all = active
    ? await listItems(ctx.workspace.id, {
        projectIds: ids,
        types: KINDS,
        rootOnly: true,
        orderBy: "recent",
      })
    : items;
  for (const item of all) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);

  const base = `/w/${slug}/p/${projectId}/espacio`;
  const canWrite = ctx.can("content.write");

  return (
    <div className="max-w-3xl">
      <nav className="mb-4 flex flex-wrap items-center gap-1.5">
        <Chip href={base} active={!active}>
          Todo <span className="tabular opacity-60">{all.length}</span>
        </Chip>
        {KINDS.map((kind) => (
          <Chip key={kind} href={`${base}?tipo=${kind}`} active={active === kind}>
            {ITEM_TYPE_META[kind].plural}
            <span className="tabular opacity-60">{counts.get(kind) ?? 0}</span>
          </Chip>
        ))}
      </nav>

      {canWrite && (
        <div className="mb-4 overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
          <InlineComposer
            slug={slug}
            projectId={project.id}
            type={active ?? "note"}
            placeholder={
              active
                ? `${ITEM_TYPE_META[active].action}… ${ITEM_TYPE_META[active].hint.toLowerCase()}`
                : "Escribí una nota…"
            }
          />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title={active ? `Sin ${ITEM_TYPE_META[active].plural.toLowerCase()}` : "El espacio está vacío"}
          description={
            active
              ? ITEM_TYPE_META[active].hint + ". Escribí la primera arriba."
              : "Acá van las ideas, notas, problemas, decisiones y avances del proyecto: lo que no es una tarea pero conviene no perder."
          }
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const meta = ITEM_TYPE_META[item.type as ItemType];
            return (
              <Link
                key={item.id}
                href={`/w/${slug}/p/${projectId}?item=${item.id}`}
                className="block rounded-[var(--r-lg)] border border-line bg-surface p-3.5 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[var(--shadow-sm)]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xs font-medium uppercase tracking-[0.06em] text-ink-4">
                    {meta?.label}
                  </span>
                  {(item.type === "problem" || item.type === "idea") && (
                    <span className="inline-flex items-center gap-1.5 text-2xs text-ink-3">
                      <ProgressGlyph type={item.type} status={item.status} size={11} />
                      {statusText(item.type, item.status)}
                    </span>
                  )}
                  <span className="ml-auto text-2xs text-ink-4">
                    {relativeTime(item.createdAt)}
                  </span>
                </div>

                <h3 className="mt-1.5 text-md font-medium leading-snug text-ink">
                  {item.title}
                </h3>

                {item.body && (
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-3 clamp-3">
                    {item.body}
                  </p>
                )}

                <div className="mt-2.5 flex items-center gap-2 text-2xs text-ink-4">
                  <Avatar person={item.createdBy} size="xs" />
                  <span>{item.createdBy.name.split(" ")[0]}</span>
                  {item.projectId !== project.id && (
                    <>
                      <span className="opacity-50">·</span>
                      <span>{item.project.name}</span>
                    </>
                  )}
                  {item._count.comments > 0 && (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="tabular">
                        {item._count.comments} comentario
                        {item._count.comments > 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                  {item._count.attachments > 0 && (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="tabular">{item._count.attachments} archivo(s)</span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function statusText(type: string, status: string) {
  const labels: Record<string, string> = {
    open: "Abierto",
    investigating: "En análisis",
    resolved: "Resuelto",
    proposed: "Propuesta",
    accepted: "Aceptada",
    converted: "Convertida",
    discarded: "Descartada",
  };
  return labels[status] ?? status;
}

function Chip({
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-accent-line bg-accent-wash font-medium text-accent-ink"
          : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
