import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { db } from "@/server/db";
import { listProjects, getProject } from "@/server/domain/projects";
import { listItems, getItem } from "@/server/domain/items";
import { workspaceFeed } from "@/server/domain/feed";
import { search } from "@/server/domain/search";
import { listKnowledgeResources } from "@/server/domain/resources";
import { workspaceMembers } from "@/server/domain/dashboard";
import { filterVisibleHits, toWire, visibleProjectIds } from "@/server/mcp/visibility";
import type { TokenContext } from "@/server/auth/token";
import {
  ITEM_TYPES,
  isTeamRole,
  PROPOSAL_STATUSES,
  PROJECT_STATUSES,
  IDEA_STATUSES,
  PROBLEM_STATUSES,
  TASK_STATUSES,
  type ItemType,
} from "@/lib/domain";
import { SEARCH_KIND_LABEL, type SearchKind } from "@/lib/shared";

/**
 * Herramientas de lectura `hilo_*` (mcp-read-tools).
 *
 * Contexto por request vía AsyncLocalStorage: la ruta corre `handleRequest`
 * dentro de `tokenContextStore.run(ctx, ...)` y cada handler lee su workspace
 * y su rol de ahí — nunca de los argumentos del cliente. Todas las queries van
 * hard-scoped al `workspaceId` del token.
 */
export const tokenContextStore = new AsyncLocalStorage<TokenContext>();

function ctx(): TokenContext {
  const context = tokenContextStore.getStore();
  if (!context) throw new Error("MCP: contexto de token ausente.");
  return context;
}

/** Respuesta de texto JSON, pasada por `toWire` (sin storageKeys, fechas ISO). */
function textResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(toWire(payload)) }] };
}

/** Limita cualquier lista a 100 ítems como máximo. */
const take = z.number().int().min(1).max(100).optional();

