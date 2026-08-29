"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  ACCENTS,
  accentHex,
  type Accent,
  type Priority,
} from "@/lib/domain";
import { createProject } from "@/server/actions/projects";
import type { PersonLike } from "@/components/ui/avatar";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AutoTextarea, Field, Input } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";
import { DatePicker, PriorityPicker, ProjectPicker, type ProjectOption } from "@/components/app/pickers";

/**
 * Crear proyecto.
 *
 * Solo el nombre es obligatorio: un proyecto tiene que poder existir antes de
 * que alguien sepa las fechas. Todo lo demás se completa cuando se sabe.
 */
export function NewProjectButton({
  members,
  parents,
  defaultParentId,
  label = "Nuevo proyecto",
  variant = "primary",
  size = "sm",
}: {
  members: PersonLike[];
  parents: ProjectOption[];
  defaultParentId?: string;
  label?: string;
  variant?: "primary" | "default" | "subtle" | "ghost";
  size?: "xs" | "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [parentId, setParentId] = React.useState<string | null>(defaultParentId ?? null);
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [accent, setAccent] = React.useState<Accent>("clay");
  const [startDate, setStartDate] = React.useState<string | null>(null);
  const [targetDate, setTargetDate] = React.useState<string | null>(null);
  const [people, setPeople] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setParentId(defaultParentId ?? null);
    setPriority("medium");
    setAccent(ACCENTS[Math.floor(Math.random() * ACCENTS.length)]);
    setStartDate(null);
    setTargetDate(null);
    setPeople([]);
  }, [open, defaultParentId]);

  const submit = async () => {
    if (!name.trim() || pending) return;
    setPending(true);
    const result = await createProject({
      name: name.trim(),
      description: description.trim() || undefined,
      parentId: parentId ?? undefined,
      priority,
      accent,
      startDate: startDate ?? undefined,
      targetDate: targetDate ?? undefined,
      memberIds: people,
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setOpen(false);
    toast.success(defaultParentId ? "Subproyecto creado" : "Proyecto creado", {
      description: name.trim(),
    });
    router.push(`/p/${result.data.id}`);
    router.refresh();
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus className="size-3.5" strokeWidth={2.4} />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={defaultParentId ? "Nuevo subproyecto" : "Nuevo proyecto"}
          description="Un subproyecto tiene la misma estructura que un proyecto: sus propias tareas, notas y archivos."
          width="md"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        >
          <div className="space-y-3.5 px-5">
            <div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="Nombre del proyecto"
                className="w-full bg-transparent text-lg font-medium text-ink placeholder:text-ink-4 focus:outline-none"
              />
              <AutoTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="¿De qué se trata? Una o dos líneas alcanzan."
                minRows={2}
                className="mt-1 border-0 bg-transparent px-0 focus:shadow-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 border-y border-line-soft py-2">
              {!defaultParentId && parents.length > 0 && (
                <ProjectPicker
                  options={parents}
                  value={parentId}
                  onChange={setParentId}
                  placeholder="Proyecto raíz"
                />
              )}
              <PriorityPicker value={priority} onChange={setPriority} />
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Inicio" />
              <DatePicker
                value={targetDate}
                onChange={setTargetDate}
                placeholder="Fecha estimada"
              />
            </div>

            <Field label="Color">
              <div className="flex flex-wrap gap-1.5">
                {ACCENTS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAccent(option)}
                    aria-label={option}
                    className={cn(
                      "grid size-6 place-items-center rounded-[var(--r-sm)] transition-transform",
                      accent === option ? "scale-110" : "hover:scale-105",
                    )}
                    style={{ background: `${accentHex(option)}26` }}
                  >
                    <span
                      className="size-3 rounded-[3px]"
                      style={{ background: accentHex(option) }}
                    />
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Quiénes participan" hint="Podés sumar gente más adelante.">
              <div className="flex flex-wrap gap-1.5">
                {members.map((member) => {
                  const selected = people.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() =>
                        setPeople((current) =>
                          current.includes(member.id)
                            ? current.filter((id) => id !== member.id)
                            : [...current, member.id],
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-xs transition-colors",
                        selected
                          ? "border-accent-line bg-accent-wash text-accent-ink"
                          : "border-line text-ink-2 hover:border-line-strong",
                      )}
                    >
                      <Avatar person={member} size="xs" />
                      {member.name.split(" ")[0]}
                      {selected && <Check className="size-3" strokeWidth={2.6} />}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={submit} loading={pending} disabled={!name.trim()}>
              Crear proyecto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
