import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { get } from "@/server/storage";

/**
 * Sirve los archivos subidos.
 *
 * El contenido es público: no se pide sesión ni membresía. Solo se resuelve la
 * clave contra la tabla de adjuntos para conocer nombre y tipo — si la clave
 * no corresponde a un adjunto, 404. Se sirve con `Cache-Control: public`
 * porque la URL es inmutable (`<teamId>/<hash>`).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const key = path.join("/");

  const attachment = await db.attachment.findFirst({
    where: { storageKey: key },
    select: { filename: true, mimeType: true },
  });

  if (!attachment) return new NextResponse("No encontrado", { status: 404 });

  try {
    const file = await get(key);

    // Un SVG es un documento, no solo una imagen: puede traer scripts. Se
    // fuerza la descarga en vez de renderizarlo en el origen de la app.
    const inlineSafe = attachment.mimeType !== "image/svg+xml";

    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(file.size),
        "Content-Disposition": `${inlineSafe ? "inline" : "attachment"}; filename="${encodeURIComponent(attachment.filename)}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        // Aunque el archivo llegue a ejecutarse, no puede pedir nada ni salir.
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}