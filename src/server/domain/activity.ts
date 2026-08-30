import "server-only";

import { db } from "@/server/db";
import {
  DIRECT_REASONS,
  type ActivityVerb,
  type FeedReason,
} from "@/lib/domain";

/**
 * Actividad.
 *
 * Cada acción que cambia el estado del mundo escribe un evento. El historial de
 * un proyecto y el feed personal se arman leyendo estos eventos: nadie tiene
 * que anotar manualmente lo que pasó.
 *
 * El evento se escribe una vez y se reparte (fan-out) a las personas para las
 * que es relevante. Esa fila por persona (`FeedEntry`) es lo que permite
 * responder "qué pasó desde tu última visita" con un índice en lugar de
 * recalcular pertenencias en cada lectura.
 */

/** Cuanto más chico el número, más fuerte el motivo por el que te llega. */
const REASON_RANK: Record<FeedReason, number> = {
  mentioned: 0,
  assigned: 1,
  reply: 2,
  author: 3,
  participant: 4,
};

export type RecordActivityInput = {
  actorId: string;
  verb: ActivityVerb;
  targetType:
    | "project"
    | "doc"
    | "item"
    | "comment"
    | "member"
    | "link"
    | "file"
    | "proposal"
    | "resource";
  targetId: string;
  targetLabel: string;
  projectId?: string | null;
  itemId?: string | null;
  meta?: Record<string, unknown> | null;
  /** Destinatarios extra con motivo explícito (ej. menciones recién parseadas). */
  audience?: Array<{ userId: string; reason: FeedReason }>;
};

export async function recordActivity(input: RecordActivityInput) {
  const activity = await db.activity.create({
    data: {
      actorId: input.actorId,
      verb: input.verb,
      projectId: input.projectId ?? null,
      itemId: input.itemId ?? null,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel.slice(0, 200),
      meta: input.meta ? JSON.stringify(input.meta) : null,
    },
    select: { id: true },
  });

  await fanOut({
    activityId: activity.id,
    actorId: input.actorId,
    projectId: input.projectId ?? null,
    itemId: input.itemId ?? null,
    extra: input.audience ?? [],
  });

  return activity.id;
}

/**
 * Resuelve a quién le importa este evento. Cada persona recibe una sola
 * entrada, con el motivo más fuerte que le corresponda.
 */
async function fanOut(args: {
  activityId: string;
  actorId: string;
  projectId: string | null;
  itemId: string | null;
  extra: Array<{ userId: string; reason: FeedReason }>;
}) {
  const candidates = new Map<string, FeedReason>();

  const add = (userId: string, reason: FeedReason) => {
    if (userId === args.actorId) return; // nadie se notifica a sí mismo
    const current = candidates.get(userId);
    if (!current || REASON_RANK[reason] < REASON_RANK[current]) {
      candidates.set(userId, reason);
    }
  };

  for (const entry of args.extra) add(entry.userId, entry.reason);

  if (args.itemId) {
    const item = await db.item.findUnique({
      where: { id: args.itemId },
      select: {
        createdById: true,
        assigneeScope: true,
        assignments: { select: { userId: true } },
        comments: { select: { authorId: true }, distinct: ["authorId"] },
      },
    });

    if (item) {
      for (const a of item.assignments) add(a.userId, "assigned");
      for (const c of item.comments) add(c.authorId, "reply");
      add(item.createdById, "author");

      // Una tarea del equipo le llega a todo el equipo como asignada.
      if (item.assigneeScope === "team") {
        const members = await db.membership.findMany({
          select: { userId: true },
        });
        for (const m of members) add(m.userId, "assigned");
      }
    }
  }

  if (args.projectId) {
    const members = await db.projectMember.findMany({
      where: { projectId: args.projectId },
      select: { userId: true },
    });
    for (const m of members) add(m.userId, "participant");
  }

  if (candidates.size === 0) return;

  await db.feedEntry.createMany({
    data: Array.from(candidates, ([userId, reason]) => ({
      userId,
      activityId: args.activityId,
      reason,
      direct: DIRECT_REASONS.includes(reason),
    })),
  });
}

/**
 * Menciones: `@Nombre` dentro de un comentario o descripción.
 * Se resuelven contra los miembros del equipo, no contra texto libre, para
 * que una mención siempre apunte a una persona real.
 */
export function parseMentions(
  body: string,
  members: Array<{ userId: string; name: string }>,
): string[] {
  if (!body.includes("@")) return [];
  const found = new Set<string>();
  const lower = body.toLowerCase();

  for (const member of members) {
    const first = member.name.split(/\s+/)[0]?.toLowerCase();
    const full = member.name.toLowerCase();
    if (!first) continue;
    if (lower.includes(`@${full}`) || lower.includes(`@${first}`)) {
      found.add(member.userId);
    }
  }
  return Array.from(found);
}

/** Marca el equipo como visto: mueve la línea de "novedades". */
export async function touchLastSeen(membershipId: string) {
  await db.membership.update({
    where: { id: membershipId },
    data: { lastSeenAt: new Date() },
  });
}
