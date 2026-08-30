import * as React from "react";
import { Lock } from "lucide-react";

import { cn } from "@/lib/cn";
import type { RenderedSegment } from "@/lib/doc";

/**
 * El documento del proyecto, ya renderizado.
 *
 * El HTML llega armado y sanitizado desde `src/server/domain/doc.ts`: acá sólo
 * se decide cómo se ve. Los tramos marcados como solo-equipo se dibujan dentro
 * de una caja con candado, para que quien escribe vea sin ambigüedad qué parte
 * del documento no es pública.
 *
 * Cuando el lector no es del equipo esos tramos no llegan hasta acá: se
 * recortaron en el servidor. Esta caja es una señal, no la protección.
 */
export function DocBody({
  segments,
  className,
}: {
  segments: RenderedSegment[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {segments.map((segment, index) =>
        segment.audience === "team" ? (
          <TeamOnlyBlock key={index} html={segment.html} />
        ) : (
          <DocHtml key={index} html={segment.html} />
        ),
      )}
    </div>
  );
}

/**
 * Un tramo público. El `overflow-x-auto` es para las tablas anchas: se
 * scrollean adentro de su caja en vez de estirar la página entera.
 */
function DocHtml({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn("prose-doc overflow-x-auto", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function TeamOnlyBlock({ html }: { html: string }) {
  return (
    <section className="rounded-[var(--r-lg)] border border-dashed border-accent-line bg-accent-wash/50 px-4 py-3">
      <p className="mb-2 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-accent-ink">
        <Lock className="size-3" strokeWidth={2.2} />
        Solo el equipo
      </p>
      <DocHtml html={html} />
    </section>
  );
}

/** Aviso para quien lee de afuera y el documento tiene partes reservadas. */
export function HiddenForYouNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-2xs text-ink-4",
        className,
      )}
    >
      <Lock className="size-3" strokeWidth={2} />
      Este documento tiene una parte reservada al equipo.
    </p>
  );
}
