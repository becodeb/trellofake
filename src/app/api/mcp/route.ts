import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { randomUUID } from "node:crypto";

import { registerTools, tokenContextStore } from "@/server/mcp/tools";
import { getTokenContext } from "@/server/auth/token";

/**
 * Endpoint MCP (Streamable HTTP) — acceso de lectura por token de API.
 *
 * La ruta solo es dueña del HTTP: autenticación Bearer, registro de sesiones y
 * rate limit. El envelope JSON-RPC 2.0 (initialize, tools/list, tools/call y
 * los códigos -32601/-32602/-32002/-32603) lo resuelve el SDK.
 */
export const runtime = "nodejs";

/** Sesiones activas por Mcp-Session-Id (en memoria, por proceso). */
const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

// ------------------------------------------------ rate limit (en proceso)

const RATE_LIMIT_PER_MINUTE = 120;
const RATE_WINDOW_MS = 60_000;

/** Timestamps de requests por tokenId — best-effort, solo este proceso. */
const requestLog = new Map<string, number[]>();

/** true si el token todavía tiene cuota en la ventana móvil de 1 minuto. */
function withinRateLimit(tokenId: string): boolean {
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

// ------------------------------------------------------------------- auth

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const raw = header.slice("Bearer ".length).trim();
  return raw.length > 0 ? raw : null;
}

function unauthorized() {
  return Response.json(
    { error: "Token de API inválido, vencido o revocado." },
    { status: 401, headers: { "content-type": "application/json" } },
  );
}

function forbidden() {
  return Response.json(
    { error: "El usuario del token ya no es miembro de este workspace." },
    { status: 403, headers: { "content-type": "application/json" } },
  );
}

function tooManyRequests() {
  return Response.json(
    { error: "Demasiados requests para este token. Probá en un minuto." },
    { status: 429, headers: { "content-type": "application/json", "retry-after": "60" } },
  );
}

/** Replica el error JSON-RPC del SDK para una sesión inexistente (404). */
function sessionNotFound() {
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Session not found" } },
    { status: 404, headers: { "content-type": "application/json" } },
  );
}

/**
 * Crea (o reutiliza) el transporte de la sesión. El primero que se conecta
 * sin `Mcp-Session-Id` debe ser `initialize`: el transporte asigna el id y lo
 * registramos vía `onsessioninitialized` para los requests siguientes.
 *
 * El protocolo del SDK admite UNA conexión por instancia, así que cada sesión
 * tiene su propio `McpServer` (registrar las 9 herramientas es barato).
 */
function transportFor(request: Request): WebStandardStreamableHTTPServerTransport | null {
  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId) {
    return sessions.get(sessionId) ?? null;
  }

  const server = new McpServer(
    { name: "hilo-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  registerTools(server);

  let transport: WebStandardStreamableHTTPServerTransport | undefined;
  transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      if (transport) sessions.set(id, transport);
    },
    onsessionclosed: (id) => {
      sessions.delete(id);
    },
  });
  // Conecta el protocolo del McpServer a este transporte. No se espera: la
  // promesa recién se resuelve cuando la sesión se cierra.
  void server.connect(transport);
  return transport;
}

// ----------------------------------------------------------------- handlers

export async function POST(request: Request): Promise<Response> {
  const raw = bearerToken(request);
  if (!raw) return unauthorized();

  const auth = await getTokenContext(raw);
  if (auth.status === "unauthorized") return unauthorized();
  if (auth.status === "forbidden") return forbidden();

  if (!withinRateLimit(auth.context.tokenId)) return tooManyRequests();

  const transport = transportFor(request);
  if (!transport) return sessionNotFound();

  return tokenContextStore.run(auth.context, () => transport.handleRequest(request));
}

export async function DELETE(request: Request): Promise<Response> {
  const raw = bearerToken(request);
  if (!raw) return unauthorized();

  const auth = await getTokenContext(raw);
  if (auth.status === "unauthorized") return unauthorized();
  if (auth.status === "forbidden") return forbidden();

  if (!withinRateLimit(auth.context.tokenId)) return tooManyRequests();

  const sessionId = request.headers.get("mcp-session-id");
  if (!sessionId) return sessionNotFound();

  const transport = sessions.get(sessionId);
  if (!transport) return sessionNotFound();

  await transport.close();
  sessions.delete(sessionId);
  return new Response(null, { status: 200 });
}