import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { db } from "@/server/db";
import { listProjects, getProject } from "@/server/domain/projects";
import { getProjectDoc } from "@/server/domain/doc";
import { listItems, getItem } from "@/server/domain/items";
import { teamFeed } from "@/server/domain/feed";
import { search } from "@/server/domain/search";
import { listKnowledgeResources } from "@/server/domain/resources";
import { teamMembers } from "@/server/domain/dashboard";
import { registerWriteTools } from "@/server/mcp/write-tools";
import type { TokenContext } from "@/server/auth/token";
import {
  ITEM_TYPES,
  PROPOSAL_STATUSES,
  PROJECT_STATUSES,
  IDEA_STATUSES,
  PROBLEM_STATUSES,
  TASK_STATUSES,
  type ItemType,
} from "@/lib/domain";
import { SEARCH_KIND_LABEL, type SearchKind } from "@/lib/shared";
import { splitDocSegments } from "@/lib/doc";

/**
 * Herramientas de lectura `hilo_*` (mcp-read-tools).
 *
 * Contexto por request vía AsyncLocalStorage: la ruta corre `handleRequest`
 * dentro de `tokenContextStore.run(ctx, ...)` y cada handler lee su equipo y
 * su rol de ahí — nunca de los argumentos del cliente. Todas las queries
 * apuntan al equipo único de la instancia: no hay filtro de workspace ni
 * post-filtros de visibilidad (todo el contenido es público; el rol solo
 * existe para el contrato de capacidades).
 */
export const tokenContextStore = new AsyncLocalStorage<TokenContext>();

/** Exportada para que las tools de escritura (`write-tools.ts`) reusen la misma guarda. */
export function ctx(): TokenContext {
  const context = tokenContextStore.getStore();
  if (!context) throw new Error("MCP: contexto de token ausente.");
  return context;
}

/**
 * Sanitiza una respuesta de dominio antes de exponerla por MCP:
 * los `Date` pasan a ISO 8601 y los campos internos (`storageKey`, claves de
 * almacenamiento) se eliminan. Nunca exponer rutas de storage ni campos
 * internos.
 */
export function toWire<T>(value: T): T {
  const seen = new WeakSet<object>();
  const walk = (node: unknown): unknown => {
    if (node instanceof Date) return node.toISOString();
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      if (seen.has(node)) return undefined;
      seen.add(node);
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key === "storageKey") continue;
        const cleaned = walk(value);
        if (cleaned !== undefined) out[key] = cleaned;
      }
      return out;
    }
    return node;
  };
  return walk(value) as T;
}

/** Respuesta de texto JSON, pasada por `toWire` (sin storageKeys, fechas ISO). */
export function textResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(toWire(payload)) }] };
}

/** Limita cualquier lista a 100 ítems como máximo. */
const take = z.number().int().min(1).max(100).optional();

/**
 * Estados válidos entre todos los tipos de contenido (vocabulario de domain.ts).
 * Exportado para `hilo_set_item_status` en `write-tools.ts`.
 */
export const ALL_STATUSES = Array.from(
  new Set(
    [...TASK_STATUSES, ...IDEA_STATUSES, ...PROBLEM_STATUSES]
      .map((meta) => meta.value)
      .concat(["recorded", "decided", "posted"]),
  ),
);

const SEARCH_KINDS = Object.keys(SEARCH_KIND_LABEL) as [SearchKind, ...SearchKind[]];

const MAX_SEARCH_LIMIT = 50;

