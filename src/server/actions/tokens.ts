"use server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireTeamAction } from "@/server/auth/context";
import { createApiToken } from "@/server/auth/token";
import { ok, run, revalidateTeam, type ActionResult } from "@/server/actions/shared";
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
  raw: unknown,
): Promise<ActionResult<{ rawToken: string }>> {
  return run(async () => {
    const ctx = await requireTeamAction("api-tokens.create");
    const input = createSchema.parse(raw);
    const created = await createApiToken({
      userId: ctx.user.id,
      expiresAt: input.expiresAt,
    });
    revalidateTeam();
    return { rawToken: created.raw };
  });
}

/**
 * Revocación soft: marca `revoked` y todo uso posterior del token recibe 401.
 * Revocar un token desconocido es error.
 */

export async function revokeApiToken(tokenId: string): Promise<ActionResult> {
  const result = await run(async () => {
    await requireTeamAction("api-tokens.revoke");
    const parsed = z.string().min(1).parse(tokenId);
    const token = await db.apiToken.findUnique({ where: { id: parsed } });
    if (!token) {
      throw new Error("Ese token no existe.");
    }
    await db.apiToken.update({ where: { id: parsed }, data: { revoked: true } });
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}