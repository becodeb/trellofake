/**
 * Lo que cruza la frontera servidor / cliente.
 *
 * Los módulos de `src/server` están marcados `server-only`: importarlos desde
 * un componente cliente rompe el build a propósito, para que una consulta o una
 * credencial no termine en el bundle del navegador. Pero las *formas* de los
 * datos y los helpers puros sí viajan a los dos lados, y viven acá.
 *
 * Definir estos tipos a mano en vez de derivarlos de Prisma también documenta
 * exactamente qué campos cruzan: si mañana la tabla suma una columna sensible,
 * no aparece sola en el cliente.
 */

export type Person = {
  id: string;
  name: string;
  avatarUrl: string | null;
  accentColor: string;
};

// ------------------------------------------------------------------ actividad

export type ActivityEvent = {
  id: string;
  verb: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  /** JSON serializado con el detalle del cambio. */
  meta: string | null;
  createdAt: Date;
  actor: Person;
  project: { id: string; name: string; accent: string } | null;
  item: { id: string; type: string; title: string; projectId: string } | null;

  /** Presentes solo cuando el evento llega por el feed personal. */
  reason?: string;
  direct?: boolean;
  read?: boolean;
  entryId?: string;
};

/** Agrupa eventos por día para renderizar timelines con encabezados. */
export function groupByDay<T extends { createdAt: Date }>(events: T[]) {
  const groups: Array<{ key: string; date: Date; events: T[] }> = [];
  for (const event of events) {
    const d = event.createdAt;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.events.push(event);
    else groups.push({ key, date: d, events: [event] });
  }
  return groups;
}

/**
 * Colapsa rachas del mismo actor sobre el mismo objeto: cambiar el estado tres
 * veces seguidas debe leerse como un movimiento, no como tres líneas.
 */
export function collapseNoise<T extends ActivityEvent>(events: T[]): T[] {
  const out: T[] = [];
  for (const event of events) {
    const previous = out[out.length - 1];
    const sameThing =
      previous &&
      previous.actor.id === event.actor.id &&
      previous.verb === event.verb &&
      previous.targetId === event.targetId &&
      Math.abs(previous.createdAt.getTime() - event.createdAt.getTime()) < 5 * 60 * 1000;
    if (!sameThing) out.push(event);
  }
  return out;
}

// ------------------------------------------------------------------ búsqueda

export type SearchKind =
  | "project"
  | "task"
  | "idea"
  | "note"
  | "problem"
  | "decision"
  | "update"
  | "comment"
  | "person"
  | "file"
  | "resource";

export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  project: "Proyecto",
  task: "Tarea",
  idea: "Idea",
  note: "Nota",
  problem: "Problema",
  decision: "Decisión",
  update: "Actualización",
  comment: "Comentario",
  person: "Persona",
  file: "Archivo",
  resource: "Recurso",
};

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  excerpt: string | null;
  href: string;
  projectName: string | null;
  accent: string;
  status: string | null;
  when: Date;
  score: number;
  person?: Person;
};
