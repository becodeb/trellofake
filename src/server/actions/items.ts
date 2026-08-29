"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireTeamAction } from "@/server/auth/context";
import { parseMentions, recordActivity } from "@/server/domain/activity";
import { refreshItem, refreshProject } from "@/server/domain/progress";
import { ok, run, revalidateTeam, type ActionResult } from "@/server/actions/shared";
import {
  ACTIVITY,
  ASSIGNEE_SCOPES,
  ITEM_TYPES,
  ITEM_TYPE_META,
  PRIORITIES,
  evenWeights,
  isValidStatus,
  normalizeWeights,
  statusMeta,
} from "@/lib/domain";
const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(value) : null))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), "Fecha inválida.");
const createSchema = z.object({
  projectId: z.string().min(1, "Elegí un proyecto."),
  type: z.enum(ITEM_TYPES),
  title: z.string().trim().min(1, "Escribí un título."),
  body: z.string().trim().max(20000).optional(),
  priority: z.enum(PRIORITIES).default("medium"),
  status: z.string().trim().optional(),
  dueDate: optionalDate,
  parentId: z.string().trim().optional(),
  assigneeIds: z.array(z.string()).default([]),
  assigneeScope: z.enum(ASSIGNEE_SCOPES).default("individual"),
});

/**
 * Crear contenido es la acción más frecuente de la app: una sola llamada
 * resuelve tarea, idea, nota, problema, decisión o actualización.
 */

export async function createItem(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requireTeamAction("content.write");
    const input = createSchema.parse(raw);
    const project = await db.project.findFirstOrThrow({
      where: { id: input.projectId },
      select: { id: true, name: true },
    });
    const meta = ITEM_TYPE_META[input.type];
    const status =
      input.status && isValidStatus(input.type, input.status)
        ? input.status
        : meta.defaultStatus;
    const last = await db.item.findFirst({
      where: { projectId: project.id, type: input.type, parentId: input.parentId ?? null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const assignees = meta.schedulable ? input.assigneeIds : [];
    const weights = evenWeights(assignees.length);
    const item = await db.item.create({
      data: {
        projectId: project.id,
        parentId: input.parentId || null,
        type: input.type,
        title: input.title,
        body: input.body || null,
        status,
        priority: input.priority,
        dueDate: input.dueDate,
        assigneeScope: meta.schedulable ? input.assigneeScope : "individual",
        position: (last?.position ?? 0) + 1,
        createdById: ctx.user.id,
        progress: statusMeta(input.type, status).weight,
        assignments: {
          create: assignees.map((userId, index) => ({
            userId,
            weight: weights[index],
            assignedById: ctx.user.id,
          })),
        },
      },
      select: { id: true, title: true, type: true, parentId: true },
    });
    const members = await workspaceMemberNames();
    const mentioned = parseMentions(input.body ?? "", members);
    if (mentioned.length > 0) {
      await db.mention.createMany({
        data: mentioned.map((userId) => ({ userId, itemId: item.id })),
      });
    }
    await recordActivity({
      actorId: ctx.user.id,
      verb: item.parentId ? ACTIVITY.subtaskAdded : ACTIVITY.itemCreated,
      targetType: "item",
      targetId: item.id,
      targetLabel: item.title,
      projectId: project.id,
      itemId: item.id,
      meta: { type: item.type, project: project.name },
      audience: mentioned.map((userId) => ({ userId, reason: "mentioned" as const })),
    });
    await refreshItem(item.id);
    revalidateTeam();
    return { id: item.id };
  });
}
const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  body: z.string().trim().max(20000).nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: optionalDate.optional(),
});