/** Estados válidos entre todos los tipos de contenido (vocabulario de domain.ts). */
const ALL_STATUSES = Array.from(
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
        "Lista los proyectos del workspace con su subárbol de subproyectos, progreso, estado y membresía. Respeta la visibilidad del rol del token.",
      inputSchema: {
        statuses: z.array(z.enum(PROJECT_STATUSES)).optional(),
        archived: z.boolean().optional(),
      },
    },
    async (args: { statuses?: string[]; archived?: boolean }) => {
      const c = ctx();
      const rows = await listProjects(c.workspace.id, {
        statuses: args.statuses,
        archived: args.archived,
        viewer: { role: c.role, userId: c.user.id },
      });
      return textResult(rows);
    },
  );

  server.registerTool(
    "hilo_get_project",
    {
      description:
        "Devuelve un proyecto por id con sus ancestros, subproyectos y enlaces. null si no existe o no es visible para el token.",
      inputSchema: { projectId: z.string().min(1) },
    },
    async (args: { projectId: string }) => {
      const c = ctx();
      const project = await getProject(c.workspace.id, args.projectId, {
        role: c.role,
        userId: c.user.id,
      });
      return textResult(project);
    },
  );

  // --------------------------------------------------------------------- items

  server.registerTool(
    "hilo_list_items",
    {
      description:
        "Lista elementos (task, idea, note, problem, decision, update) con sus filtros. projectId de otro workspace o no visible devuelve una lista vacía.",
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
      const c = ctx();
      const teamView = isTeamRole(c.role);
      const viewer = { role: c.role, userId: c.user.id };

      let projectIds: string[] | undefined;
      if (args.projectId) {
        if (teamView || (await visibleProjectIds(c.workspace.id, viewer)).has(args.projectId)) {
          projectIds = [args.projectId];
        } else {
          projectIds = [];
        }
      } else if (!teamView) {
        // Sin projectId y rol no-team: acotar a los proyectos visibles (D1),
        // mismo patrón que hilo_get_feed para comunidad.
        projectIds = Array.from(await visibleProjectIds(c.workspace.id, viewer));
      }

      const rows = await listItems(c.workspace.id, {
        projectIds,
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
        "Devuelve un elemento por id con comentarios, adjuntos y subtareas. null si no existe o su proyecto no es visible para el token.",
      inputSchema: { itemId: z.string().min(1) },
    },
    async (args: { itemId: string }) => {
      const c = ctx();
      const item = await getItem(c.workspace.id, args.itemId);
      if (!item) return textResult(null);

      const visible = await visibleProjectIds(c.workspace.id, {
        role: c.role,
        userId: c.user.id,
      });
      if (!visible.has(item.projectId)) return textResult(null);

      return textResult(item);
    },
  );

  // ----------------------------------------------------------------- proposals

  server.registerTool(
    "hilo_list_proposals",
    {
      description:
        "Lista las propuestas de la comunidad con sus respuestas. El workspace sale del token; targetProject solo se incluye si el rol puede escribir contenido o el proyecto es comunitario.",
      inputSchema: {
        status: z.enum(PROPOSAL_STATUSES).optional(),
        take,
      },
    },
    async (args: { status?: string; take?: number }) => {
      const c = ctx();
      const proposals = await db.proposal.findMany({
        where: {
          // Hard-scoped al workspace del token — nunca del cliente.
          workspaceId: c.workspace.id,
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
          targetProject: { select: { id: true, name: true, visibility: true } },
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

      // Mismo criterio que la página de ideas: el proyecto destino solo se
      // muestra si el viewer puede escribir o es comunitario.
      const safe = proposals.map((proposal) => ({
        ...proposal,
        targetProject:
          proposal.targetProject &&
          (c.can("content.write") || proposal.targetProject.visibility === "community")
            ? proposal.targetProject
            : null,
      }));

      return textResult(safe);
    },
  );

  // ----------------------------------------------------------------- resources

  server.registerTool(
    "hilo_list_resources",
    {
      description:
        "Lista los recursos de conocimiento (bases de datos, APIs, repositorios, guías de acceso...). Un projectId no visible devuelve una lista vacía.",
      inputSchema: { projectId: z.string().min(1).optional() },
    },
    async (args: { projectId?: string }) => {
      const c = ctx();
      const viewer = { role: c.role, userId: c.user.id };

      if (args.projectId && !isTeamRole(c.role)) {
        const visible = await visibleProjectIds(c.workspace.id, viewer);
        if (!visible.has(args.projectId)) return textResult([]);
      }

      const rows = await listKnowledgeResources(c.workspace.id, viewer, args.projectId);
      return textResult(rows);
    },
  );

  // --------------------------------------------------------------------- people

  server.registerTool(
    "hilo_list_people",
    {
      description: "Lista las personas del workspace con su rol y título.",
      inputSchema: { take },
    },
    async (args: { take?: number }) => {
      const c = ctx();
      const rows = await workspaceMembers(c.workspace.id);
      return textResult(args.take ? rows.slice(0, args.take) : rows);
    },
  );

  // ----------------------------------------------------------------------- feed

  server.registerTool(
    "hilo_get_feed",
    {
      description:
        "Actividad reciente del workspace. Los tokens de comunidad ven solo eventos de proyectos visibles; los de equipo ven todo.",
      inputSchema: {
        take,
        before: z.iso.datetime().optional(),
      },
    },
    async (args: { take?: number; before?: string }) => {
      const c = ctx();
      const teamView = isTeamRole(c.role);

      const projectIds = teamView
        ? undefined
        : Array.from(
            await visibleProjectIds(c.workspace.id, { role: c.role, userId: c.user.id }),
          );

      const rows = await workspaceFeed(c.workspace.id, {
        take: args.take,
        before: args.before ? new Date(args.before) : undefined,
        projectIds,
      });
      return textResult(rows);
    },
  );

  // --------------------------------------------------------------------- search

  server.registerTool(
    "hilo_search",
    {
      description:
        "Búsqueda global en el workspace. Los tokens de comunidad no ven resultados de proyectos de equipo.",
      inputSchema: {
        query: z.string().trim().min(2, "El término de búsqueda tiene al menos 2 caracteres."),
        kinds: z.array(z.enum(SEARCH_KINDS)).optional(),
        limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).optional(),
      },
    },
    async (args: { query: string; kinds?: SearchKind[]; limit?: number }) => {
      const c = ctx();
      const hits = await search(c.workspace.id, c.workspace.slug, args.query, {
        kinds: args.kinds,
        limit: args.limit,
      });

      const teamView = isTeamRole(c.role);
      if (teamView) return textResult(hits);

      // Post-filtro de visibilidad (D1): los hits no traen projectId, así que
      // el adaptador lo resuelve con una query extra y filtra en memoria.
      const visible = await visibleProjectIds(c.workspace.id, {
        role: c.role,
        userId: c.user.id,
      });

      const itemIds = hits.filter((h) => (ITEM_TYPES as readonly string[]).includes(h.kind)).map((h) => h.id);
      const commentIds = hits.filter((h) => h.kind === "comment").map((h) => h.id);
      const fileIds = hits.filter((h) => h.kind === "file").map((h) => h.id);

      const [items, comments, files] = await Promise.all([
        itemIds.length
          ? db.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, projectId: true } })
          : Promise.resolve([] as Array<{ id: string; projectId: string }>),
        commentIds.length
          ? db.comment.findMany({
              where: { id: { in: commentIds } },
              select: { id: true, projectId: true, item: { select: { projectId: true } } },
            })
          : Promise.resolve([] as Array<{ id: string; projectId: string; item: { projectId: string } | null }>),
        fileIds.length
          ? db.attachment.findMany({
              where: { id: { in: fileIds } },
              select: { id: true, projectId: true, item: { select: { projectId: true } } },
            })
          : Promise.resolve([] as Array<{ id: string; projectId: string; item: { projectId: string } | null }>),
      ]);

      const projectByHit = new Map<string, string | undefined>();
      for (const item of items) projectByHit.set(item.id, item.projectId);
      for (const comment of comments) {
        projectByHit.set(comment.id, comment.item?.projectId ?? comment.projectId ?? undefined);
      }
      for (const file of files) {
        projectByHit.set(file.id, file.item?.projectId ?? file.projectId ?? undefined);
      }

      const filtered = filterVisibleHits(
        hits.map((hit) => ({ ...hit, projectId: projectByHit.get(hit.id) })),
        visible,
      );
      return textResult(filtered);
    },
  );
}