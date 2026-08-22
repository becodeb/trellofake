import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/session";
import { defaultWorkspaceSlug } from "@/server/auth/context";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Crear equipo" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) {
    const slug = await defaultWorkspaceSlug(user.id);
    redirect(slug ? `/w/${slug}` : "/");
  }

  return (
    <div className="animate-rise">
      <h1 className="font-display text-3xl leading-none text-ink">Empezá tu equipo</h1>
      <p className="mt-2.5 text-sm text-ink-3">
        Un workspace es el lugar donde vive todo lo que el equipo tiene entre manos.
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
