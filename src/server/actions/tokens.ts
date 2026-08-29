"use server";

import { z } from "zod";

import { db } from "@/server/db";
import { requireWorkspaceAction } from "@/server/auth/context";
import { createApiToken } from "@/server/auth/token";
import { ok, run, revalidateWorkspace, type ActionResult } from "@/server/actions/shared";

const EXPIRY_OPTIONS = [
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 año" },
] as const;

/** Opciones de expiración que ofrece la UI. La acción acepta cualquier fecha futura. */
export const API_TOKEN_EXPIRY_OPTIONS = EXPIRY_OPTIONS;

const createSchema = z.object({
  expiresAt: z.coerce
    .date({ error: "La fecha de expiración es obligatoria." })
    .refine((date) => date > new Date(), "La expiración tiene que estar en el futuro."),
});

/**
 * Crea un token de acceso API para clientes MCP y devuelve el valor crudo
 * exactamente una vez (solo el hash queda persistido).
 */
export async function createApiTokenAction(
  slug: string,
  raw: unknown,
): Promise<ActionResult<{ rawToken: string }>> {
  return run(async () => {
    const ctx = await requireWorkspaceAction(slug, "api-tokens.create");
    const input = createSchema.parse(raw);

    const created = await createApiToken({
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      expiresAt: input.expiresAt,
    });

    revalidateWorkspace(slug);
    return { rawToken: created.raw };
  });
}

/**
 * Revocación soft: marca `revoked` y todo uso posterior del token recibe 401.
 * Revocar un token desconocido (o de otro workspace) es error.
 */
export async function revokeApiToken(slug: string, tokenId: string): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug, "api-tokens.revoke");
    const parsed = z.string().min(1).parse(tokenId);

    const token = await db.apiToken.findUnique({ where: { id: parsed } });
    if (!token || token.workspaceId !== ctx.workspace.id) {
      throw new Error("Ese token no existe.");
    }

    await db.apiToken.update({ where: { id: parsed }, data: { revoked: true } });
    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}