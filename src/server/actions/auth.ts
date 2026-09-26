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
import { profileSchema } from "@/server/actions/schemas";
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
});

/**
 * El alta redirige desde el servidor: quien firma entra directo a la raíz, que
 * ahora es la casa del equipo.
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

    // Auto-join: la primera persona de la instancia es admin (arranca el
    // equipo); el resto entra como comunidad y participa desde el día uno.
    const memberCount = await db.membership.count();
    await db.membership.create({
      data: {
        userId: user.id,
        role: memberCount === 0 ? "admin" : "community",
      },
    });

    await createSession(user.id);
    redirect("/");
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

    const target = typeof next === "string" && next.startsWith("/") ? next : "/";

    redirect(target);
  });
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

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
