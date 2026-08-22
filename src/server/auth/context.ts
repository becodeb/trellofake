import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { db } from "@/server/db";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";
import { roleCan, type Capability } from "@/lib/domain";

export type WorkspaceContext = {
  user: SessionUser;
  workspace: { id: string; name: string; slug: string; mission: string | null };
  role: string;
  membershipId: string;
  /** Momento de la última visita, congelado al entrar: define qué es "nuevo". */
  lastSeenAt: Date;
  can: (capability: Capability) => boolean;
};

/**
 * Punto único de entrada a cualquier dato de workspace. Nada en la app lee la
 * base sin pasar por acá: garantiza que el usuario esté autenticado y que sea
 * miembro del workspace pedido.
 */
export const getWorkspaceContext = cache(
  async (slug: string): Promise<WorkspaceContext | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const membership = await db.membership.findFirst({
      where: { userId: user.id, workspace: { slug } },
      select: {
        id: true,
        role: true,
        lastSeenAt: true,
        workspace: {
          select: { id: true, name: true, slug: true, mission: true },
        },
      },
    });

    if (!membership) return null;

    return {
      user,
      workspace: membership.workspace,
      role: membership.role,
      membershipId: membership.id,
      lastSeenAt: membership.lastSeenAt,
      can: (capability) => roleCan(membership.role, capability),
    };
  },
);

/** Para páginas: redirige a login o devuelve 404 si no es miembro. */
export async function requireWorkspace(slug: string): Promise<WorkspaceContext> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/w/${slug}`)}`);
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();
  return ctx;
}

/** Para server actions: lanza en vez de redirigir. */
export async function requireWorkspaceAction(
  slug: string,
  capability?: Capability,
): Promise<WorkspaceContext> {
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) throw new Error("No tenés acceso a este workspace.");
  if (capability && !ctx.can(capability)) {
    throw new Error("Tu rol no permite esta acción.");
  }
  return ctx;
}

/** Workspace por defecto del usuario, para la ruta raíz. */
export async function defaultWorkspaceSlug(userId: string) {
  const membership = await db.membership.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: { workspace: { select: { slug: true } } },
  });
  return membership?.workspace.slug ?? null;
}
