import "server-only";

import { listProjects } from "@/server/domain/projects";
import type { SearchHit } from "@/lib/shared";

/**
 * Composición de visibilidad para las herramientas MCP (decisión D1 del
 * design): el dominio no cambia ninguna firma; el adaptador calcula los ids
 * visibles una vez con `listProjects(ws, { viewer })` (que ya aplica
 * `projectAccess`) y scoping de queries o post-filtros a partir de ahí.
 */

/**
 * Todos los ids de proyecto que el viewer puede ver, incluyendo los
 * subproyectos (los `subtreeIds` que ya devuelve `listProjects`).
 */
export async function visibleProjectIds(
  workspaceId: string,
  viewer: { role: string; userId: string },
): Promise<Set<string>> {
  const projects = await listProjects(workspaceId, { viewer });
  const ids = new Set<string>();
  for (const project of projects) {
    for (const id of project.subtreeIds) ids.add(id);
  }
  return ids;
}

/**
 * Filtro puro de hits de búsqueda contra los ids visibles.
 *
 * - hits de persona no llevan proyecto: se conservan siempre
 * - hits de proyecto: el id del hit debe ser visible
 * - hits de item/comentario/archivo: su `projectId` debe ser visible
 */
export function filterVisibleHits(
  hits: Array<SearchHit & { projectId?: string | null }>,
  visibleIds: ReadonlySet<string>,
): SearchHit[] {
  return hits.filter((hit) => {
    if (hit.kind === "person") return true;
    if (hit.kind === "project") return visibleIds.has(hit.id);
    return hit.projectId != null && visibleIds.has(hit.projectId);
  });
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