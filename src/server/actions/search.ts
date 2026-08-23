"use server";

import { requireWorkspaceAction } from "@/server/auth/context";
import { search, type SearchHit } from "@/server/domain/search";

/** Búsqueda desde el cliente (paleta de comandos y página de resultados). */
export async function quickSearch(
  slug: string,
  query: string,
): Promise<SearchHit[]> {
  const ctx = await requireWorkspaceAction(slug, "content.write");
  return search(ctx.workspace.id, slug, query, { limit: 20 });
}
