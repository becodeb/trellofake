import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/server/db";
import { personSelect, type Person } from "@/server/domain/projects";
import { OPEN_TASK_STATUSES, PRIORITY_META, type Priority } from "@/lib/domain";

export const itemRowSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  status: true,
  priority: true,
  dueDate: true,
  progress: true,
  progressMode: true,
  assigneeScope: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  parentId: true,
  projectId: true,
  createdBy: { select: personSelect },
  project: { select: { id: true, name: true, accent: true } },
  assignments: {
    select: {
      weight: true,
      user: { select: personSelect },
      assignedBy: { select: { id: true, name: true } },
      assignedAt: true,
    },
    orderBy: { weight: "desc" },
  },
  _count: { select: { children: true, comments: true, attachments: true } },
} as const;

export type ItemRow = Prisma.ItemGetPayload<{ select: typeof itemRowSelect }>;

export type ItemFilter = {
  projectIds?: string[];
  types?: string[];
  statuses?: string[];
  /** true = solo primer nivel (excluye subtareas) */
  rootOnly?: boolean;
  parentId?: string;
  assigneeId?: string;
  includeTeamScoped?: boolean;
  search?: string;
  take?: number;
  orderBy?: "position" | "recent" | "due" | "priority";
};

export function itemWhere(workspaceId: string, filter: ItemFilter): Prisma.ItemWhereInput {
  const where: Prisma.ItemWhereInput = { workspaceId };

  if (filter.projectIds) where.projectId = { in: filter.projectIds };
  if (filter.types) where.type = { in: filter.types };
  if (filter.statuses) where.status = { in: filter.statuses };
  if (filter.rootOnly) where.parentId = null;
  if (filter.parentId) where.parentId = filter.parentId;
  if (filter.search) where.title = { contains: filter.search };

  if (filter.assigneeId) {
    const mine: Prisma.ItemWhereInput[] = [
      { assignments: { some: { userId: filter.assigneeId } } },
    ];
    if (filter.includeTeamScoped) mine.push({ assigneeScope: "team" });
    where.OR = mine;
  }

  return where;
}

function orderFor(kind: ItemFilter["orderBy"]): Prisma.ItemOrderByWithRelationInput[] {
  switch (kind) {
    case "recent":
      return [{ updatedAt: "desc" }];
    case "due":
      return [{ dueDate: { sort: "asc", nulls: "last" } }, { position: "asc" }];
    case "priority":
      return [{ position: "asc" }];
    default:
      return [{ position: "asc" }, { createdAt: "desc" }];
  }
}

export async function listItems(workspaceId: string, filter: ItemFilter = {}) {
  const rows = await db.item.findMany({
    where: itemWhere(workspaceId, filter),
    select: itemRowSelect,
    orderBy: orderFor(filter.orderBy),
    take: filter.take,
  });

  // Prisma no ordena por prioridad semántica (es un string), así que el
  // reordenamiento final por urgencia se hace acá.
  if (filter.orderBy === "priority") return sortByUrgency(rows);
  return rows;
}

/** Vencidas primero, después por fecha, después por prioridad. */
export function sortByUrgency<T extends { dueDate: Date | null; priority: string; status: string }>(
  items: T[],
): T[] {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const aOverdue = a.dueDate && a.dueDate.getTime() < now && a.status !== "done";
    const bOverdue = b.dueDate && b.dueDate.getTime() < now && b.status !== "done";
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

    const pa = PRIORITY_META[a.priority as Priority]?.rank ?? 1;
    const pb = PRIORITY_META[b.priority as Priority]?.rank ?? 1;
    if (pa !== pb) return pb - pa;

    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}

/** Item con todo su contexto: subtareas, comentarios, adjuntos. */
export async function getItem(workspaceId: string, itemId: string) {
  const item = await db.item.findFirst({
    where: { id: itemId, workspaceId },
    select: {
      ...itemRowSelect,
      convertedFromId: true,
      project: {
        select: { id: true, name: true, accent: true, path: true, status: true },
      },
      parent: { select: { id: true, title: true, type: true } },
      children: {
        select: itemRowSelect,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      },
      attachments: {
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          storageKey: true,
          kind: true,
          createdAt: true,
          uploader: { select: personSelect },
        },
        orderBy: { createdAt: "desc" },
      },
      comments: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          editedAt: true,
          author: { select: personSelect },
          attachments: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
              sizeBytes: true,
              storageKey: true,
              kind: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return item;
}

export type ItemDetail = NonNullable<Awaited<ReturnType<typeof getItem>>>;

/**
 * Tareas de una persona: las que tiene asignadas más las que son de todo el
 * equipo. Es la vista de "qué tengo que hacer yo".
 */
export async function myTasks(
  workspaceId: string,
  userId: string,
  options: { includeDone?: boolean; take?: number } = {},
) {
  const rows = await db.item.findMany({
    where: {
      workspaceId,
      type: "task",
      project: { archivedAt: null },
      ...(options.includeDone ? {} : { status: { in: OPEN_TASK_STATUSES } }),
      OR: [{ assignments: { some: { userId } } }, { assigneeScope: "team" }],
    },
    select: itemRowSelect,
    take: options.take,
  });
  return sortByUrgency(rows);
}

export type MyTaskBuckets = {
  overdue: ItemRow[];
  today: ItemRow[];
  week: ItemRow[];
  later: ItemRow[];
  noDate: ItemRow[];
  blocked: ItemRow[];
};

/** Agrupa las tareas por urgencia real, no por proyecto. */
export function bucketTasks(tasks: ItemRow[]): MyTaskBuckets {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(endOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const buckets: MyTaskBuckets = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    noDate: [],
    blocked: [],
  };

  for (const task of tasks) {
    if (task.status === "blocked") buckets.blocked.push(task);
    else if (!task.dueDate) buckets.noDate.push(task);
    else if (task.dueDate < startOfToday) buckets.overdue.push(task);
    else if (task.dueDate <= endOfToday) buckets.today.push(task);
    else if (task.dueDate <= endOfWeek) buckets.week.push(task);
    else buckets.later.push(task);
  }

  return buckets;
}

/** Reparte el trabajo abierto del workspace por persona. */
export async function workloadByPerson(workspaceId: string) {
  const [members, tasks] = await Promise.all([
    db.membership.findMany({
      where: { workspaceId },
      select: { user: { select: personSelect } },
    }),
    db.item.findMany({
      where: {
        workspaceId,
        type: "task",
        status: { in: OPEN_TASK_STATUSES },
        project: { archivedAt: null },
      },
      select: {
        status: true,
        dueDate: true,
        assignments: { select: { userId: true } },
      },
    }),
  ]);

  const now = new Date();
  const stats = new Map<
    string,
    { person: Person; open: number; inProgress: number; overdue: number; blocked: number }
  >();
  for (const m of members) {
    stats.set(m.user.id, {
      person: m.user,
      open: 0,
      inProgress: 0,
      overdue: 0,
      blocked: 0,
    });
  }

  for (const task of tasks) {
    for (const assignment of task.assignments) {
      const bucket = stats.get(assignment.userId);
      if (!bucket) continue;
      bucket.open += 1;
      if (task.status === "in_progress" || task.status === "in_review") bucket.inProgress += 1;
      if (task.status === "blocked") bucket.blocked += 1;
      if (task.dueDate && task.dueDate < now) bucket.overdue += 1;
    }
  }

  return Array.from(stats.values()).sort((a, b) => b.open - a.open);
}
