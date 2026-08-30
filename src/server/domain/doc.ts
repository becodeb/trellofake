import "server-only";

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

import { db } from "@/server/db";
import { personSelect } from "@/server/domain/projects";
import {
  MAX_DOC_LENGTH,
  splitDocSegments,
  type RenderedSegment,
} from "@/lib/doc";

/**
 * El "leeme" de un proyecto: qué es, cómo se trabaja con él y los datos que
 * hacen falta para empezar. Es lo primero que se lee al entrar al proyecto.
 *
 * Dos reglas gobiernan este archivo:
 *
 * 1. **El HTML se arma acá, en el servidor.** El markdown crudo nunca viaja al
 *    navegador de quien sólo lee, así los bloques `:::equipo` no se pueden
 *    espiar en el HTML ni en el payload de React.
 * 2. **Se sanitiza siempre.** El markdown lo escribe gente del equipo, pero un
 *    documento importado de un `.md` cualquiera puede traer HTML embebido: la
 *    lista blanca de `rehype-sanitize` es la única frontera que lo detiene.
 */

/**
 * Lista blanca de sanitización. Parte de la de GitHub y suma lo justo:
 * `class` en los bloques de código (para el lenguaje), las casillas de las
 * listas de tareas de GFM (que ya vienen deshabilitadas), la alineación de las
 * columnas de una tabla, `<kbd>` para atajos de teclado y `<details>` para las
 * secciones que se pliegan: cosas que aparecen en cualquier README real.
 *
 * Todo lo demás se cae: `<script>`, los manejadores `on*` y los enlaces
 * `javascript:` no sobreviven a este paso.
 */
const schema: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "kbd", "details", "summary"],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-./]],
    input: [...(defaultSchema.attributes?.input ?? []), "type", "checked", "disabled"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
    details: [...(defaultSchema.attributes?.details ?? []), "open"],
  },
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // Un README real trae HTML suelto (`<details>`, `<br>`, `<img align>`).
  // `allowDangerousHtml` + `rehypeRaw` lo parsean en vez de tirarlo, y recién
  // después `rehypeSanitize` decide qué sobrevive. El orden importa: sanitizar
  // es siempre el último paso antes de convertir a texto.
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, schema)
  .use(rehypeStringify);

/** Markdown → HTML seguro. Es la única forma de renderizar un documento. */
export function renderMarkdown(markdown: string): string {
  return String(processor.processSync(markdown.slice(0, MAX_DOC_LENGTH)));
}

export type { RenderedSegment };

/**
 * Renderiza el documento recortando lo que no corresponda ver.
 *
 * `includeTeamOnly` viene del contexto de sesión del servidor, nunca de un
 * parámetro del cliente: quien no es del equipo recibe un array donde los
 * tramos privados directamente no existen.
 */
export function renderDoc(
  markdown: string,
  { includeTeamOnly }: { includeTeamOnly: boolean },
): RenderedSegment[] {
  return splitDocSegments(markdown)
    .filter((segment) => includeTeamOnly || segment.audience === "everyone")
    .map((segment) => ({ ...segment, html: renderMarkdown(segment.markdown) }));
}

export type ProjectDoc = {
  markdown: string;
  updatedAt: Date;
  updatedBy: { id: string; name: string; avatarUrl: string | null; accentColor: string };
};

/**
 * Documento crudo. Sólo para quien lo va a editar o para el recorte posterior:
 * cualquier vista de lectura tiene que pasar por `readProjectDoc`.
 */
export async function getProjectDoc(projectId: string): Promise<ProjectDoc | null> {
  const doc = await db.projectDoc.findUnique({
    where: { projectId },
    select: { markdown: true, updatedAt: true, updatedBy: { select: personSelect } },
  });
  if (!doc || !doc.markdown.trim()) return null;
  return doc;
}

/** ¿Hay documento? Para decidir si la pestaña se ofrece, sin traer el texto. */
export async function projectHasDoc(projectId: string): Promise<boolean> {
  const doc = await db.projectDoc.findUnique({
    where: { projectId },
    select: { projectId: true },
  });
  return Boolean(doc);
}

export type ReadableDoc = {
  segments: RenderedSegment[];
  updatedAt: Date;
  updatedBy: ProjectDoc["updatedBy"];
  /** Hay contenido reservado al equipo que este lector no está viendo. */
  hiddenForYou: boolean;
};

/** Documento listo para mostrar, ya recortado y convertido a HTML. */
export async function readProjectDoc(
  projectId: string,
  { includeTeamOnly }: { includeTeamOnly: boolean },
): Promise<ReadableDoc | null> {
  const doc = await getProjectDoc(projectId);
  if (!doc) return null;

  const all = splitDocSegments(doc.markdown);
  const segments = renderDoc(doc.markdown, { includeTeamOnly });
  if (segments.length === 0) return null;

  return {
    segments,
    updatedAt: doc.updatedAt,
    updatedBy: doc.updatedBy,
    hiddenForYou:
      !includeTeamOnly && all.some((segment) => segment.audience === "team"),
  };
}
