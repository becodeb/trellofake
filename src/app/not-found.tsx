import Link from "next/link";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata = { title: "No encontrado" };

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-paper">
      <div
        className="pointer-events-none absolute inset-0 grid-paper opacity-40"
        style={{ maskImage: "radial-gradient(ellipse 60% 50% at 50% 45%, black, transparent)" }}
        aria-hidden
      />

      <header className="relative z-10 px-6 py-5">
        <Link href="/">
          <Wordmark size="sm" />
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-24 text-center">
        <div className="max-w-sm animate-rise">
          <h1 className="font-display text-3xl leading-none text-ink">Por acá no hay nada</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-3">
            La página no existe, o el proyecto que buscabas está en otro equipo del que no
            formás parte.
          </p>
          <Button variant="primary" size="lg" className="mt-6" asChild>
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
