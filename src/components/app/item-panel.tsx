"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  History,
  Paperclip,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { ITEM_TYPE_META, accentHex, statusMeta, type ItemType, type Priority } from "@/lib/domain";
import { longDate, relativeTime } from "@/lib/format";
import type { ActivityEvent } from "@/lib/shared";
import { fetchItem, fetchItemActivity, type ItemData } from "@/server/actions/item-detail";
import {
  convertToTask,
  deleteItem,
  setAssignees,
  setItemProgress,
  setItemStatus,
  updateItem,
} from "@/server/actions/items";
import { Avatar, WeightedAvatar, type PersonLike } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AutoTextarea } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/glyphs";
import { Sheet, Tooltip } from "@/components/ui/overlays";
import {
  AssigneePicker,
  DatePicker,
  PriorityPicker,
  ProgressPicker,
  StatusPicker,
  type AssignmentDraft,
} from "@/components/app/pickers";
import { CommentThread } from "@/components/app/comments";
import { AttachmentGrid, FileDrop } from "@/components/app/attachments";
import {
  filterUploadableFiles,
  uploadPendingFiles,
  usePasteFiles,
} from "@/components/app/use-paste-files";
import { InlineComposer, ItemRow } from "@/components/app/item-row";
import { ActivityLine } from "@/components/app/activity";

/**
 * Panel de detalle.
 *
 * Se abre con `?item=…` desde cualquier lista sin sacarte de donde estabas, y
 * se cierra volviendo atrás. Todo lo que se edita acá se guarda solo: no hay
 * botón "guardar" porque no hay un momento en que uno "termine" de editar una
 * tarea.
 */
