"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ExternalLink,
  GitBranch,
  Globe,
  Plus,
  Terminal,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { prettyUrl, normalizeUrl } from "@/lib/resources";
import { addLink } from "@/server/actions/projects";
import { Input } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/glyphs";
import type { ProjectDetail } from "@/server/domain/projects";

type LinkLike = { id: string; url: string; kind: string; label: string };

/**
 * Franja bajo el encabezado del proyecto.
 *
 * Lo que hoy se escondía en un sidebar chico: el sitio y el repo a un click,
 * y de un vistazo cuánto falta. Reemplaza la lista de "Enlaces del proyecto"
 * del resumen — si el proyecto no tiene todavía un sitio, repo o entorno
 * local cargado, queda solo el botón para agregarlo.
 */
export function ProjectOverviewBand({
  project,
  canWrite,
}: {
  project: ProjectDetail;
  canWrite: boolean;
}) {
  const links = project.links as LinkLike[];
  const site = links.find((l) => l.kind === "site");
  const repository = links.find((l) => l.kind === "repository");
  const locals = links.filter((l) => l.kind === "local");
  const rollup = project.subtreeRollup;

  const hasChips = Boolean(site || repository || locals.length > 0);

  return (
    <div className="rounded-[var(--r-lg)] border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        {site && (
          <LinkChip href={site.url} icon={Globe} label="Abrir sitio" detail={prettyUrl(site.url)} />
        )}
        {repository && (
          <LinkChip href={repository.url} icon={GitBranch} label="Repositorio" detail={prettyUrl(repository.url)} />
        )}
        {locals.map((local) => (
          <LinkChip key={local.id} href={local.url} icon={Terminal} label="Local" detail={prettyUrl(local.url)} />
        ))}

        {canWrite && <AddLinkAffordance projectId={project.id} compact={hasChips} />}

        {!hasChips && !canWrite && (
          <p className="text-xs text-ink-4">Sin sitio, repositorio ni entorno cargado todavía.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="min-w-[140px] flex-1">
          <ProgressBar value={project.progress} tone={project.progress === 100 ? "done" : "progress"} />
        </div>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-4">
          <Counter label="Abiertas" value={rollup.open} />
          <Counter label="En curso" value={rollup.inProgress} />
          <Counter label="Frenadas" value={rollup.blocked} tone={rollup.blocked > 0 ? "var(--tone-blocked)" : undefined} />
          <Counter label="Hechas" value={rollup.done} />
          <Counter label="Vencidas" value={rollup.overdue} tone={rollup.overdue > 0 ? "var(--tone-blocked)" : undefined} />
        </dl>
      </div>
    </div>
  );
}

function LinkChip({
  href,
  icon: Icon,
  label,
  detail,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  detail: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
      title={href}
    >
      <Icon className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.9} />
      <span className="font-medium">{label}</span>
      <span className="max-w-[160px] truncate text-ink-4">{detail}</span>
      <ExternalLink className="size-3 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
    </a>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  if (value === 0 && label !== "Abiertas") return null;
  return (
    <div className="flex items-baseline gap-1">
      <span className="tabular font-medium" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
      <span>{label}</span>
    </div>
  );
}

/** "Agregar enlace": un botón que se abre en un campo, sin ir hasta Recursos. */
function AddLinkAffordance({ projectId, compact }: { projectId: string; compact: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
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
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 py-1.5 text-xs text-ink-3 transition-colors hover:text-ink",
          !compact && "border-line",
        )}
      >
        <Plus className="size-3.5" strokeWidth={2.2} />
        Agregar enlace
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape") setOpen(false);
        }}
        onBlur={() => (value.trim() ? submit() : setOpen(false))}
        disabled={pending}
        placeholder="Pegá el sitio, el repo o una IP local…"
        className="h-8 w-64"
      />
    </div>
  );
}
