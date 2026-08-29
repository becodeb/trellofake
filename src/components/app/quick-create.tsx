"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CornerDownLeft, Plus } from "lucide-react";

import { cn } from "@/lib/cn";
import { ITEM_TYPES, ITEM_TYPE_META, type ItemType, type Priority } from "@/lib/domain";
import { createItem } from "@/server/actions/items";
import type { PersonLike } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AutoTextarea } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter, Kbd } from "@/components/ui/overlays";
import {
  AssigneePicker,
  DatePicker,
  PriorityPicker,
  ProjectPicker,
  type AssignmentDraft,
  type ProjectOption,
} from "@/components/app/pickers";

/**
 * Creación rápida.
 *
 * Un solo diálogo para los seis tipos de contenido. Se abre con "c", el foco
 * cae en el título y ⌘↵ guarda: crear una idea suelta debería costar lo mismo
 * que escribirla en un papel.
 */
export function QuickCreate({
  open,
  onOpenChange,
  projects,
  members,
  defaultProjectId,
  defaultType = "task",
  defaultParentId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectOption[];
  members: PersonLike[];
  defaultProjectId?: string | null;
  defaultType?: ItemType;
  defaultParentId?: string;
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const [type, setType] = React.useState<ItemType>(defaultType);
  const [projectId, setProjectId] = React.useState<string | null>(
    defaultProjectId ?? projects[0]?.id ?? null,
  );
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [dueDate, setDueDate] = React.useState<string | null>(null);
  const [assignees, setAssignees] = React.useState<AssignmentDraft[]>([]);
  const [scope, setScope] = React.useState<"individual" | "team">("individual");
  const [pending, setPending] = React.useState(false);

  // Cada apertura arranca limpia, pero respeta el contexto desde donde se abrió.
  React.useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setProjectId(defaultProjectId ?? projects[0]?.id ?? null);
    setTitle("");
    setBody("");
    setPriority("medium");
    setDueDate(null);
    setAssignees([]);
    setScope("individual");
  }, [open, defaultType, defaultProjectId, projects]);

  const meta = ITEM_TYPE_META[type];
  const isTask = meta.schedulable;

  const submit = async () => {
    if (!title.trim() || !projectId || pending) return;
    setPending(true);
    const result = await createItem({
      projectId,
      type,
      title: title.trim(),
      body: body.trim() || undefined,
      priority,
      dueDate: dueDate ?? undefined,
      parentId: defaultParentId,
      assigneeIds: isTask && scope === "individual" ? assignees.map((a) => a.userId) : [],
      assigneeScope: isTask ? scope : "individual",
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${meta.label} creada`, { description: title.trim() });
    onOpenChange(false);
    onCreated?.(result.data.id);
    router.refresh();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Crear"
        description="Elegí qué querés dejar registrado."
        width="md"
        onKeyDown={onKeyDown}
      >
        {/* Segmentado de tipos: el vocabulario de la app, a la vista. */}
        <div className="mx-5 mb-3.5 flex flex-wrap gap-1 rounded-[var(--r-md)] bg-surface-2 p-1">
          {ITEM_TYPES.map((option) => (
            <button
              key={option}
              onClick={() => setType(option)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-[var(--r-sm)] px-2 py-1.5 text-xs font-medium transition-all",
                type === option
                  ? "bg-surface text-ink shadow-[var(--shadow-sm)]"
                  : "text-ink-3 hover:text-ink",
              )}
            >
              {ITEM_TYPE_META[option].label}
            </button>
          ))}
        </div>

        <div className="px-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder={placeholderFor(type)}
            className="w-full bg-transparent text-lg font-medium text-ink placeholder:text-ink-4 focus:outline-none"
          />

          <AutoTextarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={meta.hint + "…"}
            minRows={2}
            className="mt-2 border-0 bg-transparent px-0 focus:shadow-none"
          />

          <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-line-soft pt-2.5">
            <ProjectPicker options={projects} value={projectId} onChange={setProjectId} />

            {isTask && (
              <>
                <AssigneePicker
                  members={members}
                  value={assignees}
                  scope={scope}
                  onChange={(next) => {
                    setAssignees(next.assignees);
                    setScope(next.scope);
                  }}
                />
                <PriorityPicker value={priority} onChange={setPriority} />
                <DatePicker value={dueDate} onChange={setDueDate} placeholder="Sin fecha" />
              </>
            )}

            {type === "problem" && (
              <PriorityPicker value={priority} onChange={setPriority} />
            )}
          </div>
        </div>

        <DialogFooter>
          <span className="mr-auto flex items-center gap-1.5 text-2xs text-ink-4">
            <Kbd>⌘</Kbd>
            <Kbd>
              <CornerDownLeft className="size-2.5" />
            </Kbd>
            para guardar
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={pending}
            disabled={!title.trim() || !projectId}
          >
            <Plus className="size-3.5" strokeWidth={2.4} />
            Crear {meta.label.toLowerCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function placeholderFor(type: ItemType): string {
  switch (type) {
    case "task":
      return "Implementar login con Google";
    case "idea":
      return "¿Y si el onboarding fuera de un solo paso?";
    case "note":
      return "Credenciales del entorno de staging";
    case "problem":
      return "El deploy falla cuando hay más de 50 usuarios";
    case "decision":
      return "Usamos Postgres en vez de Mongo";
    case "update":
      return "Hoy terminé la autenticación";
  }
}
