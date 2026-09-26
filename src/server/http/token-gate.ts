import "server-only";

import { getTokenContext, type TokenContext } from "@/server/auth/token";
import { extensionCorsHeaders } from "@/server/http/cors";

/**
 * Autenticación + rate limit por token de API, compartida entre `/api/mcp`
 * y `/api/ext/**`. Un solo lugar valida el `Authorization: Bearer` contra
 * `ApiToken` y cuenta requests por minuto — ningún route handler duplica esta
 * lógica.
 */

const RATE_LIMIT_PER_MINUTE = 120;
const RATE_WINDOW_MS = 60_000;

/** Timestamps de requests por tokenId — best-effort, solo este proceso. */
const requestLog = new Map<string, number[]>();

/** true si el token todavía tiene cuota en la ventana móvil de 1 minuto. */
export function withinRateLimit(tokenId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (requestLog.get(tokenId) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_PER_MINUTE) {
    requestLog.set(tokenId, recent);
    return false;
  }
  recent.push(now);
  requestLog.set(tokenId, recent);
  return true;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const raw = header.slice("Bearer ".length).trim();
  return raw.length > 0 ? raw : null;
}

export type TokenGateResult =
  | { status: "ok"; context: TokenContext }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "rate-limited" };

/** Bearer + `ApiToken` + rate limit, en un solo paso. */
export async function authenticateRequest(request: Request): Promise<TokenGateResult> {
  const raw = bearerToken(request);
  if (!raw) return { status: "unauthorized" };

  const auth = await getTokenContext(raw);
  if (auth.status === "unauthorized") return { status: "unauthorized" };
  if (auth.status === "forbidden") return { status: "forbidden" };

  if (!withinRateLimit(auth.context.tokenId)) return { status: "rate-limited" };
  return { status: "ok", context: auth.context };
}

const GATE_ERROR: Record<
  Exclude<TokenGateResult["status"], "ok">,
  { status: number; error: string; extra?: HeadersInit }
> = {
  unauthorized: { status: 401, error: "Token de API inválido, vencido o revocado." },
  forbidden: { status: 403, error: "El usuario del token ya no es miembro del equipo." },
  "rate-limited": {
    status: 429,
    error: "Demasiados requests para este token. Probá en un minuto.",
    extra: { "retry-after": "60" },
  },
};

/** Traduce un resultado no-`ok` de `authenticateRequest` a la respuesta HTTP. */
export function gateErrorResponse(
  request: Request,
  status: Exclude<TokenGateResult["status"], "ok">,
): Response {
  const meta = GATE_ERROR[status];
  return Response.json(
    { error: meta.error },
    { status: meta.status, headers: { ...extensionCorsHeaders(request), ...(meta.extra ?? {}) } },
  );
}
