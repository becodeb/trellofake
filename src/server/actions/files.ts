"use server";
import { db } from "@/server/db";
import { requireTeamAction } from "@/server/auth/context";
import { recordActivity } from "@/server/domain/activity";
import { put, urlFor } from "@/server/storage";
import { ok, run, revalidateTeam, type ActionResult } from "@/server/actions/shared";
import { ACTIVITY } from "@/lib/domain";
export type UploadedFile = {
  id: string;
  filename: string;
  url: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Sube archivos y los asocia a un proyecto, a un elemento o a nada todavía
 * (el caso del comentario que aún no existe: se adjuntan al publicarlo).
 */

export async function uploadFiles(
  formData: FormData,
): Promise<ActionResult<UploadedFile[]>> {
  return run(async () => {
    const ctx = await requireTeamAction("content.write");
    const projectId = (formData.get("projectId") as string | null) || null;
    const itemId = (formData.get("itemId") as string | null) || null;
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new Error("No llegó ningún archivo.");
    if (files.length > 10) throw new Error("Máximo 10 archivos por vez.");
    // Nunca confiar en los ids del cliente: se validan contra la base.
    const project = projectId
      ? await db.project.findFirst({
          where: { id: projectId },
          select: { id: true, name: true },
        })
      : null;
    const item = itemId
      ? await db.item.findFirst({
          where: { id: itemId },
          select: { id: true, title: true, projectId: true },
        })
      : null;
    const saved: UploadedFile[] = [];
    for (const file of files) {
      const stored = await put(file, ctx.team.id);
      const attachment = await db.attachment.create({
        data: {
          uploaderId: ctx.user.id,
          filename: stored.filename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          storageKey: stored.key,
          kind: stored.kind,
          projectId: item?.projectId ?? project?.id ?? null,
          itemId: item?.id ?? null,
        },
        select: { id: true },
      });
      saved.push({
        id: attachment.id,
        filename: stored.filename,
        url: stored.url,
        kind: stored.kind,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      });
    }
    const targetProjectId = item?.projectId ?? project?.id ?? null;
    if (targetProjectId) {
      await recordActivity({
        actorId: ctx.user.id,
        verb: ACTIVITY.fileUploaded,
        targetType: "file",
        targetId: saved[0].id,
        targetLabel: item?.title ?? saved[0].filename,
        projectId: targetProjectId,
        itemId: item?.id ?? null,
        meta: {
          count: saved.length,
          filenames: saved.map((f) => f.filename).slice(0, 3),
        },
      });
    }
    revalidateTeam();
    return saved;
  });
}

/** Sube una imagen y la deja como portada del proyecto. */

export async function uploadCover(
  projectId: string,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  return run(async () => {
    const ctx = await requireTeamAction("content.write");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Elegí una imagen.");
    if (!file.type.startsWith("image/")) throw new Error("La portada tiene que ser una imagen.");
    const project = await db.project.findFirstOrThrow({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    const stored = await put(file, ctx.team.id);
    await db.attachment.create({
      data: {
        uploaderId: ctx.user.id,
        filename: stored.filename,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.key,
        kind: "image",
        projectId: project.id,
      },
    });
    await db.project.update({
      where: { id: project.id },
      data: { coverUrl: urlFor(stored.key) },
    });
    await recordActivity({
      actorId: ctx.user.id,
      verb: ACTIVITY.projectUpdated,
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
      projectId: project.id,
      meta: { fields: ["portada"] },
    });
    revalidateTeam();
    return { url: urlFor(stored.key) };
  });
}

export async function deleteAttachment(
  attachmentId: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    const ctx = await requireTeamAction("content.write");
    const attachment = await db.attachment.findFirstOrThrow({
      where: { id: attachmentId },
      select: { uploaderId: true },
    });
    if (attachment.uploaderId !== ctx.user.id && !ctx.can("workspace.manage")) {
      throw new Error("Solo podés borrar archivos que subiste vos.");
    }
    await db.attachment.delete({ where: { id: attachmentId } });
    revalidateTeam();
  });
  return result.ok ? ok() : result;
}
