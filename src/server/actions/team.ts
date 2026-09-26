"use server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireTeamAction } from "@/server/auth/context";
import { hashPassword } from "@/server/auth/session";
import { recordActivity, touchLastSeen } from "@/server/domain/activity";
import { markFeedRead } from "@/server/domain/feed";
import { ok, run, revalidateTeam, type ActionResult } from "@/server/actions/shared";
import { ACTIVITY, WORKSPACE_ROLES, accentFromId } from "@/lib/domain";
import { temporaryPassword } from "@/lib/slug";
export const settingsSchema = z.object({
  name: z.string().trim().min(2, "El equipo necesita un nombre."),
  mission: z.string().trim().max(280).nullable().optional(),
});

export async function updateTeam(raw: unknown): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("workspace.manage");
    const input = settingsSchema.parse(raw);
    await db.team.update({
      where: { id: ctx.team.id },
      data: { name: input.name, mission: input.mission ?? null },
    });
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}
export const memberSchema = z.object({
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
 * Si el email ya tiene cuenta, se le agrega la membresía. Si no, se crea la
 * cuenta con una contraseña temporal que se le muestra al admin una sola vez
 * para que se la pase; nadie elige la contraseña de otra persona.
 */

export async function addMember(
  raw: unknown,
): Promise<ActionResult<{ temporaryPassword: string | null; name: string }>> {
  return run(async () => {
    const ctx = await requireTeamAction("member.manage");
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
      where: { userId },
      select: { id: true },
    });
    if (already) throw new Error("Esa persona ya está en el equipo.");
    await db.membership.create({
      data: {
        userId,
        role: input.role,
        title: input.title || null,
      },
    });
    await recordActivity({
      actorId: ctx.user.id,
      verb: ACTIVITY.memberJoined,
      targetType: "member",
      targetId: userId,
      targetLabel: existing?.name ?? input.name,
      meta: { role: input.role },
      audience: [{ userId, reason: "participant" }],
    });
    revalidateTeam();
    return { temporaryPassword: tempPassword, name: existing?.name ?? input.name };
  });
}

export async function setMemberRole(
  userId: string,
  role: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("member.manage");
    const parsed = z.enum(WORKSPACE_ROLES).parse(role);
    const membership = await db.membership.findUnique({
      where: { userId },
      select: { id: true, role: true, user: { select: { name: true } } },
    });
    if (!membership) throw new Error("Esa persona no está en el equipo.");
    // El equipo no puede quedarse sin admins.
    if (membership.role === "admin" && parsed !== "admin") {
      const admins = await db.membership.count({ where: { role: "admin" } });
      if (admins <= 1) throw new Error("Tiene que quedar al menos un admin.");
    }
    await db.membership.update({ where: { id: membership.id }, data: { role: parsed } });
    await recordActivity({
      actorId: ctx.user.id,
      verb: ACTIVITY.memberRoleChanged,
      targetType: "member",
      targetId: userId,
      targetLabel: membership.user.name,
      meta: { from: membership.role, to: parsed },
      audience: [{ userId, reason: "participant" }],
    });
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("member.manage");
    if (userId === ctx.user.id) throw new Error("No podés sacarte a vos mismo del equipo.");
    const membership = await db.membership.findUnique({
      where: { userId },
      select: { id: true, role: true, user: { select: { name: true } } },
    });
    if (!membership) throw new Error("Esa persona no está en el equipo.");
    if (membership.role === "admin") {
      const admins = await db.membership.count({ where: { role: "admin" } });
      if (admins <= 1) throw new Error("Tiene que quedar al menos un admin.");
    }
    await db.membership.delete({ where: { id: membership.id } });
    await recordActivity({
      actorId: ctx.user.id,
      verb: ACTIVITY.memberRemoved,
      targetType: "member",
      targetId: userId,
      targetLabel: membership.user.name,
    });
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

/** Marca novedades como leídas y mueve la línea de "desde tu última visita". */

export async function markRead(entryId?: string): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction();
    await markFeedRead(ctx.user.id, entryId);
    if (!entryId && ctx.membershipId) await touchLastSeen(ctx.membershipId);
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}

/** Se llama al abrir el inbox: registra la visita sin marcar todo como leído. */

export async function touchVisit(): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction();
    if (ctx.membershipId) await touchLastSeen(ctx.membershipId);
  });
  return result.ok ? ok() : result;
}