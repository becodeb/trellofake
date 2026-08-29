"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Plus, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { LINK_KIND_LABEL, normalizeUrl, prettyUrl, type LinkKind } from "@/lib/links";
import { addLink, removeLink } from "@/server/actions/projects";
import { Input } from "@/components/ui/field";
import { RowAction } from "@/components/ui/button";

export type ResourceLinkData = {
  id: string;
  label: string;
  url: string;
  kind: string;
};

/**
 * Recursos del proyecto.
 *
 * Un campo, una URL. El tipo se deduce del dominio (GitHub, Figma, Drive…) y
 * el nombre se propone solo, porque nadie quiere completar tres campos para
 * guardar un link.
 */
export function ResourceLinks({
  projectId,
  links,
  canWrite,
}: {
  projectId: string;
  links: ResourceLinkData[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const submit = async () => {
    const url = normalizeUrl(value);
    if (!url || pending) return;

    setPending(true);
    const result = await addLink(projectId, { url });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setValue("");
    router.refresh();
  };

  return (
    <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
      {links.length === 0 && !canWrite && (
        <p className="px-3 py-3 text-xs text-ink-4">Sin recursos cargados.</p>
      )}

      {links.map((link) => (
        <div key={link.id} className="row hairline group flex items-center gap-2.5 px-3 py-2">
          <KindBadge kind={link.kind} />
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1"
            title={link.url}
          >
            <span className="block truncate text-sm text-ink">{link.label}</span>
            <span className="block truncate text-2xs text-ink-4">{prettyUrl(link.url)}</span>
          </a>

          <ExternalLink
            className="size-3 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100"
            strokeWidth={2}
          />

          {canWrite && (
            <RowAction
              aria-label="Quitar recurso"
              onClick={async () => {
                const result = await removeLink(projectId, link.id);
                if (!result.ok) toast.error(result.error);
                else router.refresh();
              }}
            >
              <X className="size-3.5" strokeWidth={2} />
            </RowAction>
          )}
        </div>
      ))}

      {canWrite && (
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-2",
            links.length > 0 && "border-t border-line-soft",
          )}
        >
          <Plus className="ml-1 size-3 shrink-0 text-ink-4" strokeWidth={2.4} />
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            onBlur={() => value.trim() && submit()}
            disabled={pending}
            placeholder="Pegá un link…"
            className="h-7 border-0 bg-transparent px-0 text-sm focus:shadow-none"
          />
        </div>
      )}
    </div>
  );
}

/** Etiqueta corta del tipo de recurso, en el color de la tinta secundaria. */
function KindBadge({ kind }: { kind: string }) {
  const label = LINK_KIND_LABEL[kind as LinkKind] ?? "Link";
  return (
    <span className="w-[74px] shrink-0 truncate text-2xs uppercase tracking-[0.06em] text-ink-4">
      {label}
    </span>
  );
}