export async function updateItem(
  itemId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("content.write");
    const input = updateSchema.parse(raw);
    const before = await db.item.findFirstOrThrow({
      where: { id: itemId },
      select: { title: true, priority: true, dueDate: true, projectId: true, type: true },
    });
    const item = await db.item.update({
      where: { id: itemId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      },
      select: { id: true, title: true, projectId: true },
    });
    // Cada cambio con significado propio deja su propio rastro.
    if (input.priority && input.priority !== before.priority) {
      await logItem(ctx, item, ACTIVITY.itemPriorityChanged, {
        from: before.priority,
        to: input.priority,
      });
    } else if (input.dueDate !== undefined && `${input.dueDate}` !== `${before.dueDate}`) {
      await logItem(ctx, item, ACTIVITY.itemDueChanged, {
        to: input.dueDate?.toISOString() ?? null,
      });
    } else {
      await logItem(ctx, item, ACTIVITY.itemUpdated, {
        renamed: input.title !== undefined && input.title !== before.title,
        type: before.type,
      });
    }
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

export async function setItemStatus(
  itemId: string,
  status: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("content.write");
    const before = await db.item.findFirstOrThrow({
      where: { id: itemId },
      select: { type: true, status: true, title: true, projectId: true },
    });
    if (!isValidStatus(before.type, status)) throw new Error("Ese estado no existe acá.");
    if (before.status === status) return;
    const next = statusMeta(before.type, status);
    const previous = statusMeta(before.type, before.status);
    const completing = next.terminal && next.weight === 100;
    const item = await db.item.update({
      where: { id: itemId },
      data: {
        status,
        completedAt: completing ? new Date() : null,
      },
      select: { id: true, title: true, projectId: true },
    });
    const verb = completing
      ? ACTIVITY.itemCompleted
      : previous.terminal
        ? ACTIVITY.itemReopened
        : ACTIVITY.itemStatusChanged;
    await logItem(ctx, item, verb, {
      from: before.status,
      to: status,
      type: before.type,
      fromLabel: previous.label,
      toLabel: next.label,
    });
    await refreshItem(itemId);
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

export async function setItemProgress(
  itemId: string,
  progress: number,
  mode: "auto" | "manual",
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("content.write");
    const before = await db.item.findFirstOrThrow({
      where: { id: itemId },
      select: { progress: true, title: true, projectId: true },
    });
    const value = Math.max(0, Math.min(100, Math.round(progress)));
    const item = await db.item.update({
      where: { id: itemId },
      data: { progressMode: mode, ...(mode === "manual" ? { progress: value } : {}) },
      select: { id: true, title: true, projectId: true },
    });
    await refreshItem(itemId);
    if (mode === "manual" && value !== before.progress) {
      await logItem(ctx, item, ACTIVITY.itemProgressChanged, {
        from: before.progress,
        to: value,
      });
    }
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}
const assigneeSchema = z.object({
  scope: z.enum(ASSIGNEE_SCOPES).default("individual"),
  assignees: z
    .array(z.object({ userId: z.string(), weight: z.number().min(0).max(100).optional() }))
    .default([]),
});

/**
 * Asignación colaborativa. Si no se pasan pesos, se reparte en partes iguales;
 * si se pasan, se normalizan para que sumen exactamente 100.
 */

export async function setAssignees(
  itemId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("content.write");
    const input = assigneeSchema.parse(raw);
    const item = await db.item.findFirstOrThrow({
      where: { id: itemId },
      select: {
        id: true,
        title: true,
        projectId: true,
        assigneeScope: true,
        assignments: { select: { userId: true, weight: true } },
      },
    });
    const members = await db.membership.findMany({
      where: {
        userId: { in: input.assignees.map((a) => a.userId) },
      },
      select: { userId: true, user: { select: { name: true } } },
    });
    const valid = input.assignees.filter((a) => members.some((m) => m.userId === a.userId));
    const explicit = valid.some((a) => a.weight !== undefined);
    const weights = explicit
      ? normalizeWeights(valid.map((a) => a.weight ?? 0))
      : evenWeights(valid.length);
    const previous = new Set(item.assignments.map((a) => a.userId));
    const nextIds = new Set(valid.map((a) => a.userId));
    await db.$transaction([
      db.itemAssignment.deleteMany({ where: { itemId } }),
      db.itemAssignment.createMany({
        data: valid.map((a, index) => ({
          itemId,
          userId: a.userId,
          weight: weights[index],
          assignedById: ctx.user.id,
        })),
      }),
      db.item.update({ where: { id: itemId }, data: { assigneeScope: input.scope } }),
    ]);
    const added = valid.filter((a) => !previous.has(a.userId));
    const removed = [...previous].filter((id) => !nextIds.has(id));
    const nameOf = (userId: string) =>
      members.find((m) => m.userId === userId)?.user.name ?? "alguien";
    if (input.scope === "team" && item.assigneeScope !== "team") {
      await logItem(ctx, item, ACTIVITY.itemAssigned, { team: true });
    } else if (added.length > 0) {
      await logItem(ctx, item, ACTIVITY.itemAssigned, {
        people: added.map((a) => nameOf(a.userId)),
      });
    } else if (removed.length > 0) {
      await logItem(ctx, item, ACTIVITY.itemUnassigned, { count: removed.length });
    } else if (explicit) {
      await logItem(ctx, item, ACTIVITY.itemWeightsChanged, {
        split: valid.map((a, i) => `${nameOf(a.userId)} ${weights[i]}%`),
      });
    }
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

/** Convierte una idea en tarea conservando el rastro de dónde salió. */

export async function convertToTask(
  itemId: string,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requireTeamAction("content.write");
    const source = await db.item.findFirstOrThrow({
      where: { id: itemId },
      select: { id: true, title: true, body: true, priority: true, projectId: true, type: true },
    });
    if (source.type !== "idea") throw new Error("Solo se convierten ideas en tareas.");
    const task = await db.item.create({
      data: {
        projectId: source.projectId,
        type: "task",
        title: source.title,
        body: source.body,
        priority: source.priority,
        status: "todo",
        createdById: ctx.user.id,
        convertedFromId: source.id,
      },
      select: { id: true, title: true, projectId: true },
    });
    await db.item.update({ where: { id: source.id }, data: { status: "converted" } });
    await logItem(ctx, task, ACTIVITY.itemConverted, { from: "idea" });
    await refreshProject(source.projectId);
    revalidateTeam();
    return { id: task.id };
  });
}

/** Reordena y, si cambia de columna en el tablero, actualiza el estado. */

export async function moveItem(
  itemId: string,
  target: { status?: string; position: number },
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("content.write");
    const item = await db.item.findFirstOrThrow({
      where: { id: itemId },
      select: { type: true, status: true },
    });
    await db.item.update({ where: { id: itemId }, data: { position: target.position } });
    if (target.status && target.status !== item.status) {
      await setItemStatus(itemId, target.status);
      return;
    }
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

export async function deleteItem(itemId: string): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("content.write");
    const item = await db.item.findFirstOrThrow({
      where: { id: itemId },
      select: { title: true, projectId: true, parentId: true, type: true },
    });
    await db.item.delete({ where: { id: itemId } });
    await recordActivity({
      actorId: ctx.user.id,
      verb: ACTIVITY.itemDeleted,
      targetType: "item",
      targetId: itemId,
      targetLabel: item.title,
      projectId: item.projectId,
      meta: { type: item.type },
    });
    if (item.parentId) await refreshItem(item.parentId);
    else await refreshProject(item.projectId);
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

// ---------------------------------------------------------------- helpers
type Ctx = Awaited<ReturnType<typeof requireTeamAction>>;

async function logItem(
  ctx: Ctx,
  item: { id: string; title: string; projectId: string },
  verb: string,
  meta: Record<string, unknown>,
) {
  await recordActivity({
    actorId: ctx.user.id,
    verb: verb as never,
    targetType: "item",
    targetId: item.id,
    targetLabel: item.title,
    projectId: item.projectId,
    itemId: item.id,
    meta,
  });
}

async function workspaceMemberNames() {
  const members = await db.membership.findMany({
    select: { userId: true, user: { select: { name: true } } },
  });
  return members.map((m) => ({ userId: m.userId, name: m.user.name }));
}

/** Recalcula desde cero un proyecto y sus items. Útil tras cambios masivos. */

export async function recomputeProject(projectId: string) {
  const ctx = await requireTeamAction();
  const roots = await db.item.findMany({
    where: { projectId,  parentId: null },
    select: { id: true },
  });
  for (const root of roots) await refreshItem(root.id);
  await refreshProject(projectId);
  revalidatePath(`/p/${projectId}`, "layout");
}
