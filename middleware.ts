import { NextRequest, NextResponse } from "next/server";

/**
 * Redirección de las URLs históricas `/w/<slug>/...`.
 *
 * La app ya no tiene rutas bajo `/w/`: vive en la raíz. El slug del equipo
 * (env `TEAM_SLUG`, por defecto "hilo") recibe un 301 a la ruta limpia;
 * cualquier otro slug no existe y responde 404, para no renderizar contenido
 * bajo rutas fantasma.
 */
const TEAM_SLUG = process.env.TEAM_SLUG ?? "hilo";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean); // ["w", slug, ...rest]

  const slug = segments[1];
  if (slug !== TEAM_SLUG) {
    return new NextResponse(null, { status: 404 });
  }

  const rest = segments.slice(2);
  const target = rest.length > 0 ? `/${rest.join("/")}` : "/";

  const url = request.nextUrl.clone();
  url.pathname = target;
  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: ["/w/:slug", "/w/:slug/:path*"],
};