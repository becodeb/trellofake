/**
 * Vocabulario del "leeme" de un proyecto.
 *
 * Pura sintaxis: no toca la base ni el DOM, así que la puede importar tanto el
 * renderer del servidor como la barra de herramientas del editor (cliente).
 *
 * El documento es Markdown normal salvo por un agregado: un bloque marcado como
 * solo-equipo, con la misma forma que las "directivas" de Markdown.
 *
 *     :::equipo
 *     usuario: demo@typely.app / clave: 1234
 *     :::
 *
 * Ese bloque nunca sale del servidor cuando quien mira no es del equipo: no se
 * oculta con CSS ni se manda y se filtra en el cliente, se recorta antes de
 * convertirlo a HTML. Ver `src/server/domain/doc.ts`.
 */

export const TEAM_BLOCK_OPEN = ":::equipo";
export const TEAM_BLOCK_CLOSE = ":::";

/** Tope de tamaño del documento, alineado con el de las guías de recursos. */
export const MAX_DOC_LENGTH = 100_000;

export type DocSegment = {
  /** "team" = sólo lo ve quien tiene rol de equipo. */
  audience: "everyone" | "team";
  markdown: string;
};

/**
 * Tramo ya convertido a HTML por el servidor. Vive acá y no en
 * `src/server/domain/doc.ts` para que el editor —que es cliente— pueda tipar
 * la respuesta de la vista previa sin importar nada marcado `server-only`.
 */
export type RenderedSegment = DocSegment & { html: string };

/**
 * Parte el documento en tramos públicos y tramos de equipo.
 *
 * Un `:::equipo` sin cierre deja el resto del documento como privado a
 * propósito: si alguien se olvida de cerrarlo, el error tiene que fallar hacia
 * el lado de ocultar de más, nunca de mostrar de más.
 */
export function splitDocSegments(markdown: string): DocSegment[] {
  const segments: DocSegment[] = [];
  let buffer: string[] = [];
  let audience: DocSegment["audience"] = "everyone";
  let insideCodeFence = false;

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) segments.push({ audience, markdown: text });
    buffer = [];
  };

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();

    // Dentro de un bloque de código ``` la sintaxis del documento no aplica:
    // alguien puede estar documentando justamente cómo se escribe un :::equipo.
    if (/^(```|~~~)/.test(trimmed)) {
      insideCodeFence = !insideCodeFence;
      buffer.push(line);
      continue;
    }
    if (insideCodeFence) {
      buffer.push(line);
      continue;
    }

    if (audience === "everyone" && trimmed === TEAM_BLOCK_OPEN) {
      flush();
      audience = "team";
      continue;
    }
    if (audience === "team" && trimmed === TEAM_BLOCK_CLOSE) {
      flush();
      audience = "everyone";
      continue;
    }
    buffer.push(line);
  }

  flush();
  return segments;
}

/** ¿El documento esconde algo? Sirve para avisarle a quien lo está leyendo. */
export function hasTeamOnlyContent(markdown: string): boolean {
  return splitDocSegments(markdown).some((segment) => segment.audience === "team");
}

/**
 * Primera línea útil del documento, para mostrarlo plegado o en un listado.
 * Se saltea títulos, imágenes y bloques privados.
 */
export function docSummary(markdown: string, limit = 160): string {
  for (const segment of splitDocSegments(markdown)) {
    if (segment.audience !== "everyone") continue;
    for (const line of segment.markdown.split("\n")) {
      const text = line.trim();
      if (!text || text.startsWith("#") || text.startsWith("!") || text.startsWith("|")) {
        continue;
      }
      const clean = text
        .replace(/^[-*+]\s+/, "")
        .replace(/\*\*|__|[*_`>]/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .trim();
      if (clean) return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
    }
  }
  return "";
}
