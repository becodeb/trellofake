import Link from "next/link";

import { Wordmark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-paper">
      {/* Trama de puntos muy tenue: da textura sin decorar. */}
      <div
        className="pointer-events-none absolute inset-0 grid-paper opacity-45"
        style={{
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 40%, black, transparent)",
        }}
        aria-hidden
      />

      <header className="relative z-10 px-6 py-5">
        <Link href="/" className="inline-flex">
          <Wordmark size="sm" />
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>

      <footer className="relative z-10 px-6 py-5 text-2xs text-ink-4">
        Para que el equipo no pierda el hilo de lo que está haciendo.
      </footer>
    </div>
  );
}
