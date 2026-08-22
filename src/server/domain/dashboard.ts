import "server-only";

import { db } from "@/server/db";
import { personSelect } from "@/server/domain/projects";
import { itemRowSelect } from "@/server/domain/items";
import { ACTIVE_TASK_STATUSES, OPEN_TASK_STATUSES } from "@/lib/domain";

/**
 * Números del workspace.
 *
 * La regla acá es que cada número responda una pregunta que alguien se hace de
 * verdad al entrar. Si no responde nada, no va.
 */
export type WorkspaceStats = {
  activeProjects: number;
  pausedProjects: number;
  finishedProjects: number;
  openTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  completedThisWeek: number;
  /** Promedio de progreso de los proyectos activos. */
  overallProgress: number;
};

export async function workspaceStats(workspaceId: string): Promise<WorkspaceStats> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const live = { workspaceId, project: { archivedAt: null } } as const;

  const [
    activeProjects,
    pausedProjects,
    finishedProjects,
    openTasks,
    inProgressTasks,
    overdueTasks,
    blockedTasks,
    completedThisWeek,
    activeProgress,
  ] = await Promise.all([
    db.project.count({ where: { workspaceId, status: "active", archivedAt: null, parentId: null } }),
    db.project.count({ where: { workspaceId, status: "paused", archivedAt: null, parentId: null } }),
    db.project.count({ where: { workspaceId, status: "done", parentId: null } }),
    db.item.count({ where: { ...live, type: "task", status: { in: OPEN_TASK_STATUSES } } }),
    db.item.count({ where: { ...live, type: "task", status: { in: ACTIVE_TASK_STATUSES } } }),
    db.item.count({
      where: {
        ...live,
        type: "task",
        status: { in: OPEN_TASK_STATUSES },
        dueDate: { lt: now },
      },
    }),
    db.item.count({ where: { ...live, type: "task", status: "blocked" } }),
    db.item.count({
      where: { ...live, type: "task", status: "done", completedAt: { gte: weekAgo } },
    }),
    db.project.aggregate({
      where: { workspaceId, status: "active", archivedAt: null, parentId: null },
      _avg: { progress: true },
    }),
  ]);

  return {
    activeProjects,
    pausedProjects,
    finishedProjects,
    openTasks,
    inProgressTasks,
    overdueTasks,
    blockedTasks,
    completedThisWeek,
    overallProgress: Math.round(activeProgress._avg.progress ?? 0),
  };
}

/** Lo que está frenado: la pregunta más urgente al entrar. */
export async function blockedWork(workspaceId: string, take = 5) {
  const [tasks, problems] = await Promise.all([
    db.item.findMany({
      where: {
        workspaceId,
        type: "task",
        status: "blocked",
        project: { archivedAt: null },
      },
      select: itemRowSelect,
      orderBy: { updatedAt: "desc" },
      take,
    }),
    db.item.findMany({
      where: {
        workspaceId,
        type: "problem",
        status: { in: ["open", "investigating"] },
        project: { archivedAt: null },
      },
      select: itemRowSelect,
      orderBy: { updatedAt: "desc" },
      take,
    }),
  ]);
  return { tasks, problems };
}

/** Decisiones recientes: la memoria que un equipo suele perder. */
export async function recentDecisions(workspaceId: string, take = 4) {
  return db.item.findMany({
    where: { workspaceId, type: "decision", project: { archivedAt: null } },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      projectId: true,
      createdBy: { select: personSelect },
      project: { select: { id: true, name: true, accent: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Últimos avances publicados por el equipo ("esto hice hoy"). */
export async function recentUpdates(workspaceId: string, take = 5) {
  return db.item.findMany({
    where: { workspaceId, type: "update", project: { archivedAt: null } },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      projectId: true,
      createdBy: { select: personSelect },
      project: { select: { id: true, name: true, accent: true } },
      _count: { select: { comments: true, attachments: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function workspaceMembers(workspaceId: string) {
  return db.membership.findMany({
    where: { workspaceId },
    select: {
      id: true,
      role: true,
      title: true,
      joinedAt: true,
      lastSeenAt: true,
      user: { select: { ...personSelect, email: true } },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
}

export type WorkspaceMember = Awaited<ReturnType<typeof workspaceMembers>>[number];
