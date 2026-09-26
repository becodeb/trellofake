import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { randomUUID } from "node:crypto";

import { registerTools, tokenContextStore } from "@/server/mcp/tools";
import { actorStore } from "@/server/auth/actor";
import { authenticateRequest, gateErrorResponse } from "@/server/http/token-gate";

/**
 * Endpoint MCP (Streamable HTTP) — acceso de lectura por token de API.
 *
 * La ruta solo es dueña del HTTP: autenticación Bearer + rate limit (en
 * `@/server/http/token-gate`, compartido con `/api/ext/**`) y registro de
 * sesiones. El envelope JSON-RPC 2.0 (initialize, tools/list, tools/call y
 * los códigos -32601/-32602/-32002/-32603) lo resuelve el SDK.
 */
export const runtime = "nodejs";

/** Sesiones activas por Mcp-Session-Id (en memoria, por proceso). */
const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

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
  const auth = await authenticateRequest(request);
  if (auth.status !== "ok") return gateErrorResponse(request, auth.status);

  const transport = transportFor(request);
  if (!transport) return sessionNotFound();

  // Las tools de escritura llaman a las mismas server actions que la app: se
  // autentican con `getCurrentUser()` (cookie de sesión). Un cliente MCP no
  // manda cookie, así que el usuario del token viaja acá como "actor" —ver
  // `@/server/auth/actor`— y cada action resuelve membership/rol con su
  // propio `requireTeamAction()`, igual que si el usuario hubiera iniciado
  // sesión en el navegador.
  return actorStore.run(auth.context.user, () =>
    tokenContextStore.run(auth.context, () => transport.handleRequest(request)),
  );
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (auth.status !== "ok") return gateErrorResponse(request, auth.status);

  const sessionId = request.headers.get("mcp-session-id");
  if (!sessionId) return sessionNotFound();

  const transport = sessions.get(sessionId);
  if (!transport) return sessionNotFound();

  await transport.close();
  sessions.delete(sessionId);
  return new Response(null, { status: 200 });
}