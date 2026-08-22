"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ImagePlus,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";

import { cn } from "@/lib/cn";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_META,
  accentHex,
  type Priority,
  type ProjectStatus,
} from "@/lib/domain";
import { dueState, longDate, pluralize } from "@/lib/format";
import {
  deleteProject,
  restoreProject,
  setProjectMembers,
  setProjectProgress,
  setProjectStatus,
  updateProject,
} from "@/server/actions/projects";
import { uploadCover } from "@/server/actions/files";
import type { ProjectDetail } from "@/server/domain/projects";
import { Avatar, type PersonLike } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AutoTextarea } from "@/components/ui/field";
import { ProgressRing, ToneDot } from "@/components/ui/glyphs";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from "@/components/ui/overlays";
import { DatePicker, PriorityPicker, ProgressPicker } from "@/components/app/pickers";
import { NewProjectButton } from "@/components/app/new-project";

/**
 * Encabezado del proyecto.
 *
 * Concentra lo que define al proyecto —nombre, estado, progreso, gente,
 * fechas— y lo deja todo editable en el lugar donde se lee. Cerrar un proyecto
 * se hace desde el mismo selector de estado que lo pausa: terminar es un
 * estado más, no una acción escondida en un menú de peligro.
 */
export function ProjectHeader({
  slug,
  project,
  members,
  canManage,
  canWrite,
}: {
  slug: string;
  project: ProjectDetail;
  members: PersonLike[];
  canManage: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(project.description ?? "");
  const coverInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
  }, [project.id, project.name, project.description]);

  const status = PROJECT_STATUS_META[project.status as ProjectStatus];
  const due = dueState(project.targetDate, status?.closed);
  const rollup = project.subtreeRollup;

  const save = async (patch: Record<string, unknown>) => {
    const result = await updateProject(slug, project.id, patch);
    if (!result.ok) toast.error(result.error);
    else router.refresh();
  };

  const changeStatus = async (next: ProjectStatus) => {
    const result = await setProjectStatus(slug, project.id, next);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const meta = PROJECT_STATUS_META[next];
    toast.success(`Proyecto ${meta.label.toLowerCase()}`, {
      description: meta.closed ? "Pasó al archivo con todo su contenido." : undefined,
    });
    router.refresh();
  };

  const uploadNewCover = async (file: File | undefined) => {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    const result = await uploadCover(slug, project.id, data);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Portada actualizada");
      router.refresh();
    }
  };

  return (
    <header className="pt-4">
      {project.coverUrl && (
        <div className="group relative mb-4 h-36 overflow-hidden rounded-[var(--r-lg)] border border-line sm:h-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={project.coverUrl} alt="" className="size-full object-cover" />
          {canWrite && (
            <button
              onClick={() => coverInput.current?.click()}
              className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-[var(--r-sm)] bg-surface/90 px-2 py-1 text-2xs font-medium text-ink-2 opacity-0 shadow-[var(--shadow-sm)] backdrop-blur-sm transition-opacity group-hover:opacity-100"
            >
              <ImagePlus className="size-3" strokeWidth={2} />
              Cambiar portada
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => name.trim() && name !== project.name && save({ name: name.trim() })}
            disabled={!canWrite}
            aria-label="Nombre del proyecto"
            className="w-full bg-transparent text-2xl font-semibold tracking-tight text-ink focus:outline-none disabled:opacity-100"
          />

          <AutoTextarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() =>
              description !== (project.description ?? "") &&
              save({ description: description || null })
            }
            disabled={!canWrite}
            placeholder="¿De qué se trata este proyecto?"
            minRows={1}
            className="mt-1 max-w-prose border-0 bg-transparent px-0 text-sm focus:shadow-none"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <StatusMenu
            status={project.status}
            archived={Boolean(project.archivedAt)}
            onChange={changeStatus}
            disabled={!canWrite}
          />

          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="sm" icon aria-label="Más acciones">
                <MoreHorizontal className="size-4" strokeWidth={2} />
              </Button>
            </MenuTrigger>
            <MenuContent align="end" className="w-56">
              {canWrite && (
                <MenuItem onSelect={() => coverInput.current?.click()}>
                  <ImagePlus className="size-3.5" strokeWidth={1.9} />
                  {project.coverUrl ? "Cambiar portada" : "Poner una portada"}
                </MenuItem>
              )}

              {project.archivedAt && canManage && (
                <MenuItem
                  onSelect={async () => {
                    const result = await restoreProject(slug, project.id);
                    if (!result.ok) toast.error(result.error);
                    else {
                      toast.success("Proyecto retomado");
                      router.refresh();
                    }
                  }}
                >
                  <RotateCcw className="size-3.5" strokeWidth={1.9} />
                  Retomar proyecto
                </MenuItem>
              )}

              {canManage && (
                <>
                  <MenuSeparator />
                  <MenuLabel>Con cuidado</MenuLabel>
                  <MenuItem
                    destructive
                    onSelect={async () => {
                      const result = await deleteProject(slug, project.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Proyecto borrado");
                      router.push(`/w/${slug}/proyectos`);
                      router.refresh();
                    }}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.9} />
                    Borrar definitivamente
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
        </div>
      </div>

      {/* Línea de estado: progreso, volumen de trabajo, fechas y gente. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2.5">
          <ProgressRing value={project.progress} size={38} showLabel={false} />
          <div className="text-2xs leading-tight text-ink-4">
            <ProgressPicker
              value={project.progress}
              mode={project.progressMode}
              hasChildren={project.children.length > 0 || rollup.total > 0}
              onChange={async (progress, mode) => {
                const result = await setProjectProgress(slug, project.id, progress, mode);
                if (!result.ok) toast.error(result.error);
                else router.refresh();
              }}
            />
            <span className="block pl-2">
              {project.progressMode === "auto" ? "según tareas" : "fijado a mano"}
            </span>
          </div>
        </div>

        <Divider />

        <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-2xs text-ink-4">
          {rollup.total > 0 && (
            <Fact label="Tareas">
              <span className="tabular">
                {rollup.done}/{rollup.total}
              </span>
              {rollup.blocked > 0 && (
                <span className="ml-1.5" style={{ color: "var(--tone-blocked)" }}>
                  {rollup.blocked} frenada{rollup.blocked > 1 ? "s" : ""}
                </span>
              )}
            </Fact>
          )}

          {project.children.length > 0 && (
            <Fact label="Subproyectos">{project.children.length}</Fact>
          )}

          <Fact label="Prioridad">
            <PriorityPicker
              value={project.priority}
              onChange={(priority: Priority) => save({ priority })}
            />
          </Fact>

          <Fact label="Inicio">
            <DatePicker
              value={project.startDate ? new Date(project.startDate).toISOString() : null}
              onChange={(value) => save({ startDate: value ?? "" })}
              placeholder="Sin definir"
            />
          </Fact>

          <Fact label={project.completedAt ? "Cerrado" : "Estimado"}>
            {project.completedAt ? (
              <span className="px-2">{longDate(project.completedAt)}</span>
            ) : (
              <span
                className={cn(
                  due.state === "overdue" && "font-medium text-[var(--tone-blocked)]",
                )}
              >
                <DatePicker
                  value={project.targetDate ? new Date(project.targetDate).toISOString() : null}
                  onChange={(value) => save({ targetDate: value ?? "" })}
                  placeholder="Sin definir"
                />
              </span>
            )}
          </Fact>
        </dl>

        <Divider />

        <MemberEditor
          slug={slug}
          projectId={project.id}
          all={members}
          current={project.members.map((m) => m.user)}
          disabled={!canWrite}
        />

        {canWrite && (
          <div className="ml-auto">
            <NewProjectButton
              slug={slug}
              members={members}
              parents={[]}
              defaultParentId={project.id}
              label="Subproyecto"
              variant="default"
              size="xs"
            />
          </div>
        )}
      </div>

      {project.archivedAt && (
        <p className="mt-3 flex items-center gap-2 rounded-[var(--r-md)] border border-line bg-surface-2 px-3 py-2 text-xs text-ink-3">
          <span>
            Este proyecto está en el archivo desde el {longDate(project.archivedAt)}. Se puede
            leer todo, y se puede retomar cuando quieran.
          </span>
        </p>
      )}

      <input
        ref={coverInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void uploadNewCover(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </header>
  );
}

function Divider() {
  return <span className="hidden h-7 w-px bg-line-soft sm:block" aria-hidden />;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="leading-tight">
      <dt className="mb-0.5 pl-2 uppercase tracking-[0.06em] opacity-80">{label}</dt>
      <dd className="-ml-2 flex items-center text-ink-2">{children}</dd>
    </div>
  );
}

/** Estado del proyecto. Cada opción explica qué implica elegirla. */
function StatusMenu({
  status,
  archived,
  onChange,
  disabled,
}: {
  status: string;
  archived: boolean;
  onChange: (next: ProjectStatus) => void;
  disabled?: boolean;
}) {
  const current = PROJECT_STATUS_META[status as ProjectStatus];

  return (
    <Menu>
      <MenuTrigger asChild disabled={disabled}>
        <Button variant="default" size="sm">
          <ToneDot tone={current?.tone ?? "neutral"} />
          {current?.label ?? status}
          {archived && <span className="text-ink-4">· archivado</span>}
        </Button>
      </MenuTrigger>
      <MenuContent align="end" className="w-[268px]">
        <MenuLabel>Estado del proyecto</MenuLabel>
        {PROJECT_STATUSES.map((option) => {
          const meta = PROJECT_STATUS_META[option];
          return (
            <MenuItem
              key={option}
              onSelect={() => onChange(option)}
              className="items-start py-2"
            >
              <ToneDot tone={meta.tone} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn("font-medium", option === status && "text-ink")}>
                    {meta.label}
                  </span>
                  {option === status && (
                    <Check className="size-3 text-accent" strokeWidth={2.6} />
                  )}
                </span>
                <span className="mt-0.5 block text-2xs leading-snug text-ink-4">
                  {meta.description}
                </span>
              </span>
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}

function MemberEditor({
  slug,
  projectId,
  all,
  current,
  disabled,
}: {
  slug: string;
  projectId: string;
  all: PersonLike[];
  current: PersonLike[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const selected = new Set(current.map((p) => p.id));

  const toggle = async (userId: string) => {
    const next = selected.has(userId)
      ? current.filter((p) => p.id !== userId).map((p) => p.id)
      : [...current.map((p) => p.id), userId];

    const result = await setProjectMembers(slug, projectId, next);
    if (!result.ok) toast.error(result.error);
    else router.refresh();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Quiénes participan">
        <PopoverTrigger
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-[var(--r-sm)] px-1 py-1 transition-colors hover:bg-surface-2 disabled:pointer-events-none"
        >
          <span className="flex -space-x-1.5">
            {current.slice(0, 5).map((person) => (
              <Avatar key={person.id} person={person} size="sm" ring />
            ))}
          </span>
          {current.length === 0 && (
            <span className="flex items-center gap-1 text-2xs text-ink-4">
              <Users className="size-3" strokeWidth={2} />
              Sin gente asignada
            </span>
          )}
          {!disabled && (
            <span className="grid size-6 place-items-center rounded-full border border-dashed border-line-strong text-ink-4">
              <Plus className="size-3" strokeWidth={2.4} />
            </span>
          )}
        </PopoverTrigger>
      </Tooltip>

      <PopoverContent className="w-60">
        <MenuLabel>Quiénes participan</MenuLabel>
        {all.map((person) => (
          <button
            key={person.id}
            onClick={() => toggle(person.id)}
            className="flex w-full items-center gap-2 rounded-[var(--r-sm)] px-1.5 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Avatar person={person} size="sm" />
            <span className="flex-1 truncate text-left">{person.name}</span>
            {selected.has(person.id) && (
              <Check className="size-3.5 text-accent" strokeWidth={2.4} />
            )}
          </button>
        ))}
        <p className="px-1.5 pb-1 pt-2 text-2xs leading-relaxed text-ink-4">
          Quien participa recibe en sus novedades lo que pasa en el proyecto.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export { pluralize };
