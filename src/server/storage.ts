import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Adaptador de almacenamiento. Hoy escribe en disco local; la interfaz
 * (`put` / `get` / `urlFor`) es la misma que expondría S3 o R2, así que mover
 * los archivos a un bucket es cambiar este archivo y nada más.
 */

const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function isImage(mimeType: string) {
  return IMAGE_TYPES.has(mimeType);
}

function safeExtension(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

export type StoredFile = {
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: "image" | "file";
  url: string;
};

export async function put(
  file: File,
  teamId: string,
): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("El archivo supera los 10 MB.");
  }

  const id = randomBytes(12).toString("hex");
  const key = `${teamId}/${id}${safeExtension(file.name)}`;
  const target = path.join(ROOT, key);

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));

  const mimeType = file.type || "application/octet-stream";
  return {
    key,
    filename: file.name,
    mimeType,
    sizeBytes: file.size,
    kind: isImage(mimeType) ? "image" : "file",
    url: urlFor(key),
  };
}

export function urlFor(key: string) {
  return `/api/files/${key}`;
}

/** Lee un archivo garantizando que la clave no escape del directorio raíz. */
export async function get(key: string) {
  const target = path.resolve(ROOT, key);
  if (!target.startsWith(ROOT + path.sep)) throw new Error("Ruta inválida");
  const info = await stat(target);
  if (!info.isFile()) throw new Error("No es un archivo");
  return { body: await readFile(target), size: info.size };
}
