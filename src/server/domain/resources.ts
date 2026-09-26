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
      attachments: {
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          storageKey: true,
          kind: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
  });

  return Promise.all(
    resources.map(async ({ attachments, ...resource }) => ({
      ...resource,
      attachments,
      // La primera captura sirve de miniatura en la biblioteca; el resto
      // (y `storageKey`, para armar la URL) igual queda disponible por MCP
      // vía `attachments` — `toWire` (src/server/mcp/tools.ts) le quita la
      // `storageKey` a la respuesta antes de salir.
      screenshot: attachments.find((a) => a.kind === "image") ?? null,
      resolvedMarkdown: resource.markdownUrl
        ? await readRemoteMarkdown(resource.markdownUrl)
        : null,
    })),
  );
}