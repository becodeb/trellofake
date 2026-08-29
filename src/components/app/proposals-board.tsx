"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, CornerDownLeft, Lightbulb, MessageCircle, Plus } from "lucide-react";

import {
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_LABEL,
  type ProposalStatus,
} from "@/lib/domain";
import { relativeTime } from "@/lib/format";
import {
  createProposal,
  promoteProposal,
  replyToProposal,
  triageProposal,
} from "@/server/actions/proposals";
import { Avatar, type PersonLike } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AutoTextarea, Field, Input } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";

export type ProposalData = {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  createdAt: Date;
  author: PersonLike;
  targetProject: { id: string; name: string } | null;
  promotedProject: { id: string; name: string } | null;
  replies: Array<{ id: string; body: string; createdAt: Date; author: PersonLike }>;
};

type ProjectOption = { id: string; name: string };

export function ProposalsBoard({
  proposals,
  projects,
  canManage,
  viewer,
}: {
  proposals: ProposalData[];
  projects: ProjectOption[];
  canManage: boolean;
  viewer: PersonLike | null;
}) {
  const [creating, setCreating] = React.useState(false);

  return (
    <>
      <div className="mb-5 flex justify-end">
        {viewer ? (
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" strokeWidth={2.4} />
            Proponer una idea
          </Button>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <Link href="/login" className="font-medium text-accent-ink hover:underline">
              Ingresá
            </Link>
            para proponer una idea.
          </p>
        )}
      </div>

      {proposals.length === 0 ? (
        <div className="grid-paper rounded-[var(--r-lg)] border border-dashed border-line px-6 py-14 text-center">
          <Lightbulb className="mx-auto size-6 text-ink-4" strokeWidth={1.6} />
          <p className="mt-3 font-display text-xl text-ink">Todavía no hay propuestas</p>
          <p className="mx-auto mt-1.5 max-w-[42ch] text-xs leading-relaxed text-ink-3">
            Este es el lugar para plantear una necesidad, una mejora o una aplicación nueva
            antes de que se convierta en trabajo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              projects={projects}
              canManage={canManage}
              viewer={viewer}
            />
          ))}
        </div>
      )}

      <NewProposalDialog
        projects={projects}
        open={creating}
        onOpenChange={setCreating}
      />
    </>
  );
}

function ProposalCard({
  proposal,
  projects,
  canManage,
  viewer,
}: {
  proposal: ProposalData;
  projects: ProjectOption[];
  canManage: boolean;
  viewer: PersonLike | null;
}) {
  const router = useRouter();
  const [reply, setReply] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const status = proposal.status as ProposalStatus;

  const triage = async (nextStatus: ProposalStatus, targetProjectId?: string | null) => {
    setPending(true);
    const result = await triageProposal(proposal.id, {
      status: nextStatus,
      ...(targetProjectId !== undefined ? { targetProjectId } : {}),
    });
    setPending(false);
    if (!result.ok) toast.error(result.error);
    else router.refresh();
  };

  return (
    <article className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-2xs text-ink-4">
              <span className="font-medium text-accent-ink">
                {PROPOSAL_STATUS_LABEL[status] ?? proposal.status}
              </span>
              <span>·</span>
              <span>{categoryLabel(proposal.category)}</span>
              <span>·</span>
              <span>{relativeTime(proposal.createdAt)}</span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-ink">
              {proposal.title}
            </h2>
          </div>

          {canManage && (
            <select
              value={proposal.status}
              disabled={pending}
              onChange={(event) => void triage(event.target.value as ProposalStatus)}
              className="h-8 rounded-[var(--r-md)] border border-line bg-surface px-2 text-xs text-ink-2"
              aria-label="Estado de la propuesta"
            >
              {PROPOSAL_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {PROPOSAL_STATUS_LABEL[option]}
                </option>
              ))}
            </select>
          )}
        </div>

        <p className="prose-note mt-3 whitespace-pre-wrap">{proposal.body}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
          <Avatar person={proposal.author} size="xs" />
          <span className="text-xs text-ink-3">Propuesta por {proposal.author.name}</span>

          {proposal.targetProject && (
            <Link
              href={`/p/${proposal.targetProject.id}`}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline"
            >
              {proposal.targetProject.name}
              <ArrowUpRight className="size-3" strokeWidth={2} />
            </Link>
          )}
        </div>

        {canManage && !proposal.promotedProject && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--r-md)] bg-surface-2 p-2">
            <span className="px-1 text-2xs font-medium text-ink-3">Derivar a</span>
            <select
              value={proposal.targetProject?.id ?? ""}
              disabled={pending}
              onChange={(event) =>
                void triage(event.target.value ? "accepted" : "reviewing", event.target.value || null)
              }
              className="h-7 min-w-44 flex-1 rounded-[var(--r-sm)] border border-line bg-surface px-2 text-xs"
            >
              <option value="">Todavía sin proyecto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <Button
              size="xs"
              variant="default"
              loading={pending}
              onClick={async () => {
                setPending(true);
                const result = await promoteProposal(proposal.id);
                setPending(false);
                if (!result.ok) toast.error(result.error);
                else {
                  toast.success("La idea ya es un proyecto");
                  router.push(`/p/${result.data.projectId}`);
                  router.refresh();
                }
              }}
            >
              Iniciar como proyecto
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-line-soft bg-paper/40 px-4 py-3 sm:px-5">
        {proposal.replies.length > 0 && (
          <ul className="mb-3 space-y-3">
            {proposal.replies.map((item) => (
              <li key={item.id} className="flex gap-2.5">
                <Avatar person={item.author} size="xs" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-ink">
                    {item.author.name}{" "}
                    <span className="font-normal text-ink-4">· {relativeTime(item.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {viewer ? (
          <div className="flex items-start gap-2.5">
            <Avatar person={viewer} size="xs" className="mt-1" />
            <div className="min-w-0 flex-1">
              <AutoTextarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                minRows={1}
                placeholder="Sumá contexto, una duda o una sugerencia…"
                className="min-h-8 bg-surface"
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && reply.trim()) {
                    event.preventDefault();
                    void sendReply();
                  }
                }}
              />
              {reply.trim() && (
                <div className="mt-1.5 flex justify-end">
                  <Button size="xs" variant="primary" loading={pending} onClick={() => void sendReply()}>
                    <CornerDownLeft className="size-3" />
                    Responder
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <Link href="/login" className="font-medium text-accent-ink hover:underline">
              Ingresá
            </Link>
            para responder.
          </p>
        )}
      </div>
    </article>
  );

  async function sendReply() {
    if (!reply.trim() || pending) return;
    setPending(true);
    const result = await replyToProposal(proposal.id, reply);
    setPending(false);
    if (!result.ok) toast.error(result.error);
    else {
      setReply("");
      router.refresh();
    }
  }
}

function NewProposalDialog({
  projects,
  open,
  onOpenChange,
}: {
  projects: ProjectOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState("project");
  const [targetProjectId, setTargetProjectId] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody("");
    setCategory("project");
    setTargetProjectId("");
  }, [open]);

  const submit = async () => {
    setPending(true);
    const result = await createProposal({
      title,
      body,
      category,
      targetProjectId: targetProjectId || undefined,
    });
    setPending(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Idea publicada");
      onOpenChange(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Proponer una idea"
        description="Contá la necesidad y el equipo puede conversarla, derivarla o convertirla en proyecto."
        width="md"
      >
        <div className="space-y-3.5 px-5">
          <Field label="Título">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Una app para reservar los espacios comunes"
              autoFocus
            />
          </Field>
          <Field label="Contexto" hint="Qué problema resuelve, quién lo necesita y cómo imaginás que funcionaría.">
            <AutoTextarea value={body} onChange={(event) => setBody(event.target.value)} minRows={5} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-8.5 w-full rounded-[var(--r-md)] border border-line bg-surface px-2.5 text-sm"
              >
                <option value="project">Proyecto nuevo</option>
                <option value="improvement">Mejora</option>
                <option value="need">Necesidad</option>
              </select>
            </Field>
            <Field label="Proyecto relacionado" hint="Opcional.">
              <select
                value={targetProjectId}
                onChange={(event) => setTargetProjectId(event.target.value)}
                className="h-8.5 w-full rounded-[var(--r-md)] border border-line bg-surface px-2.5 text-sm"
              >
                <option value="">Ninguno todavía</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!title.trim() || body.trim().length < 12}
            onClick={submit}
          >
            <MessageCircle className="size-3.5" strokeWidth={2} />
            Publicar propuesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function categoryLabel(category: string) {
  return { project: "Proyecto nuevo", improvement: "Mejora", need: "Necesidad" }[category] ?? "Idea";
}
