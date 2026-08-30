import Link from "next/link";
import { BookOpen, Pencil } from "lucide-react";

import { readProjectDoc } from "@/server/domain/doc";
import { relativeTime } from "@/lib/format";
import { SectionHeader } from "@/components/ui/layout";
import { DocBody, HiddenForYouNote } from "@/components/app/project-doc";
import { DocFold } from "@/components/app/project-doc-fold";

/**
 * El léeme dentro del resumen del proyecto.
 *
 * Va primero, antes del trabajo del día: la pregunta "qué es esto y qué
 * necesito para tocarlo" es anterior a "qué está pasando". Se pliega para no
 * empujar el estado del proyecto fuera de la pantalla; el documento completo
 * vive en su propia pestaña.
 *
 * Es un componente de servidor: el markdown se recorta y se convierte a HTML
 * acá adentro y sólo baja al navegador lo que corresponde ver.
 */
export async function ProjectDocSection({
  projectId,
  canWrite,
}: {
  projectId: string;
  canWrite: boolean;
}) {
  const doc = await readProjectDoc(projectId, { includeTeamOnly: canWrite });

  if (!doc) {
    if (!canWrite) return null;
    return (
      <section>
        <Link
          href={`/p/${projectId}/leeme`}
          className="flex items-center gap-2.5 rounded-[var(--r-lg)] border border-dashed border-line px-3.5 py-3 text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
        >
          <BookOpen className="size-4 shrink-0" strokeWidth={1.8} />
          <span className="min-w-0 flex-1 text-xs leading-relaxed">
            <span className="font-medium text-ink">Escribí el léeme del proyecto.</span> De
            qué se trata, cómo se trabaja con él y los datos que hacen falta para empezar.
          </span>
          <Pencil className="size-3.5 shrink-0" strokeWidth={1.9} />
        </Link>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        title="Léeme"
        action={
          <Link
            href={`/p/${projectId}/leeme`}
            className="text-xs text-ink-3 transition-colors hover:text-ink"
          >
            {canWrite ? "Ver completo y editar" : "Ver completo"}
          </Link>
        }
      />

      <div className="rounded-[var(--r-lg)] border border-line bg-surface px-4 py-3.5">
        <DocFold fadeClassName="to-surface">
          <DocBody segments={doc.segments} />
        </DocFold>

        <p className="mt-3 border-t border-line-soft pt-2 text-2xs text-ink-4">
          Actualizado {relativeTime(doc.updatedAt)} por {doc.updatedBy.name.split(" ")[0]}
        </p>
        {doc.hiddenForYou && <HiddenForYouNote className="mt-1" />}
      </div>
    </section>
  );
}
