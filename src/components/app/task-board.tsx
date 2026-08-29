"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { cn } from "@/lib/cn";
import { TASK_STATUSES, accentHex, statusMeta } from "@/lib/domain";
import { dueState } from "@/lib/format";
import { moveItem } from "@/server/actions/items";
import type { ItemRow as ItemRowData } from "@/server/domain/items";
import { Avatar } from "@/components/ui/avatar";
import { PriorityGlyph, ProgressGlyph, TONE_VAR } from "@/components/ui/glyphs";
import { InlineComposer } from "@/components/app/item-row";

/**
 * Tablero de tareas.
 *
 * Una columna por estado. Arrastrar una tarjeta cambia el estado —que es lo
 * que uno espera que signifique moverla— y el cambio se ve al instante; si el
 * servidor lo rechaza, la tarjeta vuelve sola a su lugar.
 */
export function TaskBoard({
  projectId,
  tasks,
  canWrite,
}: {
  projectId: string;
  tasks: ItemRowData[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(tasks);
  const [dragging, setDragging] = React.useState<ItemRowData | null>(null);

  React.useEffect(() => setItems(tasks), [tasks]);

  const sensors = useSensors(
    // Un umbral chico evita que un click se interprete como arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columns = TASK_STATUSES.map((status) => ({
    ...status,
    items: items.filter((item) => item.status === status.value),
  }));

  const onDragStart = (event: DragStartEvent) => {
    setDragging(items.find((item) => item.id === event.active.id) ?? null);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;

    const task = items.find((item) => item.id === active.id);
    const targetStatus = String(over.id);
    if (!task || task.status === targetStatus) return;

    const previous = items;
    setItems((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status: targetStatus } : item)),
    );

    const result = await moveItem(task.id, {
      status: targetStatus,
      position: Date.now(),
    });

    if (!result.ok) {
      setItems(previous);
      toast.error(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {columns.map((column) => (
          <Column
            key={column.value}
            id={column.value}
            label={column.label}
            tone={column.tone}
            count={column.items.length}
          >
            {column.items.map((task) => (
              <Card key={task.id} task={task} draggable={canWrite} />
            ))}

            {canWrite && column.value === "todo" && (
              <InlineComposer
                projectId={projectId}
                placeholder="Nueva tarea…"
                className="rounded-[var(--r-md)] border border-dashed border-line px-2.5"
              />
            )}
          </Column>
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22,1,0.36,1)" }}>
        {dragging ? <CardFace task={dragging} floating /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  id,
  label,
  tone,
  count,
  children,
}: {
  id: string;
  label: string;
  tone: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section className="flex w-[268px] shrink-0 flex-col">
      <header className="mb-2 flex items-center gap-2 px-1">
        <span
          className="size-1.5 rounded-full"
          style={{ background: TONE_VAR[tone as keyof typeof TONE_VAR] }}
        />
        <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</h3>
        <span className="text-2xs tabular text-ink-4">{count}</span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-1.5 rounded-[var(--r-lg)] p-1.5 transition-colors",
          isOver ? "bg-accent-wash" : "bg-surface-2/60",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function Card({
  task,
  draggable,
}: {
  task: ItemRowData;
  draggable: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
  });

  const open = () => {
    const next = new URLSearchParams(params.toString());
    next.set("item", task.id);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={open}
      className={cn(
        "cursor-pointer touch-none outline-none",
        isDragging && "opacity-30",
      )}
    >
      <CardFace task={task} />
    </div>
  );
}

function CardFace({ task, floating }: { task: ItemRowData; floating?: boolean }) {
  const due = dueState(task.dueDate, task.status === "done");
  const meta = statusMeta(task.type, task.status);
  const subtasks = task._count.children;

  return (
    <article
      className={cn(
        "rounded-[var(--r-md)] border border-line bg-surface p-2.5 transition-shadow",
        floating
          ? "rotate-[1.5deg] shadow-[var(--shadow-lg)]"
          : "shadow-[var(--shadow-sm)] hover:border-line-strong",
      )}
    >
      <div className="flex items-start gap-2">
        <ProgressGlyph
          type={task.type}
          status={task.status}
          progress={task.progress}
          size={13}
          className="mt-0.5"
        />
        <p
          className={cn(
            "min-w-0 flex-1 text-sm leading-snug",
            meta.terminal && meta.weight === 100 ? "text-ink-4 line-through" : "text-ink",
          )}
        >
          {task.title}
        </p>
        <PriorityGlyph priority={task.priority} className="mt-0.5 shrink-0" />
      </div>

      {task.projectId && (
        <p className="mt-1.5 flex items-center gap-1.5 text-2xs text-ink-4">
          <span
            className="size-1.5 rounded-[2px]"
            style={{ background: accentHex(task.project.accent) }}
          />
          <span className="truncate">{task.project.name}</span>
        </p>
      )}

      {(subtasks > 0 || due.state !== "none" || task.assignments.length > 0) && (
        <div className="mt-2 flex items-center gap-2">
          {subtasks > 0 && (
            <span className="text-2xs tabular text-ink-4">{task.progress}%</span>
          )}
          {due.state !== "none" && (
            <span
              className={cn(
                "text-2xs",
                due.state === "overdue"
                  ? "font-medium text-[var(--tone-blocked)]"
                  : due.state === "today"
                    ? "font-medium text-[var(--tone-progress)]"
                    : "text-ink-4",
              )}
            >
              {due.label}
            </span>
          )}

          <span className="ml-auto flex -space-x-1.5">
            {task.assigneeScope === "team" ? (
              <span className="rounded-full border border-line px-1.5 py-px text-[10px] text-ink-3">
                Equipo
              </span>
            ) : (
              task.assignments.slice(0, 3).map((assignment) => (
                <Avatar key={assignment.user.id} person={assignment.user} size="xs" ring />
              ))
            )}
          </span>
        </div>
      )}
    </article>
  );
}
