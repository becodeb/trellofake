import { authenticateRequest, gateErrorResponse } from "@/server/http/token-gate";
import { corsJson, corsPreflight } from "@/server/http/cors";

/**
 * Identidad + capacidades del token, para el popup de la extensión: quién es,
 * en qué equipo, y si puede crear elementos o recursos (para no ofrecer un
 * botón que va a rebotar en 403).
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (auth.status !== "ok") return gateErrorResponse(request, auth.status);
  const { context } = auth;

  return corsJson(request, {
    user: { id: context.user.id, name: context.user.name },
    team: { name: context.team.name },
    role: context.role,
    can: {
      createItem: context.can("content.write"),
      createResource: context.can("resource.manage"),
    },
  });
}

export async function OPTIONS(request: Request): Promise<Response> {
  return corsPreflight(request);
}
