import Link from "next/link";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sin conexión" };

/**
 * Página de reserva del service worker.
 *
 * Se sirve cuando una navegación falla por falta de red (ver `public/sw.js`)
 * y no hay nada cacheado que mostrar en su lugar. No depende de la base ni de
 * sesión: tiene que poder salir andando aunque no haya llegado ni un byte más
 * que ella misma.
 */
export default function OfflinePage() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-paper">
      <div
        className="pointer-events-none absolute inset-0 grid-paper opacity-40"
        style={{ maskImage: "radial-gradient(ellipse 60% 50% at 50% 45%, black, transparent)" }}
        aria-hidden
      />

      <header className="relative z-10 px-6 py-5">
        <Wordmark size="sm" />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-24 text-center">
        <div className="max-w-sm animate-rise">
          <h1 className="font-display text-3xl leading-none text-ink">Sin conexión</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-3">
            No se pudo llegar a Hilo. Revisá la conexión e intentá de nuevo.
          </p>
          <Button variant="primary" size="lg" className="mt-6" asChild>
            <Link href="/">Reintentar</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
