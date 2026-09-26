"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireTeamAction } from "@/server/auth/context";
import { recordActivity } from "@/server/domain/activity";
import { refreshProject } from "@/server/domain/progress";
import { ok, run, revalidateTeam, type ActionResult } from "@/server/actions/shared";
import {
  projectCreateSchema as createSchema,
  projectUpdateSchema as updateSchema,
  projectLinkSchema as linkSchema,
} from "@/server/actions/schemas";
import { ACTIVITY, PROJECT_STATUSES, accentFromId } from "@/lib/domain";
import { detectResourceKind, normalizeUrl, suggestResourceName } from "@/lib/resources";
import { normalizeFraming } from "@/lib/cover";

export async function createProject(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requireTeamAction("project.create");
    const input = createSchema.parse(raw);
    // La ruta materializada del hijo se arma con la del padre: path + id.
    let path = "/";
    let depth = 0;
    if (input.parentId) {
      const parent = await db.project.findFirst({
        where: { id: input.parentId },
        select: { id: true, path: true, depth: true },
      });
      if (!parent) throw new Error("El proyecto padre no existe.");
      path = `${parent.path}${parent.id}/`;
      depth = parent.depth + 1;
    }
    const last = await db.project.findFirst({
      where: { parentId: input.parentId ?? null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const members = Array.from(new Set([ctx.user.id, ...input.memberIds]));
    const project = await db.project.create({
      data: {
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
        accent: input.accent ?? accentFromId(`${ctx.team.id}${input.name}`),
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
      actorId: ctx.user.id,
      verb: ACTIVITY.projectCreated,
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
      projectId: project.id,
      meta: input.parentId ? { subproject: true } : null,
    });
    if (project.parentId) await refreshProject(project.parentId);
    revalidateTeam();
    return { id: project.id };
  });
}
export async function updateProject(
  projectId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("project.manage");
    const input = updateSchema.parse(raw);
    const before = await db.project.findFirstOrThrow({
      where: { id: projectId },
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
      actorId: ctx.user.id,
      verb: ACTIVITY.projectUpdated,
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
      projectId: project.id,
      meta: { fields: changed, priority: input.priority },
    });
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

/**
 * Cambiar a "terminado" o "cancelado" archiva el proyecto: sale del tablero
 * activo pero conserva absolutamente todo y se puede retomar.
 */

export async function setProjectStatus(
  projectId: string,
  status: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("project.manage");
    const parsed = z.enum(PROJECT_STATUSES).parse(status);
    const before = await db.project.findFirstOrThrow({
      where: { id: projectId },
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
      actorId: ctx.user.id,
      verb: closing ? ACTIVITY.projectArchived : ACTIVITY.projectStatusChanged,
      targetType: "project",
      targetId: projectId,
      targetLabel: before.name,
      projectId,
      meta: { from: before.status, to: parsed },
    });
    await refreshProject(projectId);
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

/** Retomar: vuelve del archivo al tablero activo sin perder nada. */

export async function restoreProject(
  projectId: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("project.archive");
    const project = await db.project.findFirstOrThrow({
      where: { id: projectId },
      select: { name: true, status: true },
    });
    await db.project.update({
      where: { id: projectId },
      data: { status: "active", archivedAt: null, completedAt: null },
    });
    await recordActivity({
      actorId: ctx.user.id,
      verb: ACTIVITY.projectRestored,
      targetType: "project",
      targetId: projectId,
      targetLabel: project.name,
      projectId,
      meta: { from: project.status },
    });
    await refreshProject(projectId);
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

export async function setProjectProgress(
  projectId: string,
  progress: number,
  mode: "auto" | "manual",
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("project.manage");
    const project = await db.project.findFirstOrThrow({
      where: { id: projectId },
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
        actorId: ctx.user.id,
        verb: ACTIVITY.projectProgress,
        targetType: "project",
        targetId: projectId,
        targetLabel: project.name,
        projectId,
        meta: { from: project.progress, to: value },
      });
    }
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

/**
 * Acomodar la portada.
 *
 * Guarda el encuadre, no un recorte: la imagen original no se toca. Por eso no
 * escribe actividad —correr una foto dos píxeles no es una novedad para nadie—
 * y no exige `project.manage`: quien puede subir la portada puede acomodarla.
 */
export async function setProjectCover(
  projectId: string,
  framing: { coverX: number; coverY: number; coverZoom: number },
): Promise<ActionResult> {
  const result = await run(async () => {
    await requireTeamAction("content.write");
    const project = await db.project.findFirstOrThrow({
      where: { id: projectId },
      select: { id: true, coverUrl: true },
    });
    if (!project.coverUrl) throw new Error("Este proyecto no tiene portada.");

    await db.project.update({
      where: { id: project.id },
      data: normalizeFraming(framing),
    });
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

export async function setProjectMembers(
  projectId: string,
  userIds: string[],
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("project.manage");
    const project = await db.project.findFirstOrThrow({
      where: { id: projectId },
      select: { name: true, members: { select: { userId: true } } },
    });
    const valid = await db.membership.findMany({
      where: { userId: { in: userIds } },
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
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}
/**
 * Agregar un link rápido es agregar un recurso: desde la migración 0004,
 * `ResourceLink` y `KnowledgeResource` son la misma tabla. Esta acción se
 * mantiene como una entrada liviana (una URL, el tipo se deduce) para el
 * "pegá un link" del resumen y de archivos; el formulario completo (resumen,
 * guía de acceso, markdown) vive en `createResource`.
 */
export async function addLink(
  projectId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("content.write");
    const input = linkSchema.parse(raw);
    const url = normalizeUrl(input.url);
    const project = await db.project.findFirstOrThrow({
      where: { id: projectId },
      select: { name: true },
    });
    const last = await db.knowledgeResource.findFirst({
      where: { projectId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const resource = await db.knowledgeResource.create({
      data: {
        projectId,
        url,
        name: input.label?.trim() || suggestResourceName(url),
        kind: detectResourceKind(url),
        position: (last?.position ?? 0) + 1,
        addedById: ctx.user.id,
      },
      select: { id: true, name: true },
    });
    await recordActivity({
      actorId: ctx.user.id,
      verb: ACTIVITY.linkAdded,
      targetType: "link",
      targetId: resource.id,
      targetLabel: resource.name,
      projectId,
      meta: { url, project: project.name },
    });
    revalidatePath(`/p/${projectId}`, "layout");
  });
  return result.ok ? ok() : result;
}

export async function removeLink(
  projectId: string,
  linkId: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("content.write");
    const resource = await db.knowledgeResource.findFirstOrThrow({
      where: { id: linkId, projectId },
      select: { name: true },
    });
    await db.knowledgeResource.delete({ where: { id: linkId } });
    await recordActivity({
      actorId: ctx.user.id,
      verb: ACTIVITY.linkRemoved,
      targetType: "link",
      targetId: linkId,
      targetLabel: resource.name,
      projectId,
    });
    revalidatePath(`/p/${projectId}`, "layout");
  });
  return result.ok ? ok() : result;
}

/** Borrar de verdad. Reservado a admins y separado de archivar. */

export async function deleteProject(
  projectId: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("project.manage");
    const project = await db.project.findFirstOrThrow({
      where: { id: projectId },
      select: { name: true, parentId: true },
    });
    await db.project.delete({ where: { id: projectId } });
    if (project.parentId) await refreshProject(project.parentId);
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}
