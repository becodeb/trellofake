import "server-only";

import { db } from "@/server/db";
import { personSelect } from "@/server/domain/projects";
import { itemRowSelect } from "@/server/domain/items";
import { ACTIVE_TASK_STATUSES, OPEN_TASK_STATUSES } from "@/lib/domain";

/**
 * Números del equipo.
 *
 * La regla acá es que cada número responda una pregunta que alguien se hace de
 * verdad al entrar. Si no responde nada, no va.
 */
export type TeamStats = {
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

export async function teamStats(): Promise<TeamStats> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const live = { project: { archivedAt: null } } as const;

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
    db.project.count({ where: { status: "active", archivedAt: null, parentId: null } }),
    db.project.count({ where: { status: "paused", archivedAt: null, parentId: null } }),
    db.project.count({ where: { status: "done", parentId: null } }),
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
      where: { status: "active", archivedAt: null, parentId: null },
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
export async function blockedWork(take = 5) {
  const [tasks, problems] = await Promise.all([
    db.item.findMany({
      where: {
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
export async function recentDecisions(take = 4) {
  return db.item.findMany({
    where: { type: "decision", project: { archivedAt: null } },
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
export async function recentUpdates(take = 5) {
  return db.item.findMany({
    where: { type: "update", project: { archivedAt: null } },
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

export async function teamMembers() {
  return db.membership.findMany({
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

export type TeamMember = Awaited<ReturnType<typeof teamMembers>>[number];