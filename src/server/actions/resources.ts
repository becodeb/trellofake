"use server";

import { z } from "zod";

import { db } from "@/server/db";
import { requireWorkspaceAction } from "@/server/auth/context";
import { recordActivity } from "@/server/domain/activity";
import { ok, run, revalidateWorkspace, type ActionResult } from "@/server/actions/shared";
import { ACTIVITY, PROJECT_VISIBILITIES, RESOURCE_KINDS } from "@/lib/domain";
import { normalizeMarkdownSource } from "@/lib/resources";

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => value || null)
  .refine((value) => value === null || /^https?:\/\//i.test(value), "Usá una URL http o https.");

const schema = z
  .object({
    name: z.string().trim().min(2, "Poné un nombre al recurso.").max(120),
    summary: z.string().trim().max(500).optional(),
    kind: z.enum(RESOURCE_KINDS).default("link"),
    url: optionalUrl,
    accessGuide: z.string().trim().max(5000).optional(),
    markdown: z.string().trim().max(100000).optional(),
    markdownUrl: optionalUrl,
    visibility: z.enum(PROJECT_VISIBILITIES).default("community"),
    projectId: z.string().trim().optional(),
  })
  .refine((value) => Boolean(value.url || value.accessGuide || value.markdown || value.markdownUrl), {
    message: "Agregá un enlace o instrucciones para usar el recurso.",
  })
  .refine((value) => !value.markdownUrl || Boolean(normalizeMarkdownSource(value.markdownUrl)), {
    message: "La guía remota debe ser un archivo de GitHub (github.com o raw.githubusercontent.com).",
  });

export async function createResource(
  slug: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requireWorkspaceAction(slug, "resource.manage");
    const input = schema.parse(raw);
    if (input.projectId) {
      await db.project.findFirstOrThrow({
        where: { id: input.projectId, workspaceId: ctx.workspace.id },
        select: { id: true },
      });
    }

    const resource = await db.knowledgeResource.create({
      data: {
        workspaceId: ctx.workspace.id,
        projectId: input.projectId || null,
        addedById: ctx.user.id,
        name: input.name,
        summary: input.summary || null,
        kind: input.kind,
        url: input.url,
        accessGuide: input.accessGuide || null,
        markdown: input.markdown || null,
        markdownUrl: input.markdownUrl,
        visibility: input.visibility,
      },
      select: { id: true, name: true },
    });

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.resourceAdded,
      targetType: "resource",
      targetId: resource.id,
      targetLabel: resource.name,
      projectId: input.projectId || null,
    });
    revalidateWorkspace(slug);
    return { id: resource.id };
  });
}

export async function deleteResource(slug: string, resourceId: string): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug, "resource.manage");
    await db.knowledgeResource.delete({
      where: { id: resourceId, workspaceId: ctx.workspace.id },
    });
    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}
