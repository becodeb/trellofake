"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Pliegue del documento en el resumen del proyecto.
 *
 * Arriba del resumen el léeme compite con el trabajo del día, así que se
 * muestra hasta donde entra sin empujar todo hacia abajo y ofrece seguir
 * leyendo. Sólo aparece el botón si realmente hay algo cortado: medimos el
 * alto real en vez de adivinarlo por la cantidad de caracteres, porque una
 * tabla o una imagen ocupan mucho más que su texto.
 *
 * Sin JavaScript el documento se ve completo, que es el peor caso correcto.
 */
export function DocFold({
  children,
  maxHeight = 360,
  fadeClassName = "to-paper",
}: {
  children: React.ReactNode;
  maxHeight?: number;
  /** Color hacia el que se desvanece el corte: el fondo real que hay detrás. */
  fadeClassName?: string;
}) {
  const content = React.useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const node = content.current;
    if (!node) return;

    const measure = () => setOverflows(node.scrollHeight > maxHeight + 24);
    measure();

    // Las imágenes cambian el alto después del primer render.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [maxHeight]);

  const clamped = overflows && !open;

  return (
    <div>
      <div
        className={cn("relative", clamped && "overflow-hidden")}
        style={clamped ? { maxHeight } : undefined}
      >
        <div ref={content}>{children}</div>

        {clamped && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent",
              fadeClassName,
            )}
            aria-hidden
          />
        )}
      </div>

      {overflows && (
        <button
          onClick={() => setOpen((value) => !value)}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-ink-3 transition-colors hover:text-ink"
        >
          {open ? "Mostrar menos" : "Seguir leyendo"}
          <ChevronDown
            className={cn("size-3 transition-transform", open && "rotate-180")}
            strokeWidth={2.2}
          />
        </button>
      )}
    </div>
  );
}
