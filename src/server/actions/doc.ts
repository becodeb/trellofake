"use server";

import { db } from "@/server/db";
import { requireTeamAction } from "@/server/auth/context";
import { recordActivity } from "@/server/domain/activity";
import { renderDoc, type RenderedSegment } from "@/server/domain/doc";
import { run, revalidateTeam, type ActionResult } from "@/server/actions/shared";
import { docSchema } from "@/server/actions/schemas";
import { ACTIVITY } from "@/lib/domain";
import { hasTeamOnlyContent } from "@/lib/doc";

/**
 * Edición del "leeme" de un proyecto.
 *
 * Guardar es un upsert: el documento no se crea al crear el proyecto, aparece
 * la primera vez que alguien escribe algo. Vaciarlo lo borra, así un proyecto
 * sin contexto no arrastra una fila fantasma ni un encabezado vacío.
 */

export async function saveProjectDoc(
  projectId: string,
  markdown: string,
): Promise<ActionResult<{ empty: boolean }>> {
  return run(async () => {
    const ctx = await requireTeamAction("content.write");
    const input = docSchema.parse({ markdown });
    const text = input.markdown.trim();

    const project = await db.project.findFirstOrThrow({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    const previous = await db.projectDoc.findUnique({
      where: { projectId: project.id },
      select: { markdown: true },
    });

    if (!text) {
      if (previous) await db.projectDoc.delete({ where: { projectId: project.id } });
      revalidateTeam();
      return { empty: true };
    }

    // Guardar sin cambios no ensucia el historial ni el feed de nadie.
    if (previous?.markdown === text) return { empty: false };

    await db.projectDoc.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, markdown: text, updatedById: ctx.user.id },
      update: { markdown: text, updatedById: ctx.user.id },
    });

    await recordActivity({
      actorId: ctx.user.id,
      verb: ACTIVITY.docUpdated,
      targetType: "doc",
      targetId: project.id,
      targetLabel: project.name,
      projectId: project.id,
      meta: { created: !previous },
    });

    revalidateTeam();
    return { empty: false };
  });
}

/**
 * Vista previa del editor.
 *
 * Se renderiza en el servidor con el mismo pipeline que la página publicada:
 * lo que se ve mientras se escribe es exactamente lo que van a leer los demás,
 * y no hay un segundo renderer de markdown que mantener sincronizado.
 */
export async function previewProjectDoc(
  markdown: string,
): Promise<ActionResult<{ segments: RenderedSegment[]; hasTeamOnly: boolean }>> {
  return run(async () => {
    await requireTeamAction("content.write");
    const input = docSchema.parse({ markdown });
    return {
      segments: renderDoc(input.markdown, { includeTeamOnly: true }),
      hasTeamOnly: hasTeamOnlyContent(input.markdown),
    };
  });
}
