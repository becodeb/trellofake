"use server";

import { z } from "zod";

import { db } from "@/server/db";
import { requireWorkspaceAction } from "@/server/auth/context";
import { hashPassword, requireUser } from "@/server/auth/session";
import { recordActivity, touchLastSeen } from "@/server/domain/activity";
import { markFeedRead } from "@/server/domain/feed";
import { ok, run, revalidateWorkspace, type ActionResult } from "@/server/actions/shared";
import { ACTIVITY, WORKSPACE_ROLES, accentFromId } from "@/lib/domain";
import { slugify, temporaryPassword } from "@/lib/slug";

/** Crea un workspace y deja a quien lo crea como su primer admin. */
export async function createWorkspace(
  name: string,
): Promise<ActionResult<{ slug: string }>> {
  return run(async () => {
    const user = await requireUser();
    const parsed = z.string().trim().min(2, "Poné un nombre para el equipo.").parse(name);

    let slug = slugify(parsed) || "equipo";
    let suffix = 1;
    while (await db.workspace.findUnique({ where: { slug } })) {
      slug = `${slugify(parsed) || "equipo"}-${++suffix}`;
    }

    await db.workspace.create({
      data: {
        name: parsed,
        slug,
        members: { create: { userId: user.id, role: "admin" } },
      },
    });

    return { slug };
  });
}

const settingsSchema = z.object({
  name: z.string().trim().min(2, "El equipo necesita un nombre."),
  mission: z.string().trim().max(280).nullable().optional(),
});

export async function updateWorkspace(slug: string, raw: unknown): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug, "workspace.manage");
    const input = settingsSchema.parse(raw);
    await db.workspace.update({
      where: { id: ctx.workspace.id },
      data: { name: input.name, mission: input.mission ?? null },
    });
    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}

const memberSchema = z.object({
  name: z.string().trim().min(2, "Escribí el nombre de la persona."),
  email: z
    .string()
    .trim()
    .min(1, "Escribí un email.")
    .email("Ese email no parece válido.")
    .transform((v) => v.toLowerCase()),
  role: z.enum(WORKSPACE_ROLES).default("community"),
  title: z.string().trim().max(60).optional(),
});

/**
 * Alta de una persona en el equipo.
 *
 * Si el email ya tiene cuenta, se la suma al workspace. Si no, se crea la
 * cuenta con una contraseña temporal que se le muestra al admin una sola vez
 * para que se la pase; nadie elige la contraseña de otra persona.
 */
export async function addMember(
  slug: string,
  raw: unknown,
): Promise<ActionResult<{ temporaryPassword: string | null; name: string }>> {
  return run(async () => {
    const ctx = await requireWorkspaceAction(slug, "member.manage");
    const input = memberSchema.parse(raw);

    const existing = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true, name: true },
    });

    let userId = existing?.id;
    let tempPassword: string | null = null;

    if (!userId) {
      tempPassword = temporaryPassword();
      const created = await db.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: await hashPassword(tempPassword),
        },
        select: { id: true },
      });
      userId = created.id;
      await db.user.update({
        where: { id: userId },
        data: { accentColor: accentFromId(userId) },
      });
    }

    const already = await db.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: ctx.workspace.id } },
      select: { id: true },
    });
    if (already) throw new Error("Esa persona ya está en el equipo.");

    await db.membership.create({
      data: {
        userId,
        workspaceId: ctx.workspace.id,
        role: input.role,
        title: input.title || null,
      },
    });

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.memberJoined,
      targetType: "member",
      targetId: userId,
      targetLabel: existing?.name ?? input.name,
      meta: { role: input.role },
      audience: [{ userId, reason: "participant" }],
    });

    revalidateWorkspace(slug);
    return { temporaryPassword: tempPassword, name: existing?.name ?? input.name };
  });
}

export async function setMemberRole(
  slug: string,
  userId: string,
  role: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug, "member.manage");
    const parsed = z.enum(WORKSPACE_ROLES).parse(role);

    const membership = await db.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: ctx.workspace.id } },
      select: { id: true, role: true, user: { select: { name: true } } },
    });
    if (!membership) throw new Error("Esa persona no está en el equipo.");

    // Un workspace no puede quedarse sin admins.
    if (membership.role === "admin" && parsed !== "admin") {
      const admins = await db.membership.count({
        where: { workspaceId: ctx.workspace.id, role: "admin" },
      });
      if (admins <= 1) throw new Error("Tiene que quedar al menos un admin.");
    }

    await db.membership.update({ where: { id: membership.id }, data: { role: parsed } });

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.memberRoleChanged,
      targetType: "member",
      targetId: userId,
      targetLabel: membership.user.name,
      meta: { from: membership.role, to: parsed },
      audience: [{ userId, reason: "participant" }],
    });

    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}

export async function removeMember(slug: string, userId: string): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug, "member.manage");
    if (userId === ctx.user.id) throw new Error("No podés sacarte a vos mismo del equipo.");

    const membership = await db.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: ctx.workspace.id } },
      select: { id: true, role: true, user: { select: { name: true } } },
    });
    if (!membership) throw new Error("Esa persona no está en el equipo.");

    if (membership.role === "admin") {
      const admins = await db.membership.count({
        where: { workspaceId: ctx.workspace.id, role: "admin" },
      });
      if (admins <= 1) throw new Error("Tiene que quedar al menos un admin.");
    }

    await db.membership.delete({ where: { id: membership.id } });

    await recordActivity({
      workspaceId: ctx.workspace.id,
      actorId: ctx.user.id,
      verb: ACTIVITY.memberRemoved,
      targetType: "member",
      targetId: userId,
      targetLabel: membership.user.name,
    });

    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}

/** Marca novedades como leídas y mueve la línea de "desde tu última visita". */
export async function markRead(slug: string, entryId?: string): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug);
    await markFeedRead(ctx.workspace.id, ctx.user.id, entryId);
    if (!entryId) await touchLastSeen(ctx.membershipId);
    revalidateWorkspace(slug);
  });
  return result.ok ? ok() : result;
}

/** Se llama al abrir el inbox: registra la visita sin marcar todo como leído. */
export async function touchVisit(slug: string): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireWorkspaceAction(slug);
    await touchLastSeen(ctx.membershipId);
  });
  return result.ok ? ok() : result;
}
