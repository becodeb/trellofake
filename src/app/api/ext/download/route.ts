import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { buildZip, type ZipEntry } from "@/server/ext/zip";

/**
 * Empaqueta `extension/` (raíz del repo) como un .zip armado al vuelo, para
 * el link de descarga de Ajustes. Sin caché en disco: la carpeta pesa unos
 * pocos KB y cambia poco, así que arrancar de cero en cada pedido es más
 * simple que invalidar un archivo generado.
 */
export const runtime = "nodejs";

const SOURCE_DIR = path.resolve(process.cwd(), "extension");
const ZIP_ROOT = "hilo-extension";

async function collectFiles(dir: string, base = ""): Promise<ZipEntry[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: ZipEntry[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const absolute = path.join(dir, entry.name);
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolute, relative)));
    } else if (entry.isFile()) {
      files.push({ path: `${ZIP_ROOT}/${relative}`, data: await readFile(absolute) });
    }
  }
  return files;
}

export async function GET(): Promise<Response> {
  let files: ZipEntry[];
  try {
    files = await collectFiles(SOURCE_DIR);
  } catch {
    return new Response("La carpeta de la extensión no está disponible en este servidor.", { status: 500 });
  }
  if (files.length === 0) {
    return new Response("La carpeta de la extensión no está disponible en este servidor.", { status: 500 });
  }

  const zip = buildZip(files);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="hilo-extension.zip"',
      "Content-Length": String(zip.length),
      "Cache-Control": "no-store",
    },
  });
}
