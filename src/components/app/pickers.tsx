"use client";

import * as React from "react";
import { Check, ChevronDown, Users } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  PRIORITIES,
  PRIORITY_META,
  accentHex,
  evenWeights,
  normalizeWeights,
  statusesFor,
  statusMeta,
  type Priority,
} from "@/lib/domain";
import { shortDate } from "@/lib/format";
import { Avatar, type PersonLike } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PriorityGlyph, ProgressGlyph, TONE_VAR } from "@/components/ui/glyphs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";

/**
 * Selectores compartidos.
 *
 * Todos siguen el mismo patrón: un disparador que se lee como texto (no como
 * un campo de formulario) y un popover corto. Elegir estado o responsable
 * tiene que costar un click, no abrir un formulario.
 */

const triggerBase =
  "inline-flex h-7 items-center gap-1.5 rounded-[var(--r-sm)] px-2 text-xs transition-colors " +
  "hover:bg-surface-2 text-ink-2 hover:text-ink border border-transparent " +
  "data-[state=open]:bg-surface-2 data-[state=open]:border-line";

// ------------------------------------------------------------------ estado

export function StatusPicker({
  type,
  value,
  progress,
  onChange,
  disabled,
  compact = false,
}: {
  type: string;
  value: string;
  progress?: number;
  onChange: (status: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const options = statusesFor(type);
  const current = statusMeta(type, value);

  if (options.length <= 1) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
        <ProgressGlyph type={type} status={value} progress={progress} size={12} />
        {!compact && current.label}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} className={cn(triggerBase, compact && "px-1.5")}>
        <ProgressGlyph type={type} status={value} progress={progress} size={13} />
        {!compact && <span className="font-medium">{current.label}</span>}
      </PopoverTrigger>
      <PopoverContent className="w-52">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-[var(--r-sm)] px-2 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ProgressGlyph type={type} status={option.value} size={13} />
            <span className="flex-1 text-left">{option.label}</span>
            {option.value === value && <Check className="size-3.5 text-accent" strokeWidth={2.4} />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// -------------------------------------------------------------- prioridad

export function PriorityPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (priority: Priority) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const current = PRIORITY_META[value as Priority] ?? PRIORITY_META.medium;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={triggerBase}>
        <PriorityGlyph priority={value} always />
        {!compact && <span>{current.label}</span>}
      </PopoverTrigger>
      <PopoverContent className="w-44">
        {[...PRIORITIES].reverse().map((priority) => (
          <button
            key={priority}
            onClick={() => {
              onChange(priority);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-[var(--r-sm)] px-2 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <PriorityGlyph priority={priority} always />
            <span className="flex-1 text-left">{PRIORITY_META[priority].label}</span>
            {priority === value && <Check className="size-3.5 text-accent" strokeWidth={2.4} />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ------------------------------------------------------------------ fecha

export function DatePicker({
  value,
  onChange,
  placeholder = "Sin fecha",
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          const el = inputRef.current;
          if (!el) return;
          // showPicker abre el calendario nativo sin mostrar un campo feo.
          // Si el navegador lo bloquea (o no lo tiene), el foco alcanza.
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
        className={triggerBase}
      >
        {value ? shortDate(value) : placeholder}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value ? value.slice(0, 10) : ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="pointer-events-none absolute inset-0 size-full opacity-0"
        tabIndex={-1}
        aria-hidden
      />
    </span>
  );
}

// ----------------------------------------------------------------- proyecto

export type ProjectOption = { id: string; name: string; depth: number; accent: string };

export function ProjectPicker({
  options,
  value,
  onChange,
  placeholder = "Elegí un proyecto",
}: {
  options: ProjectOption[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const current = options.find((o) => o.id === value);

  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={triggerBase}>
        {current ? (
          <>
            <span
              className="size-1.5 rounded-[2px]"
              style={{ background: accentHex(current.accent) }}
            />
            <span className="max-w-[180px] truncate font-medium">{current.name}</span>
          </>
        ) : (
          <span className="text-ink-3">{placeholder}</span>
        )}
        <ChevronDown className="size-3 text-ink-4" strokeWidth={2.2} />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <div className="border-b border-line-soft p-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar proyecto…"
            autoFocus
            className="h-7 w-full bg-transparent px-1.5 text-sm text-ink placeholder:text-ink-4 focus:outline-none"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-ink-4">Sin coincidencias</p>
          )}
          {filtered.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-2 rounded-[var(--r-sm)] py-1.5 pr-2 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              style={{ paddingLeft: 8 + option.depth * 12 }}
            >
              <span
                className="size-1.5 shrink-0 rounded-[2px]"
                style={{ background: accentHex(option.accent) }}
              />
              <span className="flex-1 truncate text-left">{option.name}</span>
              {option.id === value && <Check className="size-3.5 text-accent" strokeWidth={2.4} />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ------------------------------------------------------------ responsables

export type AssignmentDraft = { userId: string; weight: number };

/**
 * Responsables con porcentaje de colaboración.
 *
 * Elegir gente reparte el 100% en partes iguales. Si alguien quiere afinar el
 * reparto, edita los números y el total se muestra en vivo: mientras no sume
 * 100, el botón de repartir queda a mano.
 */
export function AssigneePicker({
  members,
  value,
  scope,
  onChange,
  align = "start",
}: {
  members: PersonLike[];
  value: AssignmentDraft[];
  scope: "individual" | "team";
  onChange: (next: { assignees: AssignmentDraft[]; scope: "individual" | "team" }) => void;
  align?: "start" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const selected = new Map(value.map((a) => [a.userId, a.weight]));
  const total = value.reduce((sum, a) => sum + a.weight, 0);

  const toggle = (userId: string) => {
    const next = selected.has(userId)
      ? value.filter((a) => a.userId !== userId)
      : [...value, { userId, weight: 0 }];
    const weights = evenWeights(next.length);
    onChange({
      assignees: next.map((a, i) => ({ ...a, weight: weights[i] })),
      scope: "individual",
    });
  };

  const setWeight = (userId: string, weight: number) => {
    onChange({
      assignees: value.map((a) => (a.userId === userId ? { ...a, weight } : a)),
      scope,
    });
  };

  const people = value
    .map((a) => members.find((m) => m.id === a.userId))
    .filter((p): p is PersonLike => Boolean(p));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={triggerBase}>
        {scope === "team" ? (
          <>
            <Users className="size-3.5" strokeWidth={2} />
            <span>Todo el equipo</span>
          </>
        ) : people.length > 0 ? (
          <>
            <span className="flex -space-x-1.5">
              {people.slice(0, 3).map((person) => (
                <Avatar key={person.id} person={person} size="xs" ring />
              ))}
            </span>
            {people.length > 3 && <span className="tabular">+{people.length - 3}</span>}
          </>
        ) : (
          <span className="text-ink-3">Sin responsable</span>
        )}
      </PopoverTrigger>

      <PopoverContent align={align} className="w-[286px] p-0">
        <button
          onClick={() => {
            onChange({ assignees: [], scope: "team" });
            setOpen(false);
          }}
          className={cn(
            "flex w-full items-center gap-2 border-b border-line-soft px-2.5 py-2 text-sm transition-colors hover:bg-surface-2",
            scope === "team" ? "text-ink" : "text-ink-2",
          )}
        >
          <span className="grid size-5 place-items-center rounded-full bg-surface-3 text-ink-3">
            <Users className="size-3" strokeWidth={2.2} />
          </span>
          <span className="flex-1 text-left">Todo el equipo</span>
          {scope === "team" && <Check className="size-3.5 text-accent" strokeWidth={2.4} />}
        </button>

        <div className="max-h-56 overflow-y-auto p-1">
          {members.map((member) => {
            const isSelected = scope === "individual" && selected.has(member.id);
            return (
              <button
                key={member.id}
                onClick={() => toggle(member.id)}
                className="flex w-full items-center gap-2 rounded-[var(--r-sm)] px-1.5 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Avatar person={member} size="sm" />
                <span className="flex-1 truncate text-left">{member.name}</span>
                {isSelected && <Check className="size-3.5 text-accent" strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>

        {scope === "individual" && value.length > 1 && (
          <div className="border-t border-line-soft p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xs font-medium uppercase tracking-wide text-ink-4">
                Colaboración
              </span>
              <span
                className="text-2xs font-semibold tabular"
                style={{ color: total === 100 ? "var(--tone-done)" : "var(--tone-progress)" }}
              >
                {total}%
              </span>
            </div>

            <div className="space-y-1.5">
              {value.map((assignment) => {
                const person = members.find((m) => m.id === assignment.userId);
                if (!person) return null;
                return (
                  <div key={assignment.userId} className="flex items-center gap-2">
                    <Avatar person={person} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-2">
                      {person.name}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={assignment.weight}
                      onChange={(e) => setWeight(assignment.userId, Number(e.target.value))}
                      className="h-1 w-20 cursor-pointer accent-[var(--accent)]"
                    />
                    <span className="w-9 text-right text-xs tabular text-ink-2">
                      {assignment.weight}%
                    </span>
                  </div>
                );
              })}
            </div>

            {total !== 100 && (
              <Button
                size="xs"
                variant="subtle"
                className="mt-2 w-full"
                onClick={() =>
                  onChange({
                    assignees: value.map((a, i) => ({
                      ...a,
                      weight: normalizeWeights(value.map((x) => x.weight))[i],
                    })),
                    scope,
                  })
                }
              >
                Ajustar para que sume 100
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Selector de progreso manual, con vuelta al cálculo automático. */
export function ProgressPicker({
  value,
  mode,
  onChange,
  hasChildren,
}: {
  value: number;
  mode: string;
  onChange: (progress: number, mode: "auto" | "manual") => void;
  hasChildren: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => setDraft(value), [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={triggerBase}>
        <span className="font-medium tabular">{value}%</span>
        {mode === "auto" && <span className="text-2xs text-ink-4">auto</span>}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-2xs font-medium uppercase tracking-wide text-ink-4">
            Progreso
          </span>
          <span className="text-sm font-semibold tabular text-ink">{draft}%</span>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={() => onChange(draft, "manual")}
          onKeyUp={() => onChange(draft, "manual")}
          className="h-1 w-full cursor-pointer accent-[var(--accent)]"
        />

        <p className="mt-2.5 text-2xs leading-relaxed text-ink-4">
          {mode === "manual"
            ? hasChildren
              ? "Estás fijando el número a mano. El cálculo por subtareas está en pausa."
              : "Estás fijando el número a mano."
            : hasChildren
              ? "Se calcula solo a partir de las subtareas."
              : "Se calcula solo a partir del estado."}
        </p>

        {mode === "manual" && (
          <Button
            size="xs"
            variant="subtle"
            className="mt-2 w-full"
            onClick={() => {
              onChange(draft, "auto");
              setOpen(false);
            }}
          >
            Volver al cálculo automático
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
