import "server-only";

import { db } from "@/server/db";
import { personSelect } from "@/server/domain/projects";
import type { ActivityEvent } from "@/lib/shared";

export { groupByDay, collapseNoise, type ActivityEvent } from "@/lib/shared";

/**
 * Lecturas del registro de actividad.
 *
 * Hay tres formas de mirar lo mismo:
 *   - `personalFeed`  qué me toca a mí (lee FeedEntry, ya filtrado en escritura)
 *   - `teamFeed`      qué pasó en el equipo (lee Activity directo)
 *   - `projectHistory` la memoria de un proyecto y sus subproyectos
 */

const activitySelect = {
  id: true,
  verb: true,
  targetType: true,
  targetId: true,
  targetLabel: true,
  meta: true,
  createdAt: true,
  actor: { select: personSelect },
  project: { select: { id: true, name: true, accent: true } },
  item: { select: { id: true, type: true, title: true, projectId: true } },
} as const;

export async function personalFeed(
  userId: string,
  options: { take?: number; unreadOnly?: boolean; before?: Date } = {},
): Promise<ActivityEvent[]> {
  const entries = await db.feedEntry.findMany({
    where: {
      userId,
      ...(options.unreadOnly ? { readAt: null } : {}),
      ...(options.before ? { createdAt: { lt: options.before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 40,
    select: {
      id: true,
      reason: true,
      direct: true,
      readAt: true,
      activity: { select: activitySelect },
    },
  });

  return entries.map((entry) => ({
    ...entry.activity,
    reason: entry.reason,
    direct: entry.direct,
    read: entry.readAt !== null,
    entryId: entry.id,
  }));
}

export async function teamFeed(
  options: { take?: number; before?: Date } = {},
): Promise<ActivityEvent[]> {
  return db.activity.findMany({
    where: {
      ...(options.before ? { createdAt: { lt: options.before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 60,
    select: activitySelect,
  });
}

/** Historial de un proyecto incluyendo el de sus subproyectos. */
export async function projectHistory(
  projectIds: string[],
  options: { take?: number; before?: Date } = {},
): Promise<ActivityEvent[]> {
  if (projectIds.length === 0) return [];
  return db.activity.findMany({
    where: {
      projectId: { in: projectIds },
      ...(options.before ? { createdAt: { lt: options.before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 80,
    select: activitySelect,
  });
}

export async function itemHistory(itemId: string, take = 30): Promise<ActivityEvent[]> {
  return db.activity.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
    take,
    select: activitySelect,
  });
}

export type FeedCounts = {
  /** Novedades sin leer que me involucran. */
  unread: number;
  /** De esas, cuántas son directas (asignación, mención, respuesta). */
  direct: number;
  /** Movimiento del equipo desde mi última visita. */
  sinceLastVisit: number;
};

export async function feedCounts(
  userId: string,
  lastSeenAt: Date,
): Promise<FeedCounts> {
  const [unread, direct, sinceLastVisit] = await Promise.all([
    db.feedEntry.count({ where: { userId, readAt: null } }),
    db.feedEntry.count({ where: { userId, readAt: null, direct: true } }),
    db.activity.count({
      where: { createdAt: { gt: lastSeenAt }, actorId: { not: userId } },
    }),
  ]);
  return { unread, direct, sinceLastVisit };
}

export async function markFeedRead(
  userId: string,
  entryId?: string,
) {
  await db.feedEntry.updateMany({
    where: {
      userId,
      readAt: null,
      ...(entryId ? { id: entryId } : {}),
    },
    data: { readAt: new Date() },
  });
}