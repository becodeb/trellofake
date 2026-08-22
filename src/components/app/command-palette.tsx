"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Archive,
  Compass,
  CornerDownLeft,
  FileText,
  Inbox,
  LayoutGrid,
  ListChecks,
  Search,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { accentHex } from "@/lib/domain";
import { relativeTime } from "@/lib/format";
import { quickSearch } from "@/server/actions/search";
import { SEARCH_KIND_LABEL, type SearchHit } from "@/lib/shared";
import { Avatar } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/overlays";

/**
 * Paleta de comandos.
 *
 * Es el atajo para no navegar: buscás cualquier cosa del workspace o saltás a
 * una sección. Se abre con ⌘K y busca a medida que escribís, con un respiro de
 * 160 ms para no disparar una consulta por tecla.
 */
export function CommandPalette({
  open,
  onOpenChange,
  slug,
  canManage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await quickSearch(slug, trimmed);
        if (!cancelled) setHits(results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 160);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, slug]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const places = [
    { href: `/w/${slug}`, label: "Hoy", icon: Compass },
    { href: `/w/${slug}/novedades`, label: "Novedades", icon: Inbox },
    { href: `/w/${slug}/mi-trabajo`, label: "Mi trabajo", icon: ListChecks },
    { href: `/w/${slug}/proyectos`, label: "Proyectos", icon: LayoutGrid },
    { href: `/w/${slug}/archivo`, label: "Archivo", icon: Archive },
    ...(canManage ? [{ href: `/w/${slug}/ajustes`, label: "Ajustes", icon: Settings }] : []),
  ];

  const searching = query.trim().length >= 2;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-[var(--overlay)] backdrop-blur-[2px] data-[state=open]:animate-fade" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[14vh] z-[81] w-[calc(100vw-2rem)] max-w-[560px] -translate-x-1/2",
            "overflow-hidden rounded-[var(--r-xl)] border border-line bg-surface shadow-[var(--shadow-lg)]",
            "data-[state=open]:animate-rise focus:outline-none",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Buscar</DialogPrimitive.Title>

          <Command shouldFilter={!searching} loop>
            <div className="flex items-center gap-2.5 border-b border-line-soft px-3.5">
              <Search className="size-4 shrink-0 text-ink-4" strokeWidth={2} />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                autoFocus
                placeholder="Buscar proyectos, tareas, notas, personas…"
                className="h-12 flex-1 bg-transparent text-md text-ink placeholder:text-ink-4 focus:outline-none"
              />
              {loading && (
                <span className="size-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-ink-4 border-t-transparent" />
              )}
            </div>

            <Command.List className="max-h-[min(58vh,420px)] overflow-y-auto overscroll-contain p-1.5">
              {searching && !loading && hits.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm text-ink-2">Nada con “{query}”</p>
                  <p className="mt-1 text-xs text-ink-4">
                    Probá con otra palabra, un nombre o parte de un título.
                  </p>
                </div>
              )}

              {!searching && (
                <Command.Group
                  heading="Ir a"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-ink-4"
                >
                  {places.map((place) => (
                    <Item key={place.href} onSelect={() => go(place.href)}>
                      <place.icon className="size-4 shrink-0 text-ink-3" strokeWidth={1.9} />
                      <span className="flex-1 truncate">{place.label}</span>
                    </Item>
                  ))}
                </Command.Group>
              )}

              {hits.map((hit) => (
                <Item key={`${hit.kind}-${hit.id}`} onSelect={() => go(hit.href)}>
                  {hit.kind === "person" && hit.person ? (
                    <Avatar person={hit.person} size="xs" />
                  ) : (
                    <span
                      className="grid size-5 shrink-0 place-items-center rounded-[var(--r-xs)]"
                      style={{ background: `${accentHex(hit.accent)}1f` }}
                    >
                      <KindMark kind={hit.kind} accent={hit.accent} />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{hit.title}</span>
                    {hit.excerpt && (
                      <span className="mt-0.5 block truncate text-2xs text-ink-4">
                        {hit.excerpt}
                      </span>
                    )}
                  </span>

                  <span className="ml-2 flex shrink-0 items-center gap-2 text-2xs text-ink-4">
                    {hit.projectName && (
                      <span className="max-w-[120px] truncate">{hit.projectName}</span>
                    )}
                    <span className="opacity-70">{SEARCH_KIND_LABEL[hit.kind]}</span>
                  </span>
                </Item>
              ))}

              {searching && hits.length > 0 && (
                <Item onSelect={() => go(`/w/${slug}/buscar?q=${encodeURIComponent(query)}`)}>
                  <FileText className="size-4 shrink-0 text-ink-3" strokeWidth={1.9} />
                  <span className="flex-1">Ver todos los resultados de “{query}”</span>
                </Item>
              )}
            </Command.List>

            <div className="flex items-center justify-between gap-3 border-t border-line-soft px-3 py-2 text-2xs text-ink-4">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                para moverte
              </span>
              <span className="flex items-center gap-1.5">
                <CornerDownLeft className="size-3" /> abrir
                <span className="mx-1 opacity-40">·</span>
                <Kbd>esc</Kbd> cerrar
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Item({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-[var(--r-md)] px-2 py-2 text-sm text-ink-2",
        "data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink",
      )}
    >
      {children}
    </Command.Item>
  );
}

/** Marca de tipo: una letra en el color del proyecto. Nada de íconos genéricos. */
function KindMark({ kind, accent }: { kind: string; accent: string }) {
  const letter =
    { task: "T", idea: "I", note: "N", problem: "!", decision: "D", update: "A", project: "◆", file: "▣", comment: "”" }[
      kind
    ] ?? "•";
  return (
    <span
      className="text-[10px] font-bold leading-none"
      style={{ color: accentHex(accent) }}
      aria-hidden
    >
      {letter}
    </span>
  );
}
