import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { get } from "@/server/storage";

/**
 * Sirve los archivos subidos.
 *
 * No alcanza con adivinar la ruta: se verifica que quien pide el archivo sea
 * miembro del workspace dueño. Un adjunto de un equipo no se filtra por tener
 * la URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const key = path.join("/");

  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });

  const attachment = await db.attachment.findFirst({
    where: {
      storageKey: key,
      workspace: { members: { some: { userId: user.id } } },
    },
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
        "Cache-Control": "private, max-age=31536000, immutable",
        // Aunque el archivo llegue a ejecutarse, no puede pedir nada ni salir.
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}
