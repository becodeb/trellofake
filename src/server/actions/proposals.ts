"use server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireTeamAction } from "@/server/auth/context";
import { recordActivity } from "@/server/domain/activity";
import { createProject } from "@/server/actions/projects";
import { ok, run, revalidateTeam, type ActionResult } from "@/server/actions/shared";
import { ACTIVITY, PROPOSAL_STATUSES, isTeamRole } from "@/lib/domain";
const createSchema = z.object({
  title: z.string().trim().min(4, "Contá la idea en un título un poco más claro.").max(160),
  body: z.string().trim().min(12, "Agregá un poco de contexto para poder evaluarla.").max(8000),
  category: z.enum(["project", "improvement", "need"]).default("project"),
  targetProjectId: z.string().trim().optional(),
});

export async function createProposal(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requireTeamAction("comment.write");
    const input = createSchema.parse(raw);
    if (input.targetProjectId) {
      await db.project.findFirstOrThrow({
        where: { id: input.targetProjectId },
        select: { id: true },
      });
    }
    const proposal = await db.proposal.create({
      data: {
        authorId: ctx.user.id,
        title: input.title,
        body: input.body,
        category: input.category,
        targetProjectId: input.targetProjectId || null,
      },
      select: { id: true, title: true },
    });
    const team = await db.membership.findMany({
      where: { role: { in: ["admin", "developer", "member"] } },
      select: { userId: true },
    });
    await recordActivity({
      actorId: ctx.user.id,
      verb: ACTIVITY.proposalCreated,
      targetType: "proposal",
      targetId: proposal.id,
      targetLabel: proposal.title,
      projectId: input.targetProjectId || null,
      audience: team.map(({ userId }) => ({ userId, reason: "participant" as const })),
    });
    revalidateTeam();
    return { id: proposal.id };
  });
}

export async function replyToProposal(
  proposalId: string,
  body: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("comment.write");
    const text = z.string().trim().min(1, "Escribí una respuesta.").max(8000).parse(body);
    const proposal = await db.proposal.findFirstOrThrow({
      where: { id: proposalId },
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
      actorId: ctx.user.id,
      verb: ACTIVITY.proposalReplied,
      targetType: "proposal",
      targetId: reply.id,
      targetLabel: proposal.title,
      projectId: proposal.targetProjectId,
      audience: [...audience].map((userId) => ({ userId, reason: "reply" as const })),
    });
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}
const triageSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES),
  targetProjectId: z.string().trim().nullable().optional(),
});

export async function triageProposal(
  proposalId: string,
  raw: unknown,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("proposal.manage");
    const input = triageSchema.parse(raw);
    if (input.targetProjectId) {
      await db.project.findFirstOrThrow({
        where: { id: input.targetProjectId },
        select: { id: true },
      });
    }
    const proposal = await db.proposal.update({
      where: { id: proposalId },
      data: {
        status: input.status,
        ...(input.targetProjectId !== undefined ? { targetProjectId: input.targetProjectId } : {}),
      },
      select: { title: true, authorId: true, targetProjectId: true },
    });
    await recordActivity({
      actorId: ctx.user.id,
      verb: ACTIVITY.proposalTriaged,
      targetType: "proposal",
      targetId: proposalId,
      targetLabel: proposal.title,
      projectId: proposal.targetProjectId,
      audience: [{ userId: proposal.authorId, reason: "author" }],
      meta: { status: input.status },
    });
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

export async function promoteProposal(
  proposalId: string,
): Promise<ActionResult<{ projectId: string }>> {
  return run(async () => {
    const ctx = await requireTeamAction("proposal.manage");
    const proposal = await db.proposal.findFirstOrThrow({
      where: { id: proposalId },
      select: { title: true, body: true },
    });
    const created = await createProject({
      name: proposal.title,
      description: proposal.body,
      memberIds: [ctx.user.id],
    });
    if (!created.ok) throw new Error(created.error);
    await db.proposal.update({
      where: { id: proposalId },
      data: { status: "planned", promotedProjectId: created.data.id, targetProjectId: created.data.id },
    });
    revalidateTeam();
    return { projectId: created.data.id };
  });
}
