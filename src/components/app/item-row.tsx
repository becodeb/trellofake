"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CornerDownRight, MessageSquare, Paperclip, Plus } from "lucide-react";

import { cn } from "@/lib/cn";
import { ITEM_TYPE_META, accentHex, statusMeta, type ItemType } from "@/lib/domain";
import { dueState } from "@/lib/format";
import { createItem, setItemStatus } from "@/server/actions/items";
import type { ItemRow as ItemRowData } from "@/server/domain/items";
import { Avatar } from "@/components/ui/avatar";
import { PriorityGlyph } from "@/components/ui/glyphs";
import { StatusPicker } from "@/components/app/pickers";
import { Tooltip } from "@/components/ui/overlays";

/**
 * Fila de contenido.
 *
 * Es la unidad más repetida de la app, así que carga poco y dice mucho: estado
 * con avance, título, quién lo tiene y cuánto le toca a cada uno, cuándo vence
 * y cuánta conversación acumuló. Cambiar el estado se hace desde acá; abrir el
 * detalle es un click en el título.
 */
export function ItemRow({
  item,
  showProject = false,
  indent = 0,
  compact = false,
}: {
  item: ItemRowData;
  showProject?: boolean;
  indent?: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [status, setStatus] = React.useState(item.status);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => setStatus(item.status), [item.status]);

  const meta = statusMeta(item.type, status);
  const done = meta.terminal && meta.weight === 100;
  const due = dueState(item.dueDate, done);
  const typeMeta = ITEM_TYPE_META[item.type as ItemType];

  const open = () => {
    const next = new URLSearchParams(params.toString());
    next.set("item", item.id);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const changeStatus = (value: string) => {
    const previous = status;
    setStatus(value); // optimista: la fila responde antes que el servidor
    startTransition(async () => {
      const result = await setItemStatus(item.id, value);
      if (!result.ok) {
        setStatus(previous);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        "row hairline group flex items-center gap-2.5 pr-3",
        compact ? "py-1.5" : "py-2",
        pending && "opacity-70",
      )}
      style={{ paddingLeft: 12 + indent * 20 }}
    >
      {indent > 0 && (
        <CornerDownRight className="size-3 shrink-0 text-ink-4/60" strokeWidth={2} aria-hidden />
      )}

      <StatusPicker
        type={item.type}
        value={status}
        progress={item.progress}
        onChange={changeStatus}
        compact
      />

      <button
        onClick={open}
        className="min-w-0 flex-1 text-left"
        title={item.title}
      >
        <span
          className={cn(
            "block truncate text-sm",
            done ? "text-ink-4 line-through decoration-ink-4/40" : "text-ink",
          )}
        >
          {item.title}
        </span>

        {!compact && item.body && !done && (
          <span className="mt-0.5 block truncate text-2xs text-ink-4">
            {item.body.replace(/\s+/g, " ").slice(0, 120)}
          </span>
        )}
      </button>

      {/* Señales secundarias: solo aparecen cuando hay algo que contar. */}
      <div className="flex shrink-0 items-center gap-2 text-2xs text-ink-4">
        {showProject && (
          <span className="hidden items-center gap-1.5 md:inline-flex">
            <span
              className="size-1.5 rounded-[2px]"
              style={{ background: accentHex(item.project.accent) }}
            />
            <span className="max-w-[130px] truncate">{item.project.name}</span>
          </span>
        )}

        {item.type !== "task" && (
          <span className="hidden sm:inline">{typeMeta?.label}</span>
        )}

        {item._count.children > 0 && (
          <Tooltip content={`${item._count.children} subtareas`}>
            <span className="hidden items-center gap-1 tabular sm:inline-flex">
              <Plus className="size-2.5" strokeWidth={2.6} />
              {item._count.children}
            </span>
          </Tooltip>
        )}

        {item._count.comments > 0 && (
          <span className="inline-flex items-center gap-1 tabular">
            <MessageSquare className="size-3" strokeWidth={1.9} />
            {item._count.comments}
          </span>
        )}

        {item._count.attachments > 0 && (
          <span className="inline-flex items-center gap-1 tabular">
            <Paperclip className="size-3" strokeWidth={1.9} />
            {item._count.attachments}
          </span>
        )}

        {due.state !== "none" && (
          <span
            className={cn(
              "hidden whitespace-nowrap sm:inline",
              due.state === "overdue" && "font-medium text-[var(--tone-blocked)]",
              due.state === "today" && "font-medium text-[var(--tone-progress)]",
            )}
          >
            {due.label}
          </span>
        )}

        <PriorityGlyph priority={item.priority} />

        <Assignees item={item} />
      </div>
    </div>
  );
}

/**
 * Responsables. Con una sola persona alcanza el avatar; con varias se muestra
 * el reparto, porque es el dato que distingue una tarea colaborativa de una
 * tarea con muchos mirones.
 */
function Assignees({ item }: { item: ItemRowData }) {
  if (item.assigneeScope === "team") {
    return (
      <Tooltip content="Todo el equipo">
        <span className="rounded-full border border-line px-1.5 py-px text-[10px] font-medium text-ink-3">
          Equipo
        </span>
      </Tooltip>
    );
  }

  if (item.assignments.length === 0) return null;

  if (item.assignments.length === 1) {
    return <Avatar person={item.assignments[0].user} size="xs" />;
  }

  return (
    <Tooltip
      content={
        <span className="flex flex-col gap-0.5">
          {item.assignments.map((a) => (
            <span key={a.user.id}>
              {a.user.name} · {a.weight}%
            </span>
          ))}
        </span>
      }
    >
      <span className="flex -space-x-1.5">
        {item.assignments.slice(0, 3).map((assignment) => (
          <span key={assignment.user.id} className="relative">
            <Avatar person={assignment.user} size="xs" ring />
          </span>
        ))}
      </span>
    </Tooltip>
  );
}

/**
 * Alta en línea.
 *
 * Escribir y apretar Enter crea el elemento y deja el campo listo para el
 * siguiente. Es la diferencia entre volcar cinco tareas de un tirón y abrir
 * cinco veces un formulario.
 */
export function InlineComposer({
  projectId,
  type = "task",
  parentId,
  placeholder,
  onCreated,
  className,
}: {
  projectId: string;
  type?: ItemType;
  parentId?: string;
  placeholder?: string;
  onCreated?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const submit = async () => {
    const title = value.trim();
    if (!title || pending) return;

    setPending(true);
    const result = await createItem({
      projectId,
      type,
      title,
      parentId,
      assigneeIds: [],
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setValue("");
    onCreated?.();
    router.refresh();
    inputRef.current?.focus();
  };

  const label = ITEM_TYPE_META[type];

  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 px-3 py-2 transition-colors focus-within:bg-surface-2",
        className,
      )}
    >
      <span className="grid size-[13px] shrink-0 place-items-center">
        <Plus
          className="size-3 text-ink-4 transition-colors group-focus-within:text-accent"
          strokeWidth={2.4}
        />
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") {
            setValue("");
            inputRef.current?.blur();
          }
        }}
        disabled={pending}
        placeholder={placeholder ?? `${label.action}…`}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-4 focus:outline-none disabled:opacity-50"
      />
      {value.trim() && (
        <span className="shrink-0 text-2xs text-ink-4">Enter para guardar</span>
      )}
    </div>
  );
}
