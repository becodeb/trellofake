import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/session";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Crear cuenta" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="animate-rise">
      <h1 className="font-display text-3xl leading-none text-ink">Sumate al equipo</h1>
      <p className="mt-2.5 text-sm text-ink-3">
        Una cuenta para ver todo lo que se construye y participar: comentar, proponer y
        conversar.
      </p>

      <div className="mt-7">
        <SignupForm />
      </div>

      <p className="mt-6 text-xs text-ink-3">
        ¿Ya tenés cuenta?{" "}
        <Link
          href="/login"
          className="font-medium text-accent-ink underline underline-offset-2 hover:text-accent"
        >
          Entrá
        </Link>
      </p>
    </div>
  );
}