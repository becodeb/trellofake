"use server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireTeamAction } from "@/server/auth/context";
import { parseMentions, recordActivity } from "@/server/domain/activity";
import { ok, run, revalidateTeam, type ActionResult } from "@/server/actions/shared";
import { ACTIVITY, isTeamRole } from "@/lib/domain";
const schema = z
  .object({
    body: z.string().trim().min(1, "Escribí algo.").max(8000),
    itemId: z.string().trim().optional(),
    projectId: z.string().trim().optional(),
    attachmentIds: z.array(z.string()).default([]),
  })
  .refine((v) => Boolean(v.itemId) !== Boolean(v.projectId), {
    message: "Un comentario va en un elemento o en un proyecto.",
  });

export async function addComment(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requireTeamAction("comment.write");
    const input = schema.parse(raw);
    if (!isTeamRole(ctx.role) && input.itemId) {
      throw new Error("La comunidad comenta en la conversación general del proyecto.");
    }
    // El comentario hereda el proyecto del elemento comentado.
    const item = input.itemId
      ? await db.item.findFirstOrThrow({
          where: { id: input.itemId },
          select: { id: true, title: true, projectId: true, type: true },
        })
      : null;
    const project = await db.project.findFirstOrThrow({
      where: { id: item?.projectId ?? input.projectId! },
      select: { id: true, name: true },
    });
    const comment = await db.comment.create({
      data: {
        authorId: ctx.user.id,
        body: input.body,
        itemId: item?.id ?? null,
        projectId: item ? null : project.id,
      },
      select: { id: true },
    });
    if (input.attachmentIds.length > 0) {
      await db.attachment.updateMany({
        where: {
          id: { in: input.attachmentIds },
          uploaderId: ctx.user.id,
        },
        data: { commentId: comment.id, itemId: item?.id ?? null, projectId: project.id },
      });
    }
    const members = await db.membership.findMany({
      select: { userId: true, user: { select: { name: true } } },
    });
    const mentioned = parseMentions(
      input.body,
      members.map((m) => ({ userId: m.userId, name: m.user.name })),
    );
    if (mentioned.length > 0) {
      await db.mention.createMany({
        data: mentioned.map((userId) => ({ userId, commentId: comment.id })),
      });
    }
    await recordActivity({
      actorId: ctx.user.id,
      verb: mentioned.length > 0 ? ACTIVITY.mentioned : ACTIVITY.commentAdded,
      targetType: "comment",
      targetId: comment.id,
      targetLabel: item?.title ?? project.name,
      projectId: project.id,
      itemId: item?.id ?? null,
      meta: {
        excerpt: input.body.slice(0, 160),
        on: item ? item.type : "project",
      },
      audience: mentioned.map((userId) => ({ userId, reason: "mentioned" as const })),
    });
    revalidateTeam();
    return { id: comment.id };
  });
}

export async function editComment(
  commentId: string,
  body: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("comment.write");
    const text = z.string().trim().min(1, "El comentario no puede quedar vacío.").parse(body);
    const comment = await db.comment.findFirstOrThrow({
      where: { id: commentId },
      select: { authorId: true },
    });
    if (comment.authorId !== ctx.user.id) throw new Error("Solo podés editar tus comentarios.");
    await db.comment.update({
      where: { id: commentId },
      data: { body: text, editedAt: new Date() },
    });
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

export async function deleteComment(
  commentId: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("comment.write");
    const comment = await db.comment.findFirstOrThrow({
      where: { id: commentId },
      select: { authorId: true },
    });
    // El autor borra lo suyo; un admin puede moderar.
    if (comment.authorId !== ctx.user.id && !ctx.can("workspace.manage")) {
      throw new Error("Solo podés borrar tus comentarios.");
    }
    await db.comment.delete({ where: { id: commentId } });
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}
