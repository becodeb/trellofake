import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { next } = await searchParams;

  return (
    <div className="animate-rise">
      <h1 className="font-display text-3xl leading-none text-ink">Retomá el hilo</h1>
      <p className="mt-2.5 text-sm text-ink-3">
        Entrá para ver qué pasó mientras no estabas.
      </p>

      <div className="mt-7">
        <LoginForm next={next} />
      </div>

      <p className="mt-6 text-xs text-ink-3">
        ¿Todavía no tenés cuenta?{" "}
        <Link
          href="/signup"
          className="font-medium text-accent-ink underline underline-offset-2 hover:text-accent"
        >
          Creá una
        </Link>
      </p>
    </div>
  );
}