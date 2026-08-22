"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileText, ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";

import { cn } from "@/lib/cn";
import { fileSize, relativeTime } from "@/lib/format";
import { deleteAttachment, uploadFiles } from "@/server/actions/files";
import type { PersonLike } from "@/components/ui/avatar";
import { Avatar } from "@/components/ui/avatar";
import { RowAction } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/overlays";

export type AttachmentData = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  kind: string;
  createdAt?: Date;
  uploader?: PersonLike;
};

export function fileUrl(storageKey: string) {
  return `/api/files/${storageKey}`;
}

/**
 * Zona de subida.
 *
 * Arrastrar y soltar es el gesto natural para un archivo, así que el área
 * entera lo acepta; el botón está para quien prefiere el diálogo del sistema.
 */
export function FileDrop({
  slug,
  projectId,
  itemId,
  label = "Arrastrá archivos o hacé click",
  compact = false,
  className,
}: {
  slug: string;
  projectId?: string;
  itemId?: string;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [over, setOver] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0 || pending) return;

    const data = new FormData();
    if (projectId) data.set("projectId", projectId);
    if (itemId) data.set("itemId", itemId);
    for (const file of Array.from(files)) data.append("files", file);

    setPending(true);
    const result = await uploadFiles(slug, data);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.data.length === 1 ? "Archivo subido" : `${result.data.length} archivos subidos`,
    );
    router.refresh();
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        void upload(event.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed text-xs transition-colors",
        compact ? "px-3 py-2" : "px-4 py-6",
        over
          ? "border-accent bg-accent-wash text-accent-ink"
          : "border-line text-ink-4 hover:border-line-strong hover:text-ink-3",
        pending && "pointer-events-none opacity-60",
        className,
      )}
    >
      {pending ? (
        <>
          <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
          Subiendo…
        </>
      ) : (
        <>
          <Upload className="size-3.5" strokeWidth={1.9} />
          {label}
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          void upload(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

/** Imágenes como miniaturas, el resto como filas. */
export function AttachmentGrid({
  slug,
  attachments,
  viewerId,
  className,
}: {
  slug: string;
  attachments: AttachmentData[];
  viewerId?: string;
  className?: string;
}) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind !== "image");

  return (
    <div className={cn("space-y-2.5", className)}>
      {images.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
          {images.map((image) => (
            <figure key={image.id} className="group relative">
              <a
                href={fileUrl(image.storageKey)}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-[var(--r-md)] border border-line bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(image.storageKey)}
                  alt={image.filename}
                  className="aspect-4/3 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </a>
              <figcaption className="mt-1 truncate text-2xs text-ink-4">
                {image.filename}
              </figcaption>
              {viewerId && image.uploader?.id === viewerId && (
                <DeleteButton
                  slug={slug}
                  id={image.id}
                  className="absolute right-1 top-1 bg-surface/90 backdrop-blur-sm"
                />
              )}
            </figure>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className="overflow-hidden rounded-[var(--r-md)] border border-line">
          {files.map((file) => (
            <li key={file.id} className="row hairline group flex items-center gap-2.5 px-3 py-2">
              <FileText className="size-4 shrink-0 text-ink-4" strokeWidth={1.8} />
              <a
                href={fileUrl(file.storageKey)}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1"
              >
                <span className="block truncate text-sm text-ink">{file.filename}</span>
                <span className="text-2xs text-ink-4">
                  {fileSize(file.sizeBytes)}
                  {file.uploader && ` · ${file.uploader.name.split(" ")[0]}`}
                  {file.createdAt && ` · ${relativeTime(file.createdAt)}`}
                </span>
              </a>

              <a
                href={fileUrl(file.storageKey)}
                download={file.filename}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Descargar ${file.filename}`}
              >
                <Download className="size-3.5 text-ink-3" strokeWidth={1.9} />
              </a>

              {viewerId && file.uploader?.id === viewerId && (
                <DeleteButton slug={slug} id={file.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeleteButton({
  slug,
  id,
  className,
}: {
  slug: string;
  id: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Tooltip content="Borrar">
      <RowAction
        className={className}
        loading={pending}
        aria-label="Borrar archivo"
        onClick={() =>
          startTransition(async () => {
            const result = await deleteAttachment(slug, id);
            if (!result.ok) toast.error(result.error);
            else router.refresh();
          })
        }
      >
        <Trash2 className="size-3.5" strokeWidth={1.9} />
      </RowAction>
    </Tooltip>
  );
}

export { ImageIcon, Paperclip };
