"use server";
import { requireTeamAction } from "@/server/auth/context";
import { getItem } from "@/server/domain/items";
import { itemHistory } from "@/server/domain/feed";
import type { ActivityEvent } from "@/lib/shared";
/**
 * Carga del panel de detalle.
 *
 * El panel se abre desde cualquier vista con `?item=…`, así que no puede
 * depender de que la página que está debajo haya traído el elemento. Pide lo
 * suyo cuando se abre y listo.
 */

export async function fetchItem(itemId: string) {
  const ctx = await requireTeamAction("content.write");
  const item = await getItem(itemId);
  if (!item) return null;
  return {
    item,
    viewerId: ctx.user.id,
    canWrite: ctx.can("content.write"),
  };
}

export async function fetchItemActivity(
  itemId: string,
): Promise<ActivityEvent[]> {
  await requireTeamAction("content.write");
  return itemHistory(itemId, 40);
}
export type ItemPayload = NonNullable<Awaited<ReturnType<typeof fetchItem>>>;
export type ItemData = ItemPayload["item"];
