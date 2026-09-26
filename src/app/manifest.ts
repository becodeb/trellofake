import type { MetadataRoute } from "next";

/**
 * Manifiesto de app instalable.
 *
 * Los colores son los mismos tokens del papel y el acento que usa el resto de
 * la interfaz (ver `globals.css`), para que la pantalla de carga al abrir la
 * app instalada no desentone con la app en sí.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hilo",
    short_name: "Hilo",
    description: "Tareas, ideas y decisiones del equipo, todo en un solo hilo.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#b4643f",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
