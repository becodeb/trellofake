"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/server/db";
import { requireWorkspaceAction } from "@/server/auth/context";
import { recordActivity } from "@/server/domain/activity";
import { refreshProject } from "@/server/domain/progress";
import { ok, run, revalidateWorkspace, type ActionResult } from "@/server/actions/shared";
import { ACTIVITY, PRIORITIES, PROJECT_STATUSES, accentFromId, ACCENTS } from "@/lib/domain";
import { detectLinkKind, normalizeUrl, suggestLabel } from "@/lib/links";

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(value) : null))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), "Fecha inválida.");

const createSchema = z.object({
  name: z.string().trim().min(2, "El proyecto necesita un nombre."),
  description: z.string().trim().max(2000).optional(),
  parentId: z.string().trim().optional(),
  priority: z.enum(PRIORITIES).default("medium"),
  accent: z.enum(ACCENTS).optional(),
  startDate: optionalDate,
  targetDate: optionalDate,
  memberIds: z.array(z.string()).default([]),
  coverUrl: z.string().trim().optional(),
});

export async function createProject(
  slug: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requireWorkspaceAction(slug, "project.create");
    const input = createSchema.parse(raw);

    // La ruta materializada del hijo se arma con la del padre: path + id.
    let path = "/";
    let depth = 0;
    if (input.parentId) {
      const parent = await db.project.findFirst({
        where: { id: input.parentId, workspaceId: ctx.workspace.id },
        select: { id: true, path: true, depth: true },
      });
      if (!parent) throw new Error("El proyecto padre no existe.");
      path = `${parent.path}${parent.id}/`;
      depth = parent.depth + 1;
    }

    const last = await db.project.findFirst({
      where: { workspaceId: ctx.workspace.id, parentId: input.parentId ?? null },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const members = Array.from(new Set([ctx.user.id, ...input.memberIds]));

    const project = await db.project.create({
      data: {
        workspaceId: ctx.workspace.id,
        parentId: input.parentId || null,
        path,
        depth,
        name: input.name,
        description: input.description || null,
        coverUrl: input.coverUrl || null,
        priority: input.priority,
        startDate: input.startDate,
        targetDate: input.targetDate,
        position: (last?.position ?? 0) + 1,
        createdById: ctx.user.id,
        accent: input.accent ?? accentFromId(`${ctx.workspace.id}${input.name}`),
        members: {
          create: members.map((userId) => ({
            userId,
            role: userId === ctx.user.id ? "lead" : "contributor",
          })),
        },
      },
      select: { id: true, name: true, parentId: true },
    });

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.projectCreated,
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
      projectId: project.id,
      meta: input.parentId ? { subproject: true } : null,
    });

    if (project.parentId) await refreshProject(project.parentId);
    revalidateWorkspace(slug);
    return { id: project.id };
  });
}

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  accent: z.enum(ACCENTS).optional(),
  startDate: optionalDate.optional(),
  targetDate: optionalDate.optional(),
  coverUrl: z.string().trim().nullable().optional(),
});

export async function updateProject(
  slug: string,
  projectId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug);
    const input = updateSchema.parse(raw);

    const before = await db.project.findFirstOrThrow({
      where: { id: projectId, workspaceId: ctx.workspace.id },
      select: { name: true, priority: true, targetDate: true },
    });

    const project = await db.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.accent !== undefined ? { accent: input.accent } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
        ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
      },
      select: { id: true, name: true },
    });

    const changed: string[] = [];
    if (input.name && input.name !== before.name) changed.push("nombre");
    if (input.priority && input.priority !== before.priority) changed.push("prioridad");
    if (input.description !== undefined) changed.push("descripción");
    if (input.targetDate !== undefined) changed.push("fecha estimada");
    if (input.coverUrl !== undefined) changed.push("portada");

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.projectUpdated,
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
      projectId: project.id,
      meta: { fields: changed, priority: input.priority },
    });

    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}

/**
 * Cambiar a "terminado" o "cancelado" archiva el proyecto: sale del tablero
 * activo pero conserva absolutamente todo y se puede retomar.
 */
export async function setProjectStatus(
  slug: string,
  projectId: string,
  status: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug);
    const parsed = z.enum(PROJECT_STATUSES).parse(status);

    const before = await db.project.findFirstOrThrow({
      where: { id: projectId, workspaceId: ctx.workspace.id },
      select: { status: true, name: true, path: true },
    });
    if (before.status === parsed) return;

    const closing = parsed === "done" || parsed === "cancelled";

    await db.project.update({
      where: { id: projectId },
      data: {
        status: parsed,
        completedAt: parsed === "done" ? new Date() : null,
        archivedAt: closing ? new Date() : null,
        ...(parsed === "done" ? { progress: 100 } : {}),
      },
    });

    // Un subproyecto no puede quedar activo dentro de algo cerrado.
    if (closing) {
      await db.project.updateMany({
        where: { path: { startsWith: `${before.path}${projectId}/` }, archivedAt: null },
        data: { archivedAt: new Date(), status: parsed },
      });
    }

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: closing ? ACTIVITY.projectArchived : ACTIVITY.projectStatusChanged,
      targetType: "project",
      targetId: projectId,
      targetLabel: before.name,
      projectId,
      meta: { from: before.status, to: parsed },
    });

    await refreshProject(projectId);
    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}

