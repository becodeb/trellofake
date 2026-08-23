"use server";

import { requireWorkspaceAction } from "@/server/auth/context";
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
export async function fetchItem(slug: string, itemId: string) {
  const ctx = await requireWorkspaceAction(slug, "content.write");
  const item = await getItem(ctx.workspace.id, itemId);
  if (!item) return null;

  return {
    item,
    viewerId: ctx.user.id,
    canWrite: ctx.can("content.write"),
  };
}

export async function fetchItemActivity(
  slug: string,
  itemId: string,
): Promise<ActivityEvent[]> {
  await requireWorkspaceAction(slug, "content.write");
  return itemHistory(itemId, 40);
}

export type ItemPayload = NonNullable<Awaited<ReturnType<typeof fetchItem>>>;
export type ItemData = ItemPayload["item"];
