import { db } from "@/server/db";
import { actorStore } from "@/server/auth/actor";
import { createResource } from "@/server/actions/resources";
import { detectResourceKind, suggestResourceName } from "@/lib/resources";
import { authenticateRequest, gateErrorResponse } from "@/server/http/token-gate";
import { corsJson, corsPreflight } from "@/server/http/cors";
import { statusForActionError } from "@/server/http/action-status";

/**
 * Registra el ORIGEN de la página activa como recurso de un proyecto ("este
 * sitio es X"). El tipo se deduce (`local` para localhost/LAN, si no `site`)
 * con el mismo detector que usa la app (`@/lib/resources`) — nada se
 * reimplementa acá. Reusa `createResource` (la misma action que el formulario
 * completo de recursos) para que la capacidad (`resource.manage`) y el
 * registro de actividad salgan de un solo lugar.
 *
 * Idempotente: si ese origen ya está registrado en el proyecto, devuelve el
 * recurso existente en vez de duplicarlo — ni siquiera exige la capacidad de
 * escritura para ese caso, porque no se escribe nada.
 */
export const runtime = "nodejs";

type OriginBody = { projectId?: unknown; url?: unknown; label?: unknown };

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (auth.status !== "ok") return gateErrorResponse(request, auth.status);

  let body: OriginBody;
  try {
    body = await request.json();
  } catch {
    return corsJson(request, { error: "El cuerpo tiene que ser JSON." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : undefined;
  if (!projectId || !rawUrl) {
    return corsJson(request, { error: "Faltan projectId o url." }, { status: 400 });
  }

  let origin: string;
  try {
    origin = new URL(rawUrl).origin;
  } catch {
    return corsJson(request, { error: "Esa URL no es válida." }, { status: 400 });
  }

  const existing = await db.knowledgeResource.findFirst({
    where: { projectId, url: origin },
    select: { id: true },
  });
  if (existing) {
    return corsJson(request, { id: existing.id, appUrl: resourceAppUrl(request, projectId, existing.id) });
  }

  const result = await actorStore.run(auth.context.user, () =>
    createResource({
      projectId,
      url: origin,
      kind: detectResourceKind(origin),
      name: label || suggestResourceName(origin),
    }),
  );
  if (!result.ok) {
    return corsJson(request, { error: result.error }, { status: statusForActionError(result.error) });
  }

  return corsJson(request, {
    id: result.data.id,
    appUrl: resourceAppUrl(request, projectId, result.data.id),
  });
}

function resourceAppUrl(request: Request, projectId: string, resourceId: string): string {
  return `${new URL(request.url).origin}/p/${projectId}/recursos#${resourceId}`;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return corsPreflight(request);
}
