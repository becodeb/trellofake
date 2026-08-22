import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import { ACTIVITY, ITEM_TYPE_META, PRIORITY_META, accentHex, statusMeta, type ItemType, type Priority } from "@/lib/domain";
import { dayHeading, relativeTime, timeOfDay } from "@/lib/format";
import { groupByDay, type ActivityEvent } from "@/lib/shared";
import { Avatar } from "@/components/ui/avatar";
import { Divider } from "@/components/ui/layout";

/**
 * El historial en palabras.
 *
 * Cada evento guardado se traduce acá a una frase en español. Es lo que
 * convierte una tabla de registros en la memoria del proyecto: "Juan pasó la
 * ficha de producto a En revisión" se lee, "item.status_changed" no.
 *
 * Cuando el evento es tuyo o te involucra, la frase cambia de persona: "te
 * asignaron", "te mencionó". Esa diferencia es lo que hace que el feed
 * personal se sienta personal.
 */

const ARTICLE: Record<ItemType, string> = {
  task: "la tarea",
  idea: "la idea",
  note: "la nota",
  problem: "el problema",
  decision: "la decisión",
  update: "la actualización",
};

function parseMeta(meta: string | null): Record<string, unknown> {
  if (!meta) return {};
  try {
    return JSON.parse(meta) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function Target({
  event,
  slug,
}: {
  event: ActivityEvent;
  slug: string;
}) {
  const projectId = event.item?.projectId ?? event.project?.id;
  if (!projectId) return <Strong>{event.targetLabel}</Strong>;

  const href = event.item
    ? `/w/${slug}/p/${projectId}?item=${event.item.id}`
    : `/w/${slug}/p/${projectId}`;

  return (
    <Link
      href={href}
      className="font-medium text-ink decoration-line-strong underline-offset-2 hover:underline"
    >
      {event.targetLabel}
    </Link>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-ink">{children}</span>;
}

/** Traduce un evento a la frase que lo describe. */
export function describe(
  event: ActivityEvent,
  slug: string,
  currentUserId: string,
): React.ReactNode {
  const meta = parseMeta(event.meta);
  const target = <Target event={event} slug={slug} />;
  const itemType = (event.item?.type ?? (meta.type as string) ?? "task") as ItemType;
  const article = ARTICLE[itemType] ?? "el elemento";
  const mine = event.actor.id === currentUserId;

  switch (event.verb) {
    case ACTIVITY.projectCreated:
      return (
        <>
          creó {meta.subproject ? "el subproyecto" : "el proyecto"} {target}
        </>
      );

    case ACTIVITY.projectUpdated: {
      const fields = (meta.fields as string[] | undefined) ?? [];
      if (fields.length === 1 && fields[0] === "portada")
        return <>cambió la portada de {target}</>;
      return (
        <>
          actualizó {target}
          {fields.length > 0 && <Muted> · {fields.join(", ")}</Muted>}
        </>
      );
    }

    case ACTIVITY.projectStatusChanged:
      return (
        <>
          pasó {target} a <Strong>{projectStatusLabel(meta.to as string)}</Strong>
        </>
      );

    case ACTIVITY.projectArchived:
      return (
        <>
          {meta.to === "cancelled" ? "canceló" : "dio por terminado"} {target}
          <Muted> · pasó al archivo</Muted>
        </>
      );

    case ACTIVITY.projectRestored:
      return <>retomó {target}</>;

    case ACTIVITY.projectProgress:
      return (
        <>
          movió el progreso de {target} a <Strong>{String(meta.to)}%</Strong>
        </>
      );

    case ACTIVITY.projectMemberAdded:
      return (
        <>
          sumó a <Strong>{String(meta.person ?? "alguien")}</Strong> a {target}
        </>
      );

    case ACTIVITY.linkAdded:
      return <>agregó el recurso {target}</>;

    case ACTIVITY.linkRemoved:
      return <>quitó el recurso {target}</>;

    case ACTIVITY.itemCreated:
      return (
        <>
          creó {article} {target}
        </>
      );

    case ACTIVITY.subtaskAdded:
      return (
        <>
          agregó la subtarea {target}
          {meta.parent ? <Muted> en {String(meta.parent)}</Muted> : null}
        </>
      );

    case ACTIVITY.itemCompleted:
      return <>completó {target}</>;

    case ACTIVITY.itemReopened:
      return <>reabrió {target}</>;

    case ACTIVITY.itemStatusChanged:
      return (
        <>
          pasó {target} a{" "}
          <Strong>{String(meta.toLabel ?? statusMeta(itemType, String(meta.to)).label)}</Strong>
        </>
      );

    case ACTIVITY.itemProgressChanged:
      return (
        <>
          puso {target} en <Strong>{String(meta.to)}%</Strong>
        </>
      );

    case ACTIVITY.itemAssigned: {
      if (meta.team) return <>asignó {target} a todo el equipo</>;
      const people = (meta.people as string[] | undefined) ?? [];
      // Asignarse algo a uno mismo no es "asignar a alguien".
      if (people.length === 1 && people[0] === event.actor.name) {
        return <>se asignó {target}</>;
      }
      const toMe = event.reason === "assigned" && !mine;
      if (toMe && people.length <= 1) return <>te asignó {target}</>;
      return (
        <>
          asignó {target}
          {people.length > 0 && <> a <Strong>{people.join(", ")}</Strong></>}
        </>
      );
    }

    case ACTIVITY.itemUnassigned:
      return <>quitó responsables de {target}</>;

    case ACTIVITY.itemWeightsChanged:
      return (
        <>
          cambió el reparto de {target}
          {Array.isArray(meta.split) && (
            <Muted> · {(meta.split as string[]).join(" · ")}</Muted>
          )}
        </>
      );

    case ACTIVITY.itemPriorityChanged:
      return (
        <>
          marcó {target} como{" "}
          <Strong>
            {(PRIORITY_META[meta.to as Priority] ?? PRIORITY_META.medium).label.toLowerCase()}
          </Strong>
        </>
      );

    case ACTIVITY.itemDueChanged:
      return meta.to ? (
        <>cambió la fecha límite de {target}</>
      ) : (
        <>sacó la fecha límite de {target}</>
      );

    case ACTIVITY.itemConverted:
      return <>convirtió una idea en la tarea {target}</>;

    case ACTIVITY.itemDeleted:
      return (
        <>
          borró {article} <Strong>{event.targetLabel}</Strong>
        </>
      );

    case ACTIVITY.itemUpdated:
      return meta.renamed ? <>renombró {target}</> : <>editó {target}</>;

    case ACTIVITY.commentAdded:
      return <>comentó en {target}</>;

    case ACTIVITY.mentioned: {
      const mentions = (meta.mentions as string[] | undefined) ?? [];
      if (mentions.includes(currentUserId)) return <>te mencionó en {target}</>;
      return <>comentó en {target}</>;
    }

    case ACTIVITY.fileUploaded: {
      const count = Number(meta.count ?? 1);
      return (
        <>
          subió {count === 1 ? "un archivo" : `${count} archivos`} a {target}
          {Array.isArray(meta.filenames) && meta.filenames.length > 0 && (
            <Muted> · {(meta.filenames as string[]).join(", ")}</Muted>
          )}
        </>
      );
    }

    case ACTIVITY.memberJoined:
      return (
        <>
          sumó a <Strong>{event.targetLabel}</Strong> al equipo
        </>
      );

    case ACTIVITY.memberRoleChanged:
      return (
        <>
          cambió el rol de <Strong>{event.targetLabel}</Strong> a{" "}
          <Strong>{meta.to === "admin" ? "Admin" : "Miembro"}</Strong>
        </>
      );

    case ACTIVITY.memberRemoved:
      return (
        <>
          sacó a <Strong>{event.targetLabel}</Strong> del equipo
        </>
      );

    default:
      return <>tocó {target}</>;
  }
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-ink-4">{children}</span>;
}

function projectStatusLabel(status: string) {
  return (
    { active: "Activo", paused: "En pausa", done: "Terminado", cancelled: "Cancelado" }[
      status
    ] ?? status
  );
}

// ------------------------------------------------------------------ una línea

export function ActivityLine({
  event,
  slug,
  currentUserId,
  showProject = true,
  showTime = "relative",
}: {
  event: ActivityEvent;
  slug: string;
  currentUserId: string;
  showProject?: boolean;
  showTime?: "relative" | "clock";
}) {
  const meta = parseMeta(event.meta);
  const excerpt = typeof meta.excerpt === "string" ? meta.excerpt : null;
  const isComment =
    event.verb === ACTIVITY.commentAdded || event.verb === ACTIVITY.mentioned;
  const unread = event.read === false;

  return (
    <div className="group relative flex gap-2.5 py-2">
      {/* Punto de no leído: aparece solo cuando hay algo nuevo para vos. */}
      {unread && (
        <span
          className="absolute -left-3 top-[15px] size-1.5 rounded-full bg-accent"
          aria-label="Sin leer"
        />
      )}

      <Avatar person={event.actor} size="sm" className="mt-px" />

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-ink-2">
          <span className="font-medium text-ink">{event.actor.name.split(" ")[0]}</span>{" "}
          {describe(event, slug, currentUserId)}
        </p>

        {isComment && excerpt && (
          <p className="mt-1 border-l-2 border-line pl-2.5 text-xs leading-relaxed text-ink-3 clamp-2">
            {excerpt}
          </p>
        )}

        <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-4">
          {showTime === "clock" ? timeOfDay(event.createdAt) : relativeTime(event.createdAt)}
          {showProject && event.project && (
            <>
              <span className="opacity-50">·</span>
              <Link
                href={`/w/${slug}/p/${event.project.id}`}
                className="inline-flex items-center gap-1 hover:text-ink-2"
              >
                <span
                  className="size-1.5 rounded-[2px]"
                  style={{ background: accentHex(event.project.accent) }}
                />
                {event.project.name}
              </Link>
            </>
          )}
          {event.item && ITEM_TYPE_META[event.item.type as ItemType] && (
            <>
              <span className="opacity-50">·</span>
              {ITEM_TYPE_META[event.item.type as ItemType].label}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- línea de tiempo

export function ActivityTimeline({
  events,
  slug,
  currentUserId,
  showProject = true,
  className,
}: {
  events: ActivityEvent[];
  slug: string;
  currentUserId: string;
  showProject?: boolean;
  className?: string;
}) {
  const days = groupByDay(events);

  return (
    <div className={cn("space-y-5", className)}>
      {days.map((day) => (
        <section key={day.key}>
          <Divider label={dayHeading(day.date)} className="mb-1" />
          <div className="pl-0.5">
            {day.events.map((event) => (
              <ActivityLine
                key={event.id}
                event={event}
                slug={slug}
                currentUserId={currentUserId}
                showProject={showProject}
                showTime="clock"
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
