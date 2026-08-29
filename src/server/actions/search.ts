"use server";
import { requireTeamAction } from "@/server/auth/context";
import { search, type SearchHit } from "@/server/domain/search";
/** Búsqueda desde el cliente (paleta de comandos y página de resultados). */

export async function quickSearch(
  query: string,
): Promise<SearchHit[]> {
  const ctx = await requireTeamAction("content.write");
  return search(query, { limit: 20 });
}
