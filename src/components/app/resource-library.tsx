"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  Braces,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Figma,
  GitBranch,
  Link2,
  Plus,
  Server,
  Trash2,
} from "lucide-react";

import {
  RESOURCE_KINDS,
  RESOURCE_KIND_LABEL,
  type ResourceKind,
} from "@/lib/domain";
import { createResource, deleteResource } from "@/server/actions/resources";
import { Button } from "@/components/ui/button";
import { AutoTextarea, Field, Input } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";

export type KnowledgeResourceData = {
  id: string;
  name: string;
  summary: string | null;
  kind: string;
  url: string | null;
  accessGuide: string | null;
  markdown: string | null;
  markdownUrl: string | null;
  resolvedMarkdown: string | null;
  project: { id: string; name: string } | null;
  addedBy: { name: string };
};

type ProjectOption = { id: string; name: string };

export function ResourceLibrary({
  resources,
  projects,
  canManage,
  defaultProjectId,
}: {
  resources: KnowledgeResourceData[];
  projects: ProjectOption[];
  canManage: boolean;
  defaultProjectId?: string;
}) {
  const [creating, setCreating] = React.useState(false);

  return (
    <>
      {canManage && (
        <div className="mb-5 flex justify-end">
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" strokeWidth={2.4} />
            Agregar recurso
          </Button>
        </div>
      )}

      {resources.length === 0 ? (
        <div className="grid-paper rounded-[var(--r-lg)] border border-dashed border-line px-6 py-14 text-center">
          <BookOpen className="mx-auto size-6 text-ink-4" strokeWidth={1.6} />
          <p className="mt-3 font-display text-xl text-ink">No hay recursos compartidos</p>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-xs leading-relaxed text-ink-3">
            Guardá bases de datos, diseños, servicios o guías de API con el contexto necesario
            para que otra persona pueda usarlos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      <ResourceDialog
        projects={projects}
        defaultProjectId={defaultProjectId}
        open={creating}
        onOpenChange={setCreating}
      />
    </>
  );
}

function ResourceCard({
  resource,
  canManage,
}: {
  resource: KnowledgeResourceData;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const Icon = iconFor(resource.kind);
  const guide = resource.resolvedMarkdown ?? resource.markdown;

  return (
    <article className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
      <div className="flex items-start gap-3 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-[var(--r-md)] bg-surface-2 text-ink-3">
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-sm font-semibold text-ink">{resource.name}</h2>
            <span className="text-2xs text-ink-4">
              {RESOURCE_KIND_LABEL[resource.kind as ResourceKind] ?? resource.kind}
            </span>
          </div>
          {resource.summary && <p className="mt-1 text-sm leading-relaxed text-ink-3">{resource.summary}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {resource.project && (
              <Link href={`/p/${resource.project.id}`} className="text-accent-ink hover:underline">
                {resource.project.name}
              </Link>
            )}
            {resource.url && (
              <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
                Abrir recurso <ExternalLink className="size-3" strokeWidth={2} />
              </a>
            )}
            {(resource.accessGuide || guide) && (
              <button onClick={() => setOpen((value) => !value)} className="text-ink-3 hover:text-ink">
                {open ? "Ocultar instrucciones" : "Ver cómo usarlo"}
              </button>
            )}
          </div>
        </div>
        {canManage && (
          <button
            aria-label="Eliminar recurso"
            className="grid size-7 place-items-center rounded-[var(--r-sm)] text-ink-4 transition-colors hover:bg-surface-2 hover:text-[var(--tone-blocked)]"
            onClick={async () => {
              const result = await deleteResource(resource.id);
              if (!result.ok) toast.error(result.error);
              else router.refresh();
            }}
          >
            <Trash2 className="size-3.5" strokeWidth={1.9} />
          </button>
        )}
      </div>

      {open && (resource.accessGuide || guide) && (
        <div className="border-t border-line-soft bg-paper/50 p-4">
          {resource.accessGuide && (
            <div className="mb-4">
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.07em] text-ink-4">Acceso</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{resource.accessGuide}</p>
            </div>
          )}
          {guide && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-2xs font-semibold uppercase tracking-[0.07em] text-ink-4">Guía de integración</p>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => {
                    void navigator.clipboard.writeText(guide);
                    toast.success("Markdown copiado");
                  }}
                >
                  <Copy className="size-3" strokeWidth={2} />
                  Copiar para la IA
                </Button>
              </div>
              <SimpleMarkdown source={guide} />
              {resource.markdownUrl && (
                <a href={resource.markdownUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-2xs text-ink-4 hover:text-ink">
                  Fuente en GitHub <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function ResourceDialog({
  projects,
  defaultProjectId,
  open,
  onOpenChange,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [kind, setKind] = React.useState<ResourceKind>(defaultProjectId ? "api" : "link");
  const [url, setUrl] = React.useState("");
  const [accessGuide, setAccessGuide] = React.useState("");
  const [markdown, setMarkdown] = React.useState("");
  const [markdownUrl, setMarkdownUrl] = React.useState("");
  const [projectId, setProjectId] = React.useState(defaultProjectId ?? "");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setSummary("");
    setKind(defaultProjectId ? "api" : "link");
    setUrl("");
    setAccessGuide("");
    setMarkdown("");
    setMarkdownUrl("");
    setProjectId(defaultProjectId ?? "");
  }, [open, defaultProjectId]);

  const submit = async () => {
    setPending(true);
    const result = await createResource({
      name,
      summary,
      kind,
      url: url || undefined,
      accessGuide: accessGuide || undefined,
      markdown: markdown || undefined,
      markdownUrl: markdownUrl || undefined,
      projectId: projectId || undefined,
    });
    setPending(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Recurso compartido");
      onOpenChange(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Agregar recurso" description="Dejá suficiente contexto para que otra persona pueda usarlo sin preguntarte por otro medio." width="lg">
        <div className="max-h-[68dvh] space-y-3.5 overflow-y-auto px-5 pb-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre"><Input value={name} onChange={(event) => setName(event.target.value)} autoFocus placeholder="Base de empleados" /></Field>
            <Field label="Tipo">
              <select value={kind} onChange={(event) => setKind(event.target.value as ResourceKind)} className="h-8.5 w-full rounded-[var(--r-md)] border border-line bg-surface px-2.5 text-sm">
                {RESOURCE_KINDS.map((option) => <option key={option} value={option}>{RESOURCE_KIND_LABEL[option]}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Qué contiene"><Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Listado institucional de personal, áreas y cargos." /></Field>
          <Field label="Enlace" hint="Página, repositorio, panel o documentación."><Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></Field>
          <Field label="Cómo se accede" hint="Indicá a quién pedir permiso o qué cuenta usar. No guardes contraseñas ni tokens acá.">
            <AutoTextarea value={accessGuide} onChange={(event) => setAccessGuide(event.target.value)} minRows={3} placeholder="Solicitar acceso al área de Sistemas; la vista disponible es solo lectura." />
          </Field>
          {(kind === "api" || defaultProjectId) && (
            <div className="space-y-3 rounded-[var(--r-md)] border border-line bg-surface-2 p-3">
              <div><p className="text-xs font-medium text-ink">Guía para conectar otra aplicación</p><p className="mt-0.5 text-2xs text-ink-4">Pegá el Markdown o enlazá un archivo de GitHub. Al abrirlo se actualiza automáticamente y se puede copiar para una IA.</p></div>
              <Field label="Archivo Markdown en GitHub"><Input type="url" value={markdownUrl} onChange={(event) => setMarkdownUrl(event.target.value)} placeholder="https://github.com/organizacion/repo/blob/main/API.md" /></Field>
              <Field label="O pegá el Markdown"><AutoTextarea value={markdown} onChange={(event) => setMarkdown(event.target.value)} minRows={6} placeholder={"# Consumir la API\n\n```http\nGET /api/tickets\n```"} /></Field>
            </div>
          )}
          <Field label="Proyecto" hint="Vacío = recurso de toda la red.">
            <select value={projectId} disabled={Boolean(defaultProjectId)} onChange={(event) => setProjectId(event.target.value)} className="h-8.5 w-full rounded-[var(--r-md)] border border-line bg-surface px-2.5 text-sm disabled:opacity-60">
              <option value="">Toda la red</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="primary" loading={pending} disabled={!name.trim()} onClick={submit}>Guardar recurso</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function iconFor(kind: string) {
  return {
    database: Database,
    api: Braces,
    repository: GitBranch,
    design: Figma,
    document: FileText,
    service: Server,
    link: Link2,
  }[kind] ?? Link2;
}

function SimpleMarkdown({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let code: string[] | null = null;

  lines.forEach((line, index) => {
    if (line.startsWith("```")) {
      if (code) {
        out.push(<pre key={`code-${index}`} className="my-3 overflow-x-auto rounded-[var(--r-md)] bg-[#201e1b] p-3 font-mono text-xs leading-relaxed text-[#f3eee5]"><code>{code.join("\n")}</code></pre>);
        code = null;
      } else code = [];
      return;
    }
    if (code) {
      code.push(line);
      return;
    }
    if (line.startsWith("### ")) out.push(<h4 key={index} className="mb-1 mt-4 text-sm font-semibold text-ink">{line.slice(4)}</h4>);
    else if (line.startsWith("## ")) out.push(<h3 key={index} className="mb-1 mt-5 text-base font-semibold text-ink">{line.slice(3)}</h3>);
    else if (line.startsWith("# ")) out.push(<h2 key={index} className="mb-2 mt-1 text-lg font-semibold text-ink">{line.slice(2)}</h2>);
    else if (/^[-*] /.test(line)) out.push(<p key={index} className="pl-4 text-sm leading-relaxed text-ink-2 before:-ml-3 before:mr-2 before:content-['•']">{line.slice(2)}</p>);
    else if (line.trim()) out.push(<p key={index} className="my-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{line}</p>);
  });
  return <div>{out}</div>;
}