export function registerTools(server: McpServer) {
  // ------------------------------------------------------------------ projects

  server.registerTool(
    "hilo_list_projects",
    {
      description:
        "Lista los proyectos del equipo con su subárbol de subproyectos, progreso, estado y membresía.",
      inputSchema: {
        statuses: z.array(z.enum(PROJECT_STATUSES)).optional(),
        archived: z.boolean().optional(),
      },
    },
    async (args: { statuses?: string[]; archived?: boolean }) => {
      ctx();
      const rows = await listProjects({
        statuses: args.statuses,
        archived: args.archived,
      });
      return textResult(rows);
    },
  );

  server.registerTool(
    "hilo_get_project",
    {
      description:
        "Devuelve un proyecto por id con sus ancestros, subproyectos, enlaces y el " +
        "léeme (doc): el documento de contexto en Markdown, con qué es el proyecto y " +
        "qué hace falta para trabajar en él. null si no existe.",
      inputSchema: { projectId: z.string().min(1) },
    },
    async (args: { projectId: string }) => {
      const token = ctx();
      const project = await getProject(args.projectId);
      if (!project) return textResult(null);

      // El léeme puede tener bloques reservados al equipo. El token de una
      // cuenta de comunidad recibe el documento recortado, igual que su dueño
      // lo vería en la web: la IA nunca ve más que la persona que la conectó.
      const doc = await getProjectDoc(args.projectId);
      const markdown = doc
        ? splitDocSegments(doc.markdown)
            .filter(
              (segment) =>
                segment.audience === "everyone" || token.can("content.write"),
            )
            .map((segment) => segment.markdown)
            .join("\n\n")
        : null;

      return textResult({ ...project, doc: markdown || null });
    },
  );

  // --------------------------------------------------------------------- items

  server.registerTool(
    "hilo_list_items",
    {
      description:
        "Lista elementos (task, idea, note, problem, decision, update) con sus filtros.",
      inputSchema: {
        type: z.enum(ITEM_TYPES).optional(),
        statuses: z.array(z.enum(ALL_STATUSES as [string, ...string[]])).optional(),
        projectId: z.string().min(1).optional(),
        take,
      },
    },
    async (
      args: { type?: ItemType; statuses?: string[]; projectId?: string; take?: number },
    ) => {
      ctx();
      const rows = await listItems({
        projectIds: args.projectId ? [args.projectId] : undefined,
        types: args.type ? [args.type] : undefined,
        statuses: args.statuses,
        take: args.take,
      });
      return textResult(rows);
    },
  );

  server.registerTool(
    "hilo_get_item",
    {
      description:
        "Devuelve un elemento por id con comentarios, adjuntos y subtareas. null si no existe.",
      inputSchema: { itemId: z.string().min(1) },
    },
    async (args: { itemId: string }) => {
      ctx();
      const item = await getItem(args.itemId);
      return textResult(item);
    },
  );

  // ----------------------------------------------------------------- proposals

  server.registerTool(
    "hilo_list_proposals",
    {
      description:
        "Lista las propuestas de la comunidad con sus respuestas. El equipo sale del token.",
      inputSchema: {
        status: z.enum(PROPOSAL_STATUSES).optional(),
        take,
      },
    },
    async (args: { status?: string; take?: number }) => {
      ctx();
      const proposals = await db.proposal.findMany({
        where: {
          ...(args.status ? { status: args.status } : {}),
        },
        select: {
          id: true,
          title: true,
          body: true,
          category: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: { id: true, name: true, avatarUrl: true, accentColor: true },
          },
          targetProject: { select: { id: true, name: true } },
          promotedProject: { select: { id: true, name: true } },
          replies: {
            select: {
              id: true,
              body: true,
              createdAt: true,
              author: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: args.take,
      });

      return textResult(proposals);
    },
  );

  // ----------------------------------------------------------------- resources

  server.registerTool(
    "hilo_list_resources",
    {
      description:
        "Lista los recursos de conocimiento (bases de datos, APIs, repositorios, guías de acceso...).",
      inputSchema: { projectId: z.string().min(1).optional() },
    },
    async (args: { projectId?: string }) => {
      ctx();
      const rows = await listKnowledgeResources(args.projectId);
      return textResult(rows);
    },
  );

  // --------------------------------------------------------------------- people

  server.registerTool(
    "hilo_list_people",
    {
      description: "Lista las personas del equipo con su rol y título.",
      inputSchema: { take },
    },
    async (args: { take?: number }) => {
      ctx();
      const rows = await teamMembers();
      return textResult(args.take ? rows.slice(0, args.take) : rows);
    },
  );

  // ----------------------------------------------------------------------- feed

  server.registerTool(
    "hilo_get_feed",
    {
      description: "Actividad reciente del equipo.",
      inputSchema: {
        take,
        before: z.iso.datetime().optional(),
      },
    },
    async (args: { take?: number; before?: string }) => {
      ctx();
      const rows = await teamFeed({
        take: args.take,
        before: args.before ? new Date(args.before) : undefined,
      });
      return textResult(rows);
    },
  );

  // --------------------------------------------------------------------- search

  server.registerTool(
    "hilo_search",
    {
      description: "Búsqueda global en el equipo.",
      inputSchema: {
        query: z.string().trim().min(2, "El término de búsqueda tiene al menos 2 caracteres."),
        kinds: z.array(z.enum(SEARCH_KINDS)).optional(),
        limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).optional(),
      },
    },
    async (args: { query: string; kinds?: SearchKind[]; limit?: number }) => {
      ctx();
      const hits = await search(args.query, {
        kinds: args.kinds,
        limit: args.limit,
      });
      return textResult(hits);
    },
  );

  // Tools de escritura (`hilo_create_item`, `hilo_set_item_status`, ...):
  // corren las mismas server actions que la app vía el actor de
  // `@/server/auth/actor`, así que viven en su propio módulo.
  registerWriteTools(server);
}