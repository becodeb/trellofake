"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { db } from "@/server/db";
import {
  createSession,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/server/auth/session";
import { ok, run, type ActionResult } from "@/server/actions/shared";
import { slugify } from "@/lib/slug";
import { accentFromId } from "@/lib/domain";

const emailField = z
  .string()
  .trim()
  .min(1, "Escribí tu email.")
  .email("Ese email no parece válido.")
  .transform((value) => value.toLowerCase());

const passwordField = z.string().min(8, "La contraseña necesita al menos 8 caracteres.");

const signupSchema = z.object({
  name: z.string().trim().min(2, "Escribí tu nombre."),
  email: emailField,
  password: passwordField,
  workspaceName: z.string().trim().min(2, "Poné un nombre para el equipo."),
});

/**
 * El alta redirige desde el servidor. Hacerlo en el cliente después de recibir
 * el slug obliga a un router.replace seguido de un refresh, y ese refresh
 * vuelve a renderizar esta misma ruta —que ahora redirige— dejando la pantalla
 * en blanco a mitad de camino.
 */
export async function signup(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<never>> {
  return run(async () => {
    const input = signupSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      workspaceName: formData.get("workspaceName"),
    });

    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) throw new Error("Ya existe una cuenta con ese email.");

    const user = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
      },
      select: { id: true },
    });

    await db.user.update({
      where: { id: user.id },
      data: { accentColor: accentFromId(user.id) },
    });

    const slug = await uniqueSlug(slugify(input.workspaceName) || "equipo");

    // Quien crea el workspace es su primer admin.
    await db.workspace.create({
      data: {
        name: input.workspaceName,
        slug,
        members: { create: { userId: user.id, role: "admin" } },
      },
    });

    await createSession(user.id);
    redirect(`/w/${slug}`);
  });
}

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Escribí tu contraseña."),
});

export async function login(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<never>> {
  return run(async () => {
    const input = loginSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    const next = formData.get("next");

    const user = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true },
    });

    // Mismo mensaje para email inexistente y contraseña incorrecta.
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new Error("Email o contraseña incorrectos.");
    }

    await createSession(user.id);

    const membership = await db.membership.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: "asc" },
      select: { workspace: { select: { slug: true } } },
    });

    const target =
      typeof next === "string" && next.startsWith("/")
        ? next
        : membership
          ? `/w/${membership.workspace.slug}`
          : "/nuevo-equipo";

    redirect(target);
  });
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Escribí tu nombre."),
  avatarUrl: z.string().trim().optional(),
});

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    const user = await requireUser();
    const input = profileSchema.parse({
      name: formData.get("name"),
      avatarUrl: formData.get("avatarUrl") ?? undefined,
    });
    await db.user.update({
      where: { id: user.id },
      data: {
        name: input.name,
        avatarUrl: input.avatarUrl?.length ? input.avatarUrl : null,
      },
    });
  });
  return result.ok ? ok() : result;
}

const passwordSchema = z.object({
  current: z.string().min(1, "Escribí tu contraseña actual."),
  next: passwordField,
});

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    const session = await requireUser();
    const input = passwordSchema.parse({
      current: formData.get("current"),
      next: formData.get("next"),
    });

    const user = await db.user.findUniqueOrThrow({
      where: { id: session.id },
      select: { passwordHash: true },
    });

    if (!(await verifyPassword(input.current, user.passwordHash))) {
      throw new Error("La contraseña actual no coincide.");
    }

    await db.user.update({
      where: { id: session.id },
      data: { passwordHash: await hashPassword(input.next) },
    });
  });
  return result.ok ? ok() : result;
}

async function uniqueSlug(base: string) {
  let candidate = base;
  let suffix = 1;
  while (await db.workspace.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${++suffix}`;
  }
  return candidate;
}
