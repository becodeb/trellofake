import * as React from "react";
import Link from "next/link";
import { GitBranch, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/cn";
import { PROJECT_STATUS_META, accentHex, type ProjectStatus } from "@/lib/domain";
import { dueState, relativeTime } from "@/lib/format";
import { AvatarStack } from "@/components/ui/avatar";
import { PriorityGlyph, ProgressBar, ToneDot } from "@/components/ui/glyphs";
import type { ProjectCard as ProjectCardData } from "@/server/domain/projects";

/**
 * Tarjeta de proyecto.
 *
 * Contesta cinco preguntas sin que haya que entrar: cómo se llama, cómo va,
 * quién está adentro, qué tan trabado está y cuándo fue la última señal de
 * vida. La portada existe para reconocerlo de un vistazo, no para decorar: si
 * no hay imagen, el color del proyecto hace de identidad.
 */
export function ProjectCard({
  project,
  slug,
  className,
}: {
  project: ProjectCardData;
  slug: string;
  className?: string;
}) {
  const accent = accentHex(project.accent);
  const status = PROJECT_STATUS_META[project.status as ProjectStatus];
  const people = project.members.map((m) => m.user);
  const due = dueState(project.targetDate, status?.closed);
  const { rollup } = project;

  return (
    <Link
      href={`/w/${slug}/p/${project.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface",
        "transition-[border-color,box-shadow,transform] duration-150",
        "hover:-translate-y-px hover:border-line-strong hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      <Cover project={project} accent={accent} />

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-md font-semibold leading-snug tracking-tight text-ink">
            {project.name}
          </h3>
          <PriorityGlyph priority={project.priority} className="mt-1 shrink-0" />
        </div>

        {project.description && (
          <p className="mt-1.5 text-xs leading-relaxed text-ink-3 clamp-2">
            {project.description}
          </p>
        )}

        <div className="mt-3.5 flex items-center gap-2">
          <ProgressBar
            value={project.progress}
            tone={project.progress === 100 ? "done" : "progress"}
            className="flex-1"
          />
          <span className="text-2xs font-medium tabular text-ink-3">{project.progress}%</span>
        </div>

        <div className="mt-2.5 flex items-center gap-2.5 text-2xs text-ink-4">
          <span className="inline-flex items-center gap-1.5">
            <ToneDot tone={status?.tone ?? "neutral"} />
            {status?.label ?? project.status}
          </span>

          {rollup.total > 0 && (
            <span className="tabular">
              {rollup.done}/{rollup.total} tareas
            </span>
          )}

          {project._count.children > 0 && (
            <span className="inline-flex items-center gap-1">
              <GitBranch className="size-3" strokeWidth={2} />
              {project._count.children}
            </span>
          )}

          {rollup.blocked > 0 && (
            <span
              className="inline-flex items-center gap-1 font-medium"
              style={{ color: "var(--tone-blocked)" }}
              title={`${rollup.blocked} tarea(s) bloqueada(s)`}
            >
              <TriangleAlert className="size-3" strokeWidth={2.2} />
              {rollup.blocked}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3.5">
          <AvatarStack people={people} size="sm" />

          <span className="text-right text-2xs leading-tight text-ink-4">
            {project.lastActivity ? (
              <>
                <span className="block">{relativeTime(project.lastActivity.createdAt)}</span>
                <span className="block max-w-[130px] truncate opacity-80">
                  {project.lastActivity.actor.name.split(" ")[0]}
                </span>
              </>
            ) : due.state !== "none" ? (
              <span
                className={cn(
                  due.state === "overdue" && "font-medium text-[var(--tone-blocked)]",
                )}
              >
                {due.label}
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Portada: imagen si hay, si no una franja tramada con el color del proyecto. */
function Cover({
  project,
  accent,
}: {
  project: ProjectCardData;
  accent: string;
}) {
  if (project.coverUrl) {
    return (
      <div className="relative h-24 overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={project.coverUrl}
          alt=""
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
    );
  }

  return (
    <div
      className="relative h-14 overflow-hidden"
      style={{ background: `${accent}12` }}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(-45deg, ${accent}22 0 1px, transparent 1px 9px)`,
        }}
      />
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: accent }} />
    </div>
  );
}

/** Fila compacta: para listas largas y para subproyectos. */
export function ProjectRow({
  project,
  slug,
  depth = 0,
}: {
  project: ProjectCardData;
  slug: string;
  depth?: number;
}) {
  const status = PROJECT_STATUS_META[project.status as ProjectStatus];
  const people = project.members.map((m) => m.user);
  const due = dueState(project.targetDate, status?.closed);

  return (
    <Link
      href={`/w/${slug}/p/${project.id}`}
      className="row hairline flex items-center gap-3 px-3 py-2.5"
      style={{ paddingLeft: 12 + depth * 18 }}
    >
      <span
        className="size-2 shrink-0 rounded-[3px]"
        style={{
          background: accentHex(project.accent),
          opacity: status?.closed ? 0.4 : 1,
        }}
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{project.name}</span>
        {project.description && (
          <span className="mt-0.5 block truncate text-2xs text-ink-4">
            {project.description}
          </span>
        )}
      </span>

      <span className="hidden w-28 shrink-0 items-center gap-2 sm:flex">
        <ProgressBar
          value={project.progress}
          tone={project.progress === 100 ? "done" : "progress"}
          className="flex-1"
        />
        <span className="w-7 text-right text-2xs tabular text-ink-4">{project.progress}%</span>
      </span>

      <span className="hidden w-20 shrink-0 text-2xs text-ink-4 sm:block">
        {status?.label}
      </span>

      <span className="hidden w-20 shrink-0 text-right text-2xs text-ink-4 md:block">
        {due.state === "overdue" ? (
          <span className="font-medium text-[var(--tone-blocked)]">{due.label}</span>
        ) : (
          due.label
        )}
      </span>

      <AvatarStack people={people} size="xs" max={3} className="shrink-0" />
    </Link>
  );
}
