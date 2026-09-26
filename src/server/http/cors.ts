import "server-only";

/**
 * CORS para `/api/ext/**` (la extensión del navegador).
 *
 * Solo se habilita para orígenes de extensión (`chrome-extension://`,
 * `moz-extension://`): se hace eco del origen exacto del request, nunca `*`,
 * y solo cuando matchea el patrón. Cualquier otro origen (o ausencia de
 * header `Origin`, como en un curl) no recibe encabezados CORS — el fetch
 * del navegador para ese caso ni siquiera los necesita.
 */
const EXTENSION_ORIGIN_RE = /^(chrome|moz)-extension:\/\//;

export function extensionCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || !EXTENSION_ORIGIN_RE.test(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

/** Respuesta JSON con los headers CORS de la extensión ya puestos. */
export function corsJson(request: Request, body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: { ...extensionCorsHeaders(request), ...(init.headers ?? {}) },
  });
}

/** Preflight `OPTIONS`: sin cuerpo, mismos headers. */
export function corsPreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: extensionCorsHeaders(request) });
}
