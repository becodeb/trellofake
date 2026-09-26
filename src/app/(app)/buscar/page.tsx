import Link from "next/link";
import { Search } from "lucide-react";

import { getTeamContext } from "@/server/auth/context";
import { search } from "@/server/domain/search";
import { SEARCH_KIND_LABEL, type SearchKind } from "@/lib/shared";
import { accentHex } from "@/lib/domain";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Page } from "@/components/app/shell";
import { SearchBox } from "@/components/app/search-box";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, PageHeader } from "@/components/ui/layout";

export const metadata = { title: "Buscar" };

const KIND_ORDER: SearchKind[] = [
  "project",
  "task",
  "problem",
  "decision",
  "idea",
  "note",
  "update",
  "comment",
  "resource",
  "file",
  "person",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  const { q = "", tipo } = await searchParams;
  await getTeamContext();

  const kind = tipo && KIND_ORDER.includes(tipo as SearchKind) ? (tipo as SearchKind) : null;

  const hits = q.trim().length >= 2
    ? await search(q, { limit: 80 })
    : [];

  const counts = new Map<SearchKind, number>();
  for (const hit of hits) counts.set(hit.kind, (counts.get(hit.kind) ?? 0) + 1);
  const shown = kind ? hits.filter((hit) => hit.kind === kind) : hits;

  return (
    <Page>
      <PageHeader
        title="Buscar"
        description="Proyectos, tareas, ideas, notas, problemas, decisiones, comentarios, recursos, archivos y personas."
      />

      <div className="max-w-2xl">
        <SearchBox initial={q} />

        {q.trim().length >= 2 && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Chip href={`/buscar?q=${encodeURIComponent(q)}`} active={!kind}>
                Todo <span className="tabular opacity-60">{hits.length}</span>
              </Chip>
              {KIND_ORDER.filter((k) => counts.has(k)).map((k) => (
                <Chip
                  key={k}
                  href={`/buscar?q=${encodeURIComponent(q)}&tipo=${k}`}
                  active={kind === k}
                >
                  {SEARCH_KIND_LABEL[k]}{" "}
                  <span className="tabular opacity-60">{counts.get(k)}</span>
                </Chip>
              ))}
            </div>

            {shown.length === 0 ? (
              <EmptyState
                className="mt-5"
                icon={<Search className="size-4" strokeWidth={1.8} />}
                title={`Nada con “${q}”`}
                description="Probá con otra palabra, el nombre de una persona o parte de un título."
              />
            ) : (
              <div className="mt-4 overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
                {shown.map((hit) => (
                  <Link
                    key={`${hit.kind}-${hit.id}`}
                    href={hit.href}
                    className="row hairline flex items-start gap-3 px-3.5 py-3"
                  >
                    {hit.kind === "person" && hit.person ? (
                      <Avatar person={hit.person} size="sm" />
                    ) : (
                      <span
                        className="mt-0.5 size-2 shrink-0 rounded-[3px]"
                        style={{ background: accentHex(hit.accent) }}
                      />
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {hit.title}
                      </span>
                      {hit.excerpt && (
                        <span className="mt-0.5 block text-xs leading-relaxed text-ink-3 clamp-2">
                          {hit.excerpt}
                        </span>
                      )}
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-ink-4">
                        <span>{SEARCH_KIND_LABEL[hit.kind]}</span>
                        {hit.projectName && (
                          <>
                            <span className="opacity-50">·</span>
                            <span>{hit.projectName}</span>
                          </>
                        )}
                        {hit.kind !== "person" && (
                          <>
                            <span className="opacity-50">·</span>
                            <span>{relativeTime(hit.when)}</span>
                          </>
                        )}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {q.trim().length > 0 && q.trim().length < 2 && (
          <p className="mt-4 text-xs text-ink-4">Escribí al menos dos letras.</p>
        )}
      </div>
    </Page>
  );
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