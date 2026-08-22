import { cn } from "@/lib/cn";

/**
 * La marca: un hilo continuo que pasa por tres puntos.
 *
 * Es la forma del producto dibujada. Los puntos son las cosas que pasaron y el
 * trazo es lo que las une; el tramo más reciente va en el acento y el pasado se
 * apaga hacia atrás, que es exactamente cómo se lee la actividad de un equipo.
 * Es todo el ornamento que se permite la app.
 */
export function HiloMark({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {/* Tramo pasado: mismo hilo, más apagado. */}
      <path
        d="M4 18.5C7.6 18.5 8.4 12 12 12"
        stroke="currentColor"
        strokeWidth="1.75"
        opacity="0.32"
      />
      {/* Tramo reciente. */}
      <path d="M12 12C15.6 12 16.4 5.5 20 5.5" stroke="var(--accent)" strokeWidth="1.75" />

      <circle cx="4" cy="18.5" r="1.7" fill="currentColor" opacity="0.32" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" opacity="0.55" />
      <circle cx="20" cy="5.5" r="2.1" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const scale = { sm: 18, md: 22, lg: 30 }[size];
  const text = { sm: "text-lg", md: "text-xl", lg: "text-3xl" }[size];

  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <HiloMark size={scale} />
      <span
        className={cn("font-display leading-none tracking-tight", text)}
        style={{ letterSpacing: "-0.01em" }}
      >
        Hilo
      </span>
    </span>
  );
}
