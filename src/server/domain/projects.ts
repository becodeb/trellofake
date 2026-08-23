import "server-only";

import { db } from "@/server/db";
import { taskRollupByProject, type TaskRollup, emptyRollup } from "@/server/domain/progress";
import type { Person } from "@/lib/shared";
import { isTeamRole } from "@/lib/domain";

export type { Person } from "@/lib/shared";

/** Datos de persona que la UI necesita en todos lados. */
export const personSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  accentColor: true,
} as const;

const projectCardSelect = {
  id: true,
  name: true,
  description: true,
  coverUrl: true,
  accent: true,
  visibility: true,
  status: true,
  priority: true,
  progress: true,
  progressMode: true,
  startDate: true,
  targetDate: true,
  completedAt: true,
  archivedAt: true,
  parentId: true,
  depth: true,
  path: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: personSelect },
  members: {
    select: { role: true, user: { select: personSelect } },
    orderBy: { addedAt: "asc" },
  },
  _count: { select: { children: true, links: true, attachments: true } },
} as const;

export type ProjectCard = Awaited<ReturnType<typeof listProjects>>[number];

export type ProjectListOptions = {
  /** null = raíces, string = hijos de ese proyecto, undefined = todos */
  parentId?: string | null;
  statuses?: string[];
  archived?: boolean;
  memberId?: string;
  take?: number;
  viewer?: { role: string; userId: string };
};

function projectAccess(viewer?: { role: string; userId: string }) {
  if (!viewer || isTeamRole(viewer.role)) return {};
  return {
    AND: [
      {
        OR: [
          { visibility: "community" },
          { members: { some: { userId: viewer.userId } } },
        ],
      },
    ],
  };
}

/**
 * Listado de proyectos con todo lo que una tarjeta necesita mostrar:
 * progreso, gente, conteo de tareas y última señal de vida.
 */
export async function listProjects(
  workspaceId: string,
  options: ProjectListOptions = {},
) {
  const projects = await db.project.findMany({
    where: {
      workspaceId,
      ...(options.parentId !== undefined ? { parentId: options.parentId } : {}),
      ...(options.statuses ? { status: { in: options.statuses } } : {}),
      ...(options.archived === undefined
        ? {}
        : options.archived
          ? { archivedAt: { not: null } }
          : { archivedAt: null }),
      ...(options.memberId ? { members: { some: { userId: options.memberId } } } : {}),
      ...projectAccess(options.viewer),
    },
    select: projectCardSelect,
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take: options.take,
  });

  return decorate(projects, options.viewer);
}

/**
 * Agrega a cada proyecto el resumen de tareas de su subárbol y su última
 * actividad. El subárbol importa: un proyecto padre casi no tiene tareas
 * propias, las tiene en sus subproyectos.
 */
async function decorate<T extends { id: string; path: string }>(
  projects: T[],
  viewer?: { role: string; userId: string },
) {
  if (projects.length === 0) {
    return [] as Array<T & { rollup: TaskRollup; lastActivity: LastActivity | null; subtreeIds: string[] }>;
  }

  const roots = projects.map((p) => p.id);

  // Todos los descendientes de los proyectos pedidos, en una sola query.
  const descendants = await db.project.findMany({
    where: {
      OR: projects.map((p) => ({ path: { startsWith: `${p.path}${p.id}/` } })),
      ...projectAccess(viewer),
    },
    select: { id: true, path: true },
  });

  const subtree = new Map<string, string[]>(roots.map((id) => [id, [id]]));
  for (const child of descendants) {
    for (const root of roots) {
      if (child.path.includes(`/${root}/`)) subtree.get(root)!.push(child.id);
    }
  }

  const allIds = Array.from(new Set([...roots, ...descendants.map((d) => d.id)]));
  const rollups = await taskRollupByProject(allIds);
  const activity = await lastActivityFor(roots);

  return projects.map((project) => {
    const ids = subtree.get(project.id) ?? [project.id];
    const merged = emptyRollup();
    for (const id of ids) {
      const r = rollups.get(id);
      if (!r) continue;
      merged.total += r.total;
      merged.done += r.done;
      merged.open += r.open;
      merged.inProgress += r.inProgress;
      merged.blocked += r.blocked;
      merged.overdue += r.overdue;
    }
    return {
      ...project,
      rollup: merged,
      subtreeIds: ids,
      lastActivity: activity.get(project.id) ?? null,
    };
  });
}

export type LastActivity = {
  verb: string;
  targetLabel: string;
  createdAt: Date;
  actor: Person;
};

/**
 * Última actividad por proyecto. Son pocas filas (los proyectos visibles en
 * pantalla), así que una consulta por proyecto es más simple y más barata que
 * traer un histórico y filtrarlo en memoria.
 */
async function lastActivityFor(projectIds: string[]) {
  const entries = await Promise.all(
    projectIds.map((id) =>
      db.activity.findFirst({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        select: {
          verb: true,
          targetLabel: true,
          createdAt: true,
          actor: { select: personSelect },
        },
      }),
    ),
  );

  const map = new Map<string, LastActivity>();
  projectIds.forEach((id, i) => {
    const entry = entries[i];
    if (entry) map.set(id, entry);
  });
  return map;
}

/** Proyecto completo, con ancestros para la miga de pan y subproyectos. */
export async function getProject(
  workspaceId: string,
  projectId: string,
  viewer?: { role: string; userId: string },
) {
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId, ...projectAccess(viewer) },
    select: {
      ...projectCardSelect,
      links: {
        select: {
          id: true,
          label: true,
          url: true,
          kind: true,
          createdAt: true,
          addedBy: { select: personSelect },
        },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!project) return null;

  const ancestorIds = project.path.split("/").filter(Boolean);

  const [ancestors, children, rollupMap] = await Promise.all([
    ancestorIds.length
      ? db.project.findMany({
          where: { id: { in: ancestorIds } },
          select: { id: true, name: true, path: true, accent: true },
        })
      : Promise.resolve([]),
    listProjects(workspaceId, { parentId: projectId, viewer }),
    taskRollupByProject([projectId]),
  ]);

  // El orden del path es el orden jerárquico real.
  const ordered = ancestorIds
    .map((id) => ancestors.find((a) => a.id === id))
    .filter((a): a is (typeof ancestors)[number] => Boolean(a));

  const own = rollupMap.get(projectId) ?? emptyRollup();
  const subtree = children.reduce((acc, child) => {
    acc.total += child.rollup.total;
    acc.done += child.rollup.done;
    acc.open += child.rollup.open;
    acc.inProgress += child.rollup.inProgress;
    acc.blocked += child.rollup.blocked;
    acc.overdue += child.rollup.overdue;
    return acc;
  }, { ...own });

  return { ...project, ancestors: ordered, children, rollup: own, subtreeRollup: subtree };
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;

/** Árbol liviano para el sidebar y los selectores de proyecto. */
export async function projectTree(
  workspaceId: string,
  includeArchived = false,
  viewer?: { role: string; userId: string },
) {
  const rows = await db.project.findMany({
    where: {
      workspaceId,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...projectAccess(viewer),
    },
    select: {
      id: true,
      name: true,
      parentId: true,
      accent: true,
      status: true,
      progress: true,
      depth: true,
      position: true,
      coverUrl: true,
      visibility: true,
    },
    orderBy: [{ depth: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });

  type Node = (typeof rows)[number] & { children: Node[] };
  const byId = new Map<string, Node>();
  const roots: Node[] = [];

  for (const row of rows) byId.set(row.id, { ...row, children: [] });
  for (const row of rows) {
    const node = byId.get(row.id)!;
    const parent = row.parentId ? byId.get(row.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export type ProjectNode = Awaited<ReturnType<typeof projectTree>>[number];

/** Todos los ids del subárbol, para filtrar tareas y actividad. */
export async function subtreeIds(projectId: string, path: string) {
  const descendants = await db.project.findMany({
    where: { path: { startsWith: `${path}${projectId}/` } },
    select: { id: true },
  });
  return [projectId, ...descendants.map((d) => d.id)];
}

/** Opciones planas con sangría, para selects de "mover a" o "crear en". */
export async function projectOptions(
  workspaceId: string,
  viewer?: { role: string; userId: string },
) {
  const tree = await projectTree(workspaceId, false, viewer);
  const out: Array<{ id: string; name: string; depth: number; accent: string }> = [];
  const walk = (nodes: ProjectNode[], depth: number) => {
    for (const node of nodes) {
      out.push({ id: node.id, name: node.name, depth, accent: node.accent });
      walk(node.children as ProjectNode[], depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}
