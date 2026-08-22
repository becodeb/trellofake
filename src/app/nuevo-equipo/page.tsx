import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/session";
import { defaultWorkspaceSlug } from "@/server/auth/context";
import { Wordmark } from "@/components/brand";
import { NewWorkspaceForm } from "./new-workspace-form";

export const metadata = { title: "Nuevo equipo" };

/**
 * Alta de workspace para alguien que ya tiene cuenta pero se quedó sin equipo
 * (por ejemplo, si lo sacaron del último al que pertenecía).
 */
export default async function NewWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const slug = await defaultWorkspaceSlug(user.id);
  if (slug) redirect(`/w/${slug}`);

  return (
    <div className="relative flex min-h-dvh flex-col bg-paper">
      <div
        className="pointer-events-none absolute inset-0 grid-paper opacity-45"
        style={{ maskImage: "radial-gradient(ellipse 70% 55% at 50% 40%, black, transparent)" }}
        aria-hidden
      />

      <header className="relative z-10 px-6 py-5">
        <Wordmark size="sm" />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[380px] animate-rise">
          <h1 className="font-display text-3xl leading-none text-ink">Creá tu equipo</h1>
          <p className="mt-2.5 text-sm text-ink-3">
            No pertenecés a ningún workspace todavía. Armá uno y empezá a cargar proyectos.
          </p>

          <div className="mt-7">
            <NewWorkspaceForm />
          </div>
        </div>
      </main>
    </div>
  );
}