/** Retomar: vuelve del archivo al tablero activo sin perder nada. */
export async function restoreProject(
  slug: string,
  projectId: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug, "project.archive");
    const project = await db.project.findFirstOrThrow({
      where: { id: projectId, workspaceId: ctx.workspace.id },
      select: { name: true, status: true },
    });

    await db.project.update({
      where: { id: projectId },
      data: { status: "active", archivedAt: null, completedAt: null },
    });

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.projectRestored,
      targetType: "project",
      targetId: projectId,
      targetLabel: project.name,
      projectId,
      meta: { from: project.status },
    });

    await refreshProject(projectId);
    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}

export async function setProjectProgress(
  slug: string,
  projectId: string,
  progress: number,
  mode: "auto" | "manual",
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug);
    const project = await db.project.findFirstOrThrow({
      where: { id: projectId, workspaceId: ctx.workspace.id },
      select: { name: true, progress: true },
    });

    const value = Math.max(0, Math.min(100, Math.round(progress)));
    await db.project.update({
      where: { id: projectId },
      data: { progressMode: mode, ...(mode === "manual" ? { progress: value } : {}) },
    });
    await refreshProject(projectId);

    if (mode === "manual" && value !== project.progress) {
      await recordActivity({
        workspaceId: ctx.workspace.id,
        actorId: ctx.user.id,
        verb: ACTIVITY.projectProgress,
        targetType: "project",
        targetId: projectId,
        targetLabel: project.name,
        projectId,
        meta: { from: project.progress, to: value },
      });
    }

    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}

export async function setProjectMembers(
  slug: string,
  projectId: string,
  userIds: string[],
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug);
    const project = await db.project.findFirstOrThrow({
      where: { id: projectId, workspaceId: ctx.workspace.id },
      select: { name: true, members: { select: { userId: true } } },
    });

    const valid = await db.membership.findMany({
      where: { workspaceId: ctx.workspace.id, userId: { in: userIds } },
      select: { userId: true, user: { select: { name: true } } },
    });

    const next = new Set(valid.map((m) => m.userId));
    const current = new Set(project.members.map((m) => m.userId));
    const added = valid.filter((m) => !current.has(m.userId));
    const removed = [...current].filter((id) => !next.has(id));

    await db.$transaction([
      db.projectMember.deleteMany({ where: { projectId, userId: { in: removed } } }),
      db.projectMember.createMany({
        data: added.map((m) => ({ projectId, userId: m.userId })),
      }),
    ]);

    for (const member of added) {
      await recordActivity({
        workspaceId: ctx.workspace.id,
        actorId: ctx.user.id,
        verb: ACTIVITY.projectMemberAdded,
        targetType: "project",
        targetId: projectId,
        targetLabel: project.name,
        projectId,
        meta: { person: member.user.name },
        audience: [{ userId: member.userId, reason: "participant" }],
      });
    }

    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}

const linkSchema = z.object({
  url: z.string().trim().min(3, "Pegá una URL."),
  label: z.string().trim().max(80).optional(),
});

export async function addLink(
  slug: string,
  projectId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug, "content.write");
    const input = linkSchema.parse(raw);
    const url = normalizeUrl(input.url);

    const project = await db.project.findFirstOrThrow({
      where: { id: projectId, workspaceId: ctx.workspace.id },
      select: { name: true },
    });

    const last = await db.resourceLink.findFirst({
      where: { projectId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const link = await db.resourceLink.create({
      data: {
        projectId,
        url,
        label: input.label?.trim() || suggestLabel(url),
        kind: detectLinkKind(url),
        position: (last?.position ?? 0) + 1,
        addedById: ctx.user.id,
      },
      select: { id: true, label: true },
    });

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.linkAdded,
      targetType: "link",
      targetId: link.id,
      targetLabel: link.label,
      projectId,
      meta: { url, project: project.name },
    });

    revalidatePath(`/w/${slug}/p/${projectId}`, "layout");
  });
  return result.ok ? ok() : result;
}

export async function removeLink(
  slug: string,
  projectId: string,
  linkId: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug, "content.write");
    const link = await db.resourceLink.findFirstOrThrow({
      where: { id: linkId, project: { id: projectId, workspaceId: ctx.workspace.id } },
      select: { label: true },
    });
    await db.resourceLink.delete({ where: { id: linkId } });

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.linkRemoved,
      targetType: "link",
      targetId: linkId,
      targetLabel: link.label,
      projectId,
    });

    revalidatePath(`/w/${slug}/p/${projectId}`, "layout");
  });
  return result.ok ? ok() : result;
}

/** Borrar de verdad. Reservado a admins y separado de archivar. */
export async function deleteProject(
  slug: string,
  projectId: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug, "project.manage");
    const project = await db.project.findFirstOrThrow({
      where: { id: projectId, workspaceId: ctx.workspace.id },
      select: { name: true, parentId: true },
    });
    await db.project.delete({ where: { id: projectId } });
    if (project.parentId) await refreshProject(project.parentId);
    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}
