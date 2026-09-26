"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileText, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { uploadFiles, type UploadedFile } from "@/server/actions/files";
import type { ActionResult } from "@/server/actions/shared";

/**
 * Pegar (Ctrl/Cmd+V), arrastrar o adjuntar imágenes es la misma necesidad en
 * tres lugares (creación rápida, panel de elemento, comentarios), así que la
 * lógica de captura, validación y previsualización vive acá una sola vez.
 */

// Mismos límites que `MAX_UPLOAD_BYTES` en `server/storage.ts` y el tope de
// `uploadFiles` en `server/actions/files.ts`: se repiten acá para avisar del
// lado del cliente antes de gastar una subida.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 10;

export type PendingAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
};

function makeId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Filtra por tamaño y cantidad, devolviendo un mensaje amigable si descartó algo. */
export function filterUploadableFiles(
  files: File[],
  currentCount = 0,
): { accepted: File[]; rejectedMessage: string | null } {
  const usable = files.filter((file) => file.size > 0);
  const room = Math.max(0, MAX_ATTACHMENT_COUNT - currentCount);
  const overflow = Math.max(0, usable.length - room);
  const candidates = usable.slice(0, room);

  const accepted: File[] = [];
  let tooBig = 0;
  for (const file of candidates) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      tooBig += 1;
      continue;
    }
    accepted.push(file);
  }

  const messages: string[] = [];
  if (room <= 0 && usable.length > 0) {
    messages.push(`Ya tenés el máximo de ${MAX_ATTACHMENT_COUNT} archivos.`);
  } else if (overflow > 0) {
    messages.push(
      `Máximo ${MAX_ATTACHMENT_COUNT} archivos por vez: se dejaron ${overflow} afuera.`,
    );
  }
  if (tooBig > 0) {
    messages.push(
      tooBig === 1
        ? "Un archivo supera los 10 MB y no se agregó."
        : `${tooBig} archivos superan los 10 MB y no se agregaron.`,
    );
  }

  return { accepted, rejectedMessage: messages.length > 0 ? messages.join(" ") : null };
}

/**
 * Cola de archivos elegidos antes de que exista lo que los va a recibir
 * (crear un elemento, publicar un comentario): se validan y muestran como
 * miniatura, y recién se suben cuando ese "algo" ya existe.
 */
export function usePendingAttachments() {
  const [items, setItems] = React.useState<PendingAttachment[]>([]);
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  // Los object URL de las miniaturas no se liberan solos.
  React.useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const addFiles = React.useCallback((incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    if (files.length === 0) return;

    setItems((current) => {
      const { accepted, rejectedMessage } = filterUploadableFiles(files, current.length);
      if (rejectedMessage) toast.error(rejectedMessage);
      if (accepted.length === 0) return current;
      const next: PendingAttachment[] = accepted.map((file) => ({
        id: makeId(file),
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      }));
      return [...current, ...next];
    });
  }, []);

  const removeFile = React.useCallback((id: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const clear = React.useCallback(() => {
    setItems((current) => {
      for (const item of current) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return [];
    });
  }, []);

  return { items, addFiles, removeFile, clear };
}

/**
 * Handler de `onPaste` que solo actúa cuando el portapapeles trae archivos
 * (una captura, una imagen copiada): el pegado de texto normal —en el mismo
 * input o en cualquier otro— sigue de largo, intacto.
 */
export function usePasteFiles(onFiles: (files: File[]) => void) {
  const onFilesRef = React.useRef(onFiles);
  onFilesRef.current = onFiles;

  return React.useCallback((event: React.ClipboardEvent) => {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    onFilesRef.current(files);
  }, []);
}

/** Arma el `FormData` y sube contra la acción existente (sin tocarla). */
export async function uploadPendingFiles(
  files: File[],
  target: { projectId?: string | null; itemId?: string | null },
): Promise<ActionResult<UploadedFile[]>> {
  const data = new FormData();
  if (target.projectId) data.set("projectId", target.projectId);
  if (target.itemId) data.set("itemId", target.itemId);
  for (const file of files) data.append("files", file);
  return uploadFiles(data);
}

/** Miniaturas de lo que se eligió, con una cruz para sacar algo antes de subirlo. */
export function PendingAttachmentsTray({
  items,
  onRemove,
  className,
}: {
  items: PendingAttachment[];
  onRemove: (id: string) => void;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative size-14 shrink-0 overflow-hidden rounded-[var(--r-md)] border border-line bg-surface-2"
        >
          {item.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.previewUrl}
              alt={item.file.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-0.5 px-1 text-center">
              <FileText className="size-4 text-ink-4" strokeWidth={1.8} />
              <span className="w-full truncate text-[9px] text-ink-4">{item.file.name}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Quitar ${item.file.name}`}
            className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-surface/90 text-ink-3 opacity-0 backdrop-blur-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X className="size-2.5" strokeWidth={2.2} />
          </button>
        </div>
      ))}
    </div>
  );
}
