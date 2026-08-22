import "server-only";

import { db } from "@/server/db";
import { statusMeta } from "@/lib/domain";

/**
 * Progreso.
 *
 * Reglas, en orden de precedencia:
 *
 *   Tarea
 *     1. Si el estado es terminal y vale 100 (completada) -> 100. Cerrar algo
 *        siempre significa 100, incluso en modo manual.
 *     2. Modo manual -> se respeta el número que puso la persona.
 *     3. Con subtareas -> promedio del progreso de las subtareas. Cinco
 *        subtareas con tres cerradas dan 60.
 *     4. Sin subtareas -> peso implícito del estado (0 / 40 / 80 / 100).
 *
 *   Proyecto
 *     1. Modo manual -> se respeta.
 *     2. Modo auto -> promedio de sus subproyectos directos y sus tareas de
 *        primer nivel, contando cada uno como una unidad. Un subproyecto pesa
 *        lo mismo que una tarea suelta, que es como lo lee un equipo.
 *
 * El valor se guarda (`Item.progress`, `Project.progress`) en lugar de
 * calcularse al leer: el dashboard muestra decenas de proyectos y no puede
 * recorrer el árbol entero en cada render.
 */

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function computeItemProgress(itemId: string): Promise<number> {
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: {
      type: true,
      status: true,
      progressMode: true,
      progress: true,
      children: { select: { progress: true, status: true, type: true } },
    },
  });
  if (!item) return 0;

  const meta = statusMeta(item.type, item.status);
  if (meta.terminal && meta.weight === 100) return 100;
  if (meta.discarded) return 0;

  if (item.progressMode === "manual") return clamp(item.progress);

  if (item.children.length > 0) {
    return avg(
      item.children.map((child) => {
        const childMeta = statusMeta(child.type, child.status);
        if (childMeta.terminal && childMeta.weight === 100) return 100;
        return clamp(child.progress);
      }),
    );
  }

  return meta.weight;
}

/** Recalcula un item y propaga hacia arriba (subtarea -> tarea -> proyecto). */
export async function refreshItem(itemId: string): Promise<void> {
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { id: true, parentId: true, projectId: true },
  });
  if (!item) return;

  const progress = await computeItemProgress(itemId);
  await db.item.update({ where: { id: itemId }, data: { progress } });

  if (item.parentId) {
    await refreshItem(item.parentId);
    return;
  }
  await refreshProject(item.projectId);
}

export async function computeProjectProgress(projectId: string): Promise<number> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { progressMode: true, progress: true, status: true },
  });
  if (!project) return 0;
  if (project.status === "done") return 100;
  if (project.progressMode === "manual") return clamp(project.progress);

  const [children, tasks] = await Promise.all([
    db.project.findMany({
      where: { parentId: projectId, status: { not: "cancelled" } },
      select: { progress: true },
    }),
    db.item.findMany({
      where: { projectId, type: "task", parentId: null },
      select: { progress: true, status: true, type: true },
    }),
  ]);

  const units = [
    ...children.map((c) => clamp(c.progress)),
    ...tasks.map((t) => {
      const meta = statusMeta(t.type, t.status);
      return meta.terminal && meta.weight === 100 ? 100 : clamp(t.progress);
    }),
  ];

  return avg(units);
}

/** Recalcula un proyecto y propaga hacia sus ancestros. */
export async function refreshProject(projectId: string): Promise<void> {
  const progress = await computeProjectProgress(projectId);
  const project = await db.project.update({
    where: { id: projectId },
    data: { progress },
    select: { parentId: true },
  });
  if (project.parentId) await refreshProject(project.parentId);
}

/**
 * Resumen de tareas de un subárbol de proyectos, en una sola query.
 * Alimenta las barras de progreso y los contadores del dashboard.
 */
export type TaskRollup = {
  total: number;
  done: number;
  open: number;
  inProgress: number;
  blocked: number;
  overdue: number;
};

export function emptyRollup(): TaskRollup {
  return { total: 0, done: 0, open: 0, inProgress: 0, blocked: 0, overdue: 0 };
}

export async function taskRollupByProject(
  projectIds: string[],
): Promise<Map<string, TaskRollup>> {
  const result = new Map<string, TaskRollup>();
  if (projectIds.length === 0) return result;

  const rows = await db.item.findMany({
    where: { projectId: { in: projectIds }, type: "task" },
    select: { projectId: true, status: true, dueDate: true },
  });

  const now = new Date();
  for (const id of projectIds) result.set(id, emptyRollup());

  for (const row of rows) {
    const bucket = result.get(row.projectId);
    if (!bucket) continue;
    bucket.total += 1;
    if (row.status === "done") {
      bucket.done += 1;
      continue;
    }
    bucket.open += 1;
    if (row.status === "in_progress" || row.status === "in_review")
      bucket.inProgress += 1;
    if (row.status === "blocked") bucket.blocked += 1;
    if (row.dueDate && row.dueDate < now) bucket.overdue += 1;
  }

  return result;
}

export function mergeRollups(rollups: TaskRollup[]): TaskRollup {
  return rollups.reduce((acc, r) => {
    acc.total += r.total;
    acc.done += r.done;
    acc.open += r.open;
    acc.inProgress += r.inProgress;
    acc.blocked += r.blocked;
    acc.overdue += r.overdue;
    return acc;
  }, emptyRollup());
}
