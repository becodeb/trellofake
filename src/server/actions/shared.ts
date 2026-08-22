import "server-only";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

/**
 * Contrato único de las server actions. Los formularios y los botones no
 * manejan excepciones: reciben `{ ok }` y muestran el mensaje tal cual.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Envuelve una acción: valida, ejecuta y traduce cualquier error a un mensaje
 * que se pueda mostrar. Los errores inesperados no filtran detalles internos.
 */
/**
 * `redirect()` y `notFound()` funcionan lanzando un error con un `digest`
 * especial que el router de Next intercepta. Si lo tragáramos como cualquier
 * otro error, la navegación nunca ocurriría y la pantalla quedaría en blanco.
 */
function isNavigationSignal(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    /^NEXT_(REDIRECT|NOT_FOUND)/.test((error as { digest: string }).digest)
  );
}

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (isNavigationSignal(error)) throw error;
    if (error instanceof ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Datos inválidos." };
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHENTICATED") {
        return { ok: false, error: "Tu sesión expiró. Volvé a entrar." };
      }
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Algo salió mal. Probá de nuevo." };
  }
}

/** Refresca las vistas que dependen de un workspace. */
export function revalidateWorkspace(slug: string) {
  revalidatePath(`/w/${slug}`, "layout");
}
