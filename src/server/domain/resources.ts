import "server-only";

import { db } from "@/server/db";
import { readRemoteMarkdown } from "@/lib/resources";

export async function listKnowledgeResources(
  projectId?: string,
) {
  const resources = await db.knowledgeResource.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
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