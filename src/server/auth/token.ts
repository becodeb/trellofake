import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { db } from "@/server/db";
import { roleCan, type Capability } from "@/lib/domain";
import type { SessionUser } from "@/server/auth/session";

/**
 * Tokens de acceso API (clientes MCP).
 *
 * Mismo patrón que Session: el token viaja en el header `Authorization:
 * Bearer` y en la base guardamos solo su hash sha256, así una lectura de la
 * tabla ApiToken no permite suplantar a nadie. El token crudo se devuelve al
 * creador una sola vez, en la respuesta de la server action.
 */

/** Hash sha256 en hex del token crudo. Es el `id` de la fila ApiToken. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type CreatedApiToken = {
  /** Token crudo — única vez que se ve. Empieza con `hilo_`. */
  raw: string;
  /** Hash sha256 persistido (id de la fila). */
  id: string;
};

export async function createApiToken(args: {
  workspaceId: string;
  userId: string;
  expiresAt: Date;
}): Promise<CreatedApiToken> {
  const raw = `hilo_${randomBytes(32).toString("base64url")}`;
  const id = hashToken(raw);
  await db.apiToken.create({
    data: {
      id,
      workspaceId: args.workspaceId,
      userId: args.userId,
      expiresAt: args.expiresAt,
    },
  });
  return { raw, id };
}

export type TokenContext = {
  tokenId: string;
  workspace: { id: string; name: string; slug: string };
  user: SessionUser;
  /** Rol del usuario en el workspace al momento del request. */
  role: string;
  membershipId: string;
  can: (capability: Capability) => boolean;
};

export type TokenAuthResult =
  | { status: "ok"; context: TokenContext }
  /** Token desconocido, vencido o revocado → HTTP 401. */
  | { status: "unauthorized" }
  /** Token válido pero el usuario ya no es miembro del workspace → HTTP 403. */
  | { status: "forbidden" };

/**
 * Autentica un bearer token y deriva el contexto de workspace EXCLUSIVAMENTE
 * de la fila ApiToken que matchea su hash. Los argumentos del cliente nunca
 * pueden cambiar el workspaceId resultante.
 */
export async function getTokenContext(raw: string): Promise<TokenAuthResult> {
  const token = await db.apiToken.findUnique({
    where: { id: hashToken(raw) },
    select: {
      id: true,
      workspaceId: true,
      userId: true,
      expiresAt: true,
      revoked: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          accentColor: true,
        },
      },
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!token || token.revoked || token.expiresAt < new Date()) {
    return { status: "unauthorized" };
  }

  const membership = await db.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: token.userId,
        workspaceId: token.workspaceId,
      },
    },
    select: { id: true, role: true },
  });
  if (!membership) return { status: "forbidden" };

  return {
    status: "ok",
    context: {
      tokenId: token.id,
      workspace: token.workspace,
      user: token.user,
      role: membership.role,
      membershipId: membership.id,
      can: (capability) => roleCan(membership.role, capability),
    },
  };
}