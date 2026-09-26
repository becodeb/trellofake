import { actorStore } from "@/server/auth/actor";
import { createItem } from "@/server/actions/items";
import { uploadFiles } from "@/server/actions/files";
import { authenticateRequest, gateErrorResponse } from "@/server/http/token-gate";
import { corsJson, corsPreflight } from "@/server/http/cors";
import { statusForActionError } from "@/server/http/action-status";

/**
 * Crea un elemento desde la extensión, con capturas de pantalla y la URL de
 * la página donde se lo anotó. Reusa `createItem` + `uploadFiles` (las mismas
 * actions del "crear rápido" de la app) en vez de tocar la base directo: la
 * capacidad (`content.write`) y el registro de actividad quedan en un solo
 * lugar.
 */
export const runtime = "nodejs";

const EXT_ITEM_TYPES = new Set(["task", "idea", "problem", "note"]);

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (auth.status !== "ok") return gateErrorResponse(request, auth.status);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return corsJson(request, { error: "El cuerpo tiene que ser multipart/form-data." }, { status: 400 });
  }

  const type = String(formData.get("type") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const pageUrl = String(formData.get("pageUrl") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (!EXT_ITEM_TYPES.has(type)) {
    return corsJson(
      request,
      { error: "El tipo tiene que ser task, idea, problem o note." },
      { status: 400 },
    );
  }
  if (!title || !projectId) {
    return corsJson(request, { error: "Faltan title o projectId." }, { status: 400 });
  }

  // El origen de la captura queda en el cuerpo, legible, no en un campo aparte
  // que la UI de la app no muestra en ningún lado.
  const fullBody = [body || null, pageUrl ? `Visto en: ${pageUrl}` : null]
    .filter(Boolean)
    .join("\n\n");

  const created = await actorStore.run(auth.context.user, () =>
    createItem({ type, title, projectId, body: fullBody || undefined }),
  );
  if (!created.ok) {
    return corsJson(request, { error: created.error }, { status: statusForActionError(created.error) });
  }

  if (files.length > 0) {
    const filesForm = new FormData();
    filesForm.set("itemId", created.data.id);
    for (const file of files) filesForm.append("files", file);
    const uploaded = await actorStore.run(auth.context.user, () => uploadFiles(filesForm));
    if (!uploaded.ok) {
      // El elemento ya se creó: se avisa de la falla de archivos sin perder el
      // item (200, no un error de request — el warning va aparte).
      return corsJson(request, {
        id: created.data.id,
        appUrl: itemAppUrl(request, projectId, created.data.id),
        warning: uploaded.error,
      });
    }
  }

  return corsJson(request, {
    id: created.data.id,
    appUrl: itemAppUrl(request, projectId, created.data.id),
  });
}

function itemAppUrl(request: Request, projectId: string, itemId: string): string {
  return `${new URL(request.url).origin}/p/${projectId}?item=${itemId}`;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return corsPreflight(request);
}
