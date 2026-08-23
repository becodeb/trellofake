import "server-only";

import { db } from "@/server/db";
import { isTeamRole } from "@/lib/domain";
import { readRemoteMarkdown } from "@/lib/resources";

export async function listKnowledgeResources(
  workspaceId: string,
  viewer: { role: string; userId: string },
  projectId?: string,
) {
  const resources = await db.knowledgeResource.findMany({
    where: {
      workspaceId,
      ...(projectId ? { projectId } : {}),
      ...(isTeamRole(viewer.role) ? {} : { visibility: "community" }),
    },
    select: {
      id: true,
      name: true,
      summary: true,
      kind: true,
      url: true,
      accessGuide: true,
      markdown: true,
      markdownUrl: true,
      visibility: true,
      project: { select: { id: true, name: true } },
      addedBy: { select: { name: true } },
    },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
  });

  return Promise.all(
    resources.map(async (resource) => ({
      ...resource,
      resolvedMarkdown: resource.markdownUrl
        ? await readRemoteMarkdown(resource.markdownUrl)
        : null,
    })),
  );
}
