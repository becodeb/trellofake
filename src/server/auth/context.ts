import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { db } from "@/server/db";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";
import { roleCan, type Capability } from "@/lib/domain";

export type TeamContext = {
  /** null cuando no hay sesión: las páginas públicas se sirven igual. */
  user: SessionUser | null;
  team: { id: string; name: string; slug: string; mission: string | null };
  /** "guest" para visitantes sin sesión ni membresía. */
  role: string;
  membershipId: string | null;
  /** Momento de la última visita, congelado al entrar: define qué es "nuevo". */
  lastSeenAt: Date | null;
  can: (capability: Capability) => boolean;
};

/**
 * Punto único de entrada a los datos del equipo. Nada en la app lee la base
 * sin pasar por acá.
 *
 * Es guest-safe: sin sesión (o sin membresía) devuelve un contexto huésped con
 * rol "guest" y `can()` → false, para que las páginas públicas se sirvan sin
 * login y las acciones de escritura queden bloqueadas.
 */
export const getTeamContext = cache(async (): Promise<TeamContext> => {
  const user = await getCurrentUser();

  const team = await db.team.findFirst({
    select: { id: true, name: true, slug: true, mission: true },
  });
  if (!team) {
    // Instancia sin sembrar: contexto inerte, nada se puede hacer todavía.
    return {
      user,
      team: { id: "", name: "", slug: "", mission: null },
      role: "guest",
      membershipId: null,
      lastSeenAt: null,
      can: () => false,
    };
  }

  const membership = user
    ? await db.membership.findUnique({
        where: { userId: user.id },
        select: { id: true, role: true, lastSeenAt: true },
      })
    : null;

  if (!user || !membership) {
    return {
      user,
      team,
      role: "guest",
      membershipId: null,
      lastSeenAt: null,
      can: () => false,
    };
  }

  return {
    user,
    team,
    role: membership.role,
    membershipId: membership.id,
    lastSeenAt: membership.lastSeenAt,
    can: (capability) => roleCan(membership.role, capability),
  };
});

/**
 * Para server actions: lanza en vez de redirigir. `run()` traduce
 * "UNAUTHENTICATED" a un `{ ok: false }` amigable, así el visitante ve un
 * mensaje y no una excepción.
 */
export async function requireTeamAction(
  capability?: Capability,
): Promise<TeamContext & { user: SessionUser; membershipId: string }> {
  const ctx = await getTeamContext();
  if (!ctx.user || !ctx.membershipId) throw new Error("UNAUTHENTICATED");
  if (capability && !ctx.can(capability)) {
    throw new Error("Tu rol no permite esta acción.");
  }
  return ctx as TeamContext & { user: SessionUser; membershipId: string };
}

/** Para páginas que exigen sesión: el visitante va a login en vez de verla. */
export async function requireMember(): Promise<
  TeamContext & { user: SessionUser; membershipId: string }
> {
  const ctx = await getTeamContext();
  if (!ctx.user || !ctx.membershipId) redirect("/login");
  return ctx as TeamContext & { user: SessionUser; membershipId: string };
}