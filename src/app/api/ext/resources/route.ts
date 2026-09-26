import { actorStore } from "@/server/auth/actor";
import { createResource } from "@/server/actions/resources";
import { uploadFiles } from "@/server/actions/files";
import { detectResourceKind, normalizeUrl } from "@/lib/resources";
import { RESOURCE_KINDS } from "@/lib/domain";
import { authenticateRequest, gateErrorResponse } from "@/server/http/token-gate";
import { corsJson, corsPreflight } from "@/server/http/cors";
import { statusForActionError } from "@/server/http/action-status";

/**
 * Guarda la página activa como recurso de conocimiento — de cualquier sitio,
 * no solo de los proyectos del equipo (ej. un sitio cuyo diseño gustó). Sin
 * `projectId`, cae en la biblioteca del equipo. Reusa `createResource` +
 * `uploadFiles`, igual que el resto de `/api/ext/**`.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (auth.status !== "ok") return gateErrorResponse(request, auth.status);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return corsJson(request, { error: "El cuerpo tiene que ser multipart/form-data." }, { status: 400 });
  }

  const name = String(formData.get("name") ?? "").trim();
  const rawUrl = String(formData.get("url") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const rawKind = String(formData.get("kind") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (!name || !rawUrl) {
    return corsJson(request, { error: "Faltan name o url." }, { status: 400 });
  }
  const url = normalizeUrl(rawUrl);
  if (!/^https?:\/\//i.test(url)) {
    return corsJson(request, { error: "Esa URL no es válida." }, { status: 400 });
  }
  const kind = (RESOURCE_KINDS as readonly string[]).includes(rawKind)
    ? rawKind
    : detectResourceKind(url);

  const created = await actorStore.run(auth.context.user, () =>
    createResource({
      name,
      url,
      kind,
      summary: summary || undefined,
      projectId: projectId || undefined,
    }),
  );
  if (!created.ok) {
    return corsJson(request, { error: created.error }, { status: statusForActionError(created.error) });
  }

  if (files.length > 0) {
    const filesForm = new FormData();
    filesForm.set("resourceId", created.data.id);
    if (projectId) filesForm.set("projectId", projectId);
    for (const file of files) filesForm.append("files", file);
    const uploaded = await actorStore.run(auth.context.user, () => uploadFiles(filesForm));
    if (!uploaded.ok) {
      return corsJson(request, {
        id: created.data.id,
        appUrl: resourceAppUrl(request, projectId, created.data.id),
        warning: uploaded.error,
      });
    }
  }

  return corsJson(request, {
    id: created.data.id,
    appUrl: resourceAppUrl(request, projectId, created.data.id),
  });
}

function resourceAppUrl(request: Request, projectId: string, resourceId: string): string {
  const origin = new URL(request.url).origin;
  return projectId
    ? `${origin}/p/${projectId}/recursos#${resourceId}`
    : `${origin}/recursos#${resourceId}`;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return corsPreflight(request);
}
