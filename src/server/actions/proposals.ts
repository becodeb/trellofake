"use server";

import { z } from "zod";

import { db } from "@/server/db";
import { requireWorkspaceAction } from "@/server/auth/context";
import { recordActivity } from "@/server/domain/activity";
import { createProject } from "@/server/actions/projects";
import { ok, run, revalidateWorkspace, type ActionResult } from "@/server/actions/shared";
import { ACTIVITY, PROPOSAL_STATUSES, isTeamRole } from "@/lib/domain";

const createSchema = z.object({
  title: z.string().trim().min(4, "Contá la idea en un título un poco más claro.").max(160),
  body: z.string().trim().min(12, "Agregá un poco de contexto para poder evaluarla.").max(8000),
  category: z.enum(["project", "improvement", "need"]).default("project"),
  targetProjectId: z.string().trim().optional(),
});

export async function createProposal(
  slug: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requireWorkspaceAction(slug, "comment.write");
    const input = createSchema.parse(raw);

    if (input.targetProjectId) {
      const visible = await db.project.findFirst({
        where: {
          id: input.targetProjectId,
          workspaceId: ctx.workspace.id,
          ...(isTeamRole(ctx.role)
            ? {}
            : {
                OR: [
                  { visibility: "community" },
                  { members: { some: { userId: ctx.user.id } } },
                ],
              }),
        },
        select: { id: true },
      });
      if (!visible) throw new Error("No podés vincular la idea a ese proyecto.");
    }

    const proposal = await db.proposal.create({
      data: {
        workspaceId: ctx.workspace.id,
        authorId: ctx.user.id,
        title: input.title,
        body: input.body,
        category: input.category,
        targetProjectId: input.targetProjectId || null,
      },
      select: { id: true, title: true },
    });

    const team = await db.membership.findMany({
      where: { workspaceId: ctx.workspace.id, role: { in: ["admin", "developer", "member"] } },
      select: { userId: true },
    });

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.proposalCreated,
      targetType: "proposal",
      targetId: proposal.id,
      targetLabel: proposal.title,
      projectId: input.targetProjectId || null,
      audience: team.map(({ userId }) => ({ userId, reason: "participant" as const })),
    });

    revalidateWorkspace(slug);
    return { id: proposal.id };
  });
}

export async function replyToProposal(
  slug: string,
  proposalId: string,
  body: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug, "comment.write");
    const text = z.string().trim().min(1, "Escribí una respuesta.").max(8000).parse(body);
    const proposal = await db.proposal.findFirstOrThrow({
      where: { id: proposalId, workspaceId: ctx.workspace.id },
      select: {
        title: true,
        authorId: true,
        targetProjectId: true,
        replies: { select: { authorId: true }, distinct: ["authorId"] },
      },
    });

    const reply = await db.proposalReply.create({
      data: { proposalId, authorId: ctx.user.id, body: text },
      select: { id: true },
    });
    const audience = new Set([proposal.authorId, ...proposal.replies.map((item) => item.authorId)]);

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.proposalReplied,
      targetType: "proposal",
      targetId: reply.id,
      targetLabel: proposal.title,
      projectId: proposal.targetProjectId,
      audience: [...audience].map((userId) => ({ userId, reason: "reply" as const })),
    });
    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}

const triageSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES),
  targetProjectId: z.string().trim().nullable().optional(),
});

export async function triageProposal(
  slug: string,
  proposalId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug, "proposal.manage");
    const input = triageSchema.parse(raw);
    if (input.targetProjectId) {
      await db.project.findFirstOrThrow({
        where: { id: input.targetProjectId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
    }
    const proposal = await db.proposal.update({
      where: { id: proposalId, workspaceId: ctx.workspace.id },
      data: {
        status: input.status,
        ...(input.targetProjectId !== undefined ? { targetProjectId: input.targetProjectId } : {}),
      },
      select: { title: true, authorId: true, targetProjectId: true },
    });
    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.proposalTriaged,
      targetType: "proposal",
      targetId: proposalId,
      targetLabel: proposal.title,
      projectId: proposal.targetProjectId,
      audience: [{ userId: proposal.authorId, reason: "author" }],
      meta: { status: input.status },
    });
    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}

export async function promoteProposal(
  slug: string,
  proposalId: string,
): Promise<ActionResult<{ projectId: string }>> {
  return run(async () => {
    const ctx = await requireWorkspaceAction(slug, "proposal.manage");
    const proposal = await db.proposal.findFirstOrThrow({
      where: { id: proposalId, workspaceId: ctx.workspace.id },
      select: { title: true, body: true },
    });
    const created = await createProject(slug, {
      name: proposal.title,
      description: proposal.body,
      visibility: "community",
      memberIds: [ctx.user.id],
    });
    if (!created.ok) throw new Error(created.error);
    await db.proposal.update({
      where: { id: proposalId, workspaceId: ctx.workspace.id },
      data: { status: "planned", promotedProjectId: created.data.id, targetProjectId: created.data.id },
    });
    revalidateWorkspace(slug);
    return { projectId: created.data.id };
  });
}
