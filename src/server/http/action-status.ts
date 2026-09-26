import "server-only";

/**
 * Traduce el mensaje de un `ActionResult` fallido al status HTTP de
 * `/api/ext/**`. Las server actions (`requireTeamAction`) son la única fuente
 * de verdad sobre capacidades — acá no se repite esa regla, solo se reconoce
 * el mensaje exacto que ya tiran para devolver 403 en vez de 400.
 */
const FORBIDDEN_MESSAGE = "Tu rol no permite esta acción.";

export function statusForActionError(message: string): number {
  return message === FORBIDDEN_MESSAGE ? 403 : 400;
}