export function ItemPanel({
  members,
  viewerId,
}: {
  members: PersonLike[];
  viewerId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const itemId = params.get("item");

  const [data, setData] = React.useState<ItemData | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    const result = await fetchItem(itemId);
    setData(result?.item ?? null);
    setLoading(false);
  }, [itemId]);

  React.useEffect(() => {
    if (!itemId) {
      setData(null);
      return;
    }
    void load();
  }, [itemId, load]);

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("item");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const refresh = () => {
    void load();
    router.refresh();
  };

  return (
    <Sheet
      open={Boolean(itemId)}
      onOpenChange={(open) => !open && close()}
      title={data?.title ?? "Detalle"}
      width={560}
    >
      {loading && !data ? (
        <div className="space-y-3 p-6">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-7 w-3/4" />
          <div className="skeleton h-20 w-full" />
        </div>
      ) : data ? (
        <ItemBody
          key={data.id}
          item={data}
          members={members}
          viewerId={viewerId}
          onClose={close}
          onChanged={refresh}
        />
      ) : (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div>
            <p className="text-sm text-ink-2">Ese elemento ya no existe</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={close}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function ItemBody({
  item,
  members,
  viewerId,
  onClose,
  onChanged,
}: {
  item: ItemData;
  members: PersonLike[];
  viewerId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const typeMeta = ITEM_TYPE_META[item.type as ItemType];
  const status = statusMeta(item.type, item.status);
  const isTask = typeMeta?.schedulable;

  const [title, setTitle] = React.useState(item.title);
  const [body, setBody] = React.useState(item.body ?? "");
  const [showHistory, setShowHistory] = React.useState(false);
  const [history, setHistory] = React.useState<ActivityEvent[]>([]);

  const assignments: AssignmentDraft[] = item.assignments.map((a) => ({
    userId: a.user.id,
    weight: a.weight,
  }));

  const save = async (patch: Record<string, unknown>) => {
    const result = await updateItem(item.id, patch);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onChanged();
  };

  const loadHistory = async () => {
    setShowHistory((open) => !open);
    if (history.length === 0) {
      setHistory(await fetchItemActivity(item.id));
    }
  };

  const subtasksDone = item.children.filter((c) => c.status === "done").length;

  // Pegar una captura mientras el panel tiene el foco la adjunta al toque, sin
  // pasar por el selector de archivos; el elemento ya existe, así que se sube
  // directo (a diferencia de la creación rápida, acá no hay nada que encolar).
  const onPasteAttach = usePasteFiles(async (pasted) => {
    const { accepted, rejectedMessage } = filterUploadableFiles(pasted);
    if (rejectedMessage) toast.error(rejectedMessage);
    if (accepted.length === 0) return;
    const result = await uploadPendingFiles(accepted, {
      itemId: item.id,
      projectId: item.projectId,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.data.length === 1 ? "Imagen pegada" : `${result.data.length} archivos pegados`);
    onChanged();
  });

  return (
    <div className="contents" onPaste={onPasteAttach}>
      {/* Encabezado fijo: siempre se ve dónde estás parado y cómo salir. */}
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-2xs text-ink-4">
          <Link
            href={`/p/${item.project.id}`}
            className="inline-flex min-w-0 items-center gap-1.5 hover:text-ink-2"
          >
            <span
              className="size-1.5 shrink-0 rounded-[2px]"
              style={{ background: accentHex(item.project.accent) }}
            />
            <span className="truncate">{item.project.name}</span>
          </Link>
          <span className="opacity-50">·</span>
          <span>{typeMeta?.label}</span>
          {item.parent && (
            <>
              <span className="opacity-50">·</span>
              <span className="truncate">subtarea de {item.parent.title}</span>
            </>
          )}
        </span>

        <div className="flex shrink-0 items-center gap-0.5">
          {item.type === "idea" && item.status !== "converted" && (
            <Tooltip content="Convertir en tarea">
              <Button
                size="xs"
                variant="ghost"
                icon
                onClick={async () => {
                  const result = await convertToTask(item.id);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Idea convertida en tarea");
                  router.refresh();
                }}
              >
                <Wand2 className="size-3.5" strokeWidth={1.9} />
              </Button>
            </Tooltip>
          )}

          <Tooltip content="Abrir en el proyecto">
            <Button size="xs" variant="ghost" icon asChild>
              <Link href={`/p/${item.project.id}?item=${item.id}`}>
                <ArrowUpRight className="size-3.5" strokeWidth={1.9} />
              </Link>
            </Button>
          </Tooltip>

          <Tooltip content="Borrar">
            <Button
              size="xs"
              variant="ghost"
              icon
              className="text-ink-4 hover:text-[var(--tone-blocked)]"
              onClick={async () => {
                const result = await deleteItem(item.id);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Borrado", { description: item.title });
                onClose();
                router.refresh();
              }}
            >
              <Trash2 className="size-3.5" strokeWidth={1.9} />
            </Button>
          </Tooltip>

          <Button size="xs" variant="ghost" icon onClick={onClose} aria-label="Cerrar">
            <X className="size-4" strokeWidth={1.9} />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 py-4">
          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => title.trim() && title !== item.title && save({ title: title.trim() })}
            rows={1}
            className={cn(
              "w-full resize-none bg-transparent text-lg font-semibold leading-snug tracking-tight text-ink focus:outline-none",
              status.terminal && status.weight === 100 && "text-ink-3 line-through decoration-ink-4/40",
            )}
            style={{ minHeight: "1.6rem" }}
          />

          {/* Controles: leen como texto, no como un formulario. */}
          <div className="-ml-2 mt-2 flex flex-wrap items-center gap-0.5">
            <StatusPicker
              type={item.type}
              value={item.status}
              progress={item.progress}
              onChange={async (value) => {
                const result = await setItemStatus(item.id, value);
                if (!result.ok) toast.error(result.error);
                else onChanged();
              }}
            />

            {isTask && (
              <>
                <AssigneePicker
                  members={members}
                  value={assignments}
                  scope={item.assigneeScope as "individual" | "team"}
                  onChange={async (next) => {
                    const result = await setAssignees(item.id, {
                      scope: next.scope,
                      assignees: next.assignees,
                    });
                    if (!result.ok) toast.error(result.error);
                    else onChanged();
                  }}
                />
                <PriorityPicker
                  value={item.priority}
                  onChange={(priority: Priority) => save({ priority })}
                />
                <DatePicker
                  value={item.dueDate ? new Date(item.dueDate).toISOString() : null}
                  onChange={(value) => save({ dueDate: value ?? "" })}
                />
                <ProgressPicker
                  value={item.progress}
                  mode={item.progressMode}
                  hasChildren={item.children.length > 0}
                  onChange={async (progress, mode) => {
                    const result = await setItemProgress(item.id, progress, mode);
                    if (!result.ok) toast.error(result.error);
                    else onChanged();
                  }}
                />
              </>
            )}

            {item.type === "problem" && (
              <PriorityPicker
                value={item.priority}
                onChange={(priority: Priority) => save({ priority })}
              />
            )}
          </div>

          {isTask && item.progress > 0 && (
            <ProgressBar
              value={item.progress}
              tone={item.progress === 100 ? "done" : "progress"}
              className="mt-3"
            />
          )}

          <p className="mt-3 text-2xs text-ink-4">
            {item.createdBy.name.split(" ")[0]} lo creó {relativeTime(item.createdAt)}
            {item.assignments.length > 0 &&
              item.assignments[0].assignedBy.id !== item.createdBy.id &&
              ` · asignada por ${item.assignments[0].assignedBy.name.split(" ")[0]}`}
          </p>

          <AutoTextarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onBlur={() => body !== (item.body ?? "") && save({ body: body || null })}
            placeholder={
              item.type === "decision"
                ? "¿Qué decidimos y por qué? Lo que se escribe acá es lo que el equipo va a releer en tres meses."
                : "Agregá contexto, pasos o lo que haga falta…"
            }
            minRows={3}
            className="mt-3 border-0 bg-transparent px-0 focus:shadow-none"
          />
        </div>

        {/* Reparto de colaboración: el dato que hace visible el trabajo compartido. */}
        {isTask && item.assignments.length > 1 && (
          <Section title="Cómo se reparte">
            <div className="flex flex-wrap gap-1.5">
              {item.assignments.map((assignment) => (
                <WeightedAvatar
                  key={assignment.user.id}
                  person={assignment.user}
                  weight={assignment.weight}
                />
              ))}
            </div>
          </Section>
        )}

        {isTask && (
          <Section
            title="Subtareas"
            hint={
              item.children.length > 0
                ? `${subtasksDone} de ${item.children.length} · el progreso sale de acá`
                : undefined
            }
          >
            <div className="-mx-1 overflow-hidden rounded-[var(--r-md)] border border-line">
              {item.children.map((child) => (
                <ItemRow key={child.id} item={child} compact />
              ))}
              <InlineComposer
                projectId={item.projectId}
                parentId={item.id}
                placeholder="Agregar subtarea…"
                onCreated={onChanged}
                className={item.children.length > 0 ? "border-t border-line-soft" : undefined}
              />
            </div>
          </Section>
        )}

        <Section title="Archivos" icon={<Paperclip className="size-3" strokeWidth={2} />}>
          <AttachmentGrid
            attachments={item.attachments}
            viewerId={viewerId}
            className="mb-2"
          />
          <FileDrop
            itemId={item.id}
            projectId={item.projectId}
            compact
            label="Agregar imagen o archivo"
          />
        </Section>

        <Section title="Conversación" count={item.comments.length}>
          <CommentThread
            itemId={item.id}
            comments={item.comments}
            members={members}
            viewerId={viewerId}
            emptyHint="Nadie comentó todavía. Escribí lo que haga falta saber."
          />
        </Section>

        <div className="border-t border-line-soft px-5 py-3">
          <button
            onClick={loadHistory}
            className="flex w-full items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.07em] text-ink-4 transition-colors hover:text-ink-3"
          >
            <History className="size-3" strokeWidth={2} />
            Historial
            <ChevronDown
              className={cn("size-3 transition-transform", showHistory && "rotate-180")}
              strokeWidth={2.2}
            />
          </button>

          {showHistory && (
            <div className="mt-2 pl-0.5">
              {history.length === 0 ? (
                <p className="text-2xs text-ink-4">Sin movimientos registrados.</p>
              ) : (
                history.map((event) => (
                  <ActivityLine
                    key={event.id}
                    event={event}
                    currentUserId={viewerId}
                    showProject={false}
                  />
                ))
              )}
            </div>
          )}

          <p className="mt-3 flex items-center gap-1.5 text-2xs text-ink-4">
            <Check className="size-3" strokeWidth={2.2} />
            Creado el {longDate(item.createdAt)}
            {item.completedAt && ` · cerrado el ${longDate(item.completedAt)}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  hint,
  icon,
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line-soft px-5 py-4">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.07em] text-ink-4">
        {icon}
        {title}
        {count !== undefined && count > 0 && <span className="tabular opacity-70">{count}</span>}
        {hint && <span className="ml-auto normal-case tracking-normal opacity-80">{hint}</span>}
      </h3>
      {children}
    </section>
  );
}
