import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import bcrypt from "bcryptjs";

import { db } from "@/server/db";
import { actorStore } from "@/server/auth/actor";

const COOKIE = "hilo_session";
const TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  accentColor: string;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 11);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/**
 * El token viaja en la cookie; en la base guardamos solo su hash, así una
 * lectura de la tabla de sesiones no permite suplantar a nadie.
 */
function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: { id: tokenHash(token), userId, expiresAt },
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { id: tokenHash(token) } });
  }
  jar.delete(COOKIE);
}

/**
 * `cache` deduplica la lectura dentro de un mismo render: el layout, la página
 * y cada server component piden el usuario y se hace una sola query. Fuera de
 * un render (p. ej. en el route handler de `/api/mcp`) `cache` no memoiza —ver
 * la nota en `@/server/auth/actor`— así que ahí esta función corre de cero en
 * cada llamada, sin deduplicar pero también sin arrastrar nada entre requests.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Un cliente MCP autenticado por token nunca manda la cookie de sesión: su
  // usuario viaja en este AsyncLocalStorage, seteado por la ruta `/api/mcp`
  // una vez que valida el `ApiToken`. Si está presente, es la fuente de
  // verdad y la cookie ni se lee.
  const actor = actorStore.getStore();
  if (actor) return actor;

  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { id: tokenHash(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          accentColor: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
