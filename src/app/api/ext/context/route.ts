import { db } from "@/server/db";
import { authenticateRequest, gateErrorResponse } from "@/server/http/token-gate";
import { corsJson, corsPreflight } from "@/server/http/cors";

/**
 * Detecta "este sitio es X" para la pestaña activa: qué proyectos ya tienen
 * un recurso cuyo origen (esquema+host+puerto) coincide con el de la página,
 * y la lista de proyectos activos para el selector cuando no hay match.
 *
 * La comparación es literal por origen (no normaliza `127.0.0.1` vs
 * `localhost`: son orígenes distintos de verdad) pero ignora la barra final y
 * el puerto por defecto porque `URL.origin` ya los descarta.
 */
export const runtime = "nodejs";

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (auth.status !== "ok") return gateErrorResponse(request, auth.status);

  const pageUrl = new URL(request.url).searchParams.get("url");
  if (!pageUrl) {
    return corsJson(request, { error: "Falta el parámetro url." }, { status: 400 });
  }
  const pageOrigin = originOf(pageUrl);
  if (!pageOrigin) {
    return corsJson(request, { error: "Esa URL no es válida." }, { status: 400 });
  }

  const [resources, projects] = await Promise.all([
    db.knowledgeResource.findMany({
      where: { projectId: { not: null }, url: { not: null } },
      select: {
        url: true,
        kind: true,
        project: { select: { id: true, name: true, accent: true, parentId: true } },
      },
    }),
    db.project.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, accent: true, parentId: true, depth: true },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  // Un mismo proyecto puede tener varios recursos que matchean el origen; se
  // reporta una vez, prefiriendo el que sea site/local si hay que elegir uno.
  const matchesByProject = new Map<string, { id: string; name: string; accent: string; parentId: string | null; kind: string }>();
  for (const resource of resources) {
    if (!resource.project || !resource.url) continue;
    if (originOf(resource.url) !== pageOrigin) continue;
    const existing = matchesByProject.get(resource.project.id);
    const preferred = resource.kind === "site" || resource.kind === "local";
    if (!existing || (preferred && existing.kind !== "site" && existing.kind !== "local")) {
      matchesByProject.set(resource.project.id, { ...resource.project, kind: resource.kind });
    }
  }

  return corsJson(request, {
    matches: Array.from(matchesByProject.values()).map(({ id, name, accent, parentId }) => ({
      id,
      name,
      accent,
      parentId,
    })),
    projects,
  });
}

export async function OPTIONS(request: Request): Promise<Response> {
  return corsPreflight(request);
}
