import { Download, Puzzle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Instalación de la extensión de navegador. Estático: no hay nada que
 * gestionar acá (el token se crea arriba, en "Acceso por API").
 */
export function ExtensionInstall() {
  return (
    <div className="space-y-3 rounded-[var(--r-lg)] border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[var(--r-md)] bg-surface-2 text-ink-3">
          <Puzzle className="size-4" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-2">
            Anotá tareas, ideas y capturas de cualquier sitio sin salir de la página, y guardá
            cualquier página como recurso para encontrarla después buscando en Hilo. Compatible
            con Chrome, Edge y Brave.
          </p>

          <ol className="mt-3 space-y-1.5 text-xs leading-relaxed text-ink-2">
            <li>1. Descargá el .zip y descomprimilo en cualquier carpeta.</li>
            <li>
              2. Abrí <code className="rounded bg-surface-2 px-1 py-0.5 font-mono">chrome://extensions</code>{" "}
              y activá "Modo de desarrollador" (arriba a la derecha).
            </li>
            <li>3. Tocá "Cargar descomprimida" y elegí la carpeta que descomprimiste.</li>
            <li>
              4. Abrí las opciones de la extensión y pegá la URL de Hilo y un token de API (el de
              arriba en esta misma página).
            </li>
          </ol>
        </div>
      </div>

      <div className="flex justify-end">
        <Button asChild variant="primary" size="sm">
          <a href="/api/ext/download" download="hilo-extension.zip">
            <Download className="size-3.5" strokeWidth={2.2} />
            Descargar extensión (.zip)
          </a>
        </Button>
      </div>
    </div>
  );
}
