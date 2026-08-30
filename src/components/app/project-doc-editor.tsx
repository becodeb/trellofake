"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bold,
  Code2,
  Copy,
  Download,
  Eye,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Lock,
  Minus,
  Pencil,
  Quote,
  Table,
  Upload,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { MAX_DOC_LENGTH, TEAM_BLOCK_CLOSE, TEAM_BLOCK_OPEN, type RenderedSegment } from "@/lib/doc";
import { previewProjectDoc, saveProjectDoc } from "@/server/actions/doc";
import { uploadFiles } from "@/server/actions/files";
import { Button, Spinner } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/overlays";
import { DocBody } from "@/components/app/project-doc";

/**
 * Editor del léeme.
 *
 * Se escribe Markdown, no un documento propietario: la barra de herramientas
 * inserta la marca por vos, pero lo que queda guardado es texto plano. Eso es
 * lo que hace que subir un `.md` sea exacto, que bajarlo devuelva lo mismo y
 * que el documento se pueda copiar a otro lado (o dárselo a una IA) sin
 * traducción de por medio.
 *
 * La vista previa la arma el servidor con el mismo renderer que la página
 * publicada. Es un viaje de ida y vuelta más, y a cambio no existe un segundo
 * intérprete de Markdown que se pueda desincronizar del primero.
 */
export function ProjectDocEditor({
  projectId,
  initialMarkdown,
  onClose,
}: {
  projectId: string;
  initialMarkdown: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const area = React.useRef<HTMLTextAreaElement>(null);
  const mdInput = React.useRef<HTMLInputElement>(null);
  const imageInput = React.useRef<HTMLInputElement>(null);

  const [value, setValue] = React.useState(initialMarkdown);
  const [mode, setMode] = React.useState<"write" | "preview">("write");
  const [preview, setPreview] = React.useState<RenderedSegment[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const dirty = value.trim() !== initialMarkdown.trim();

  // ------------------------------------------------------------ manipulación

  /**
   * Selección a restaurar después de que React repinte el textarea.
   *
   * Hay que esperar al repintado: al apretar un botón de la barra el foco se
   * va al botón y React reemplaza el contenido, así que reposicionar el cursor
   * antes de eso no sobrevive. Con esto, escribir con la barra se siente como
   * escribir a mano: el cursor queda donde uno lo dejó.
   */
  const pendingSelection = React.useRef<[number, number] | null>(null);

  React.useEffect(() => {
    const selection = pendingSelection.current;
    if (!selection) return;
    pendingSelection.current = null;
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(selection[0], selection[1]);
  }, [value]);

  /** Aplica una transformación al texto respetando (y devolviendo) la selección. */
  const edit = (
    transform: (state: { text: string; start: number; end: number }) => {
      text: string;
      start: number;
      end: number;
    },
  ) => {
    const el = area.current;
    if (!el) return;
    const next = transform({
      text: value,
      start: el.selectionStart,
      end: el.selectionEnd,
    });
    pendingSelection.current = [next.start, next.end];
    setValue(next.text);
  };

  /** Envuelve la selección (o un texto de ejemplo si no hay nada elegido). */
  const wrap = (before: string, after: string, placeholder: string) =>
    edit(({ text, start, end }) => {
      const selected = text.slice(start, end) || placeholder;
      return {
        text: text.slice(0, start) + before + selected + after + text.slice(end),
        start: start + before.length,
        end: start + before.length + selected.length,
      };
    });

  /** Prefija cada línea tocada por la selección: títulos, listas, citas. */
  const prefixLines = (prefix: string | ((index: number) => string)) =>
    edit(({ text, start, end }) => {
      const from = text.lastIndexOf("\n", start - 1) + 1;
      const rawEnd = text.indexOf("\n", end);
      const to = rawEnd === -1 ? text.length : rawEnd;
      const lines = text.slice(from, to).split("\n");
      const marked = lines
        .map((line, index) => {
          const mark = typeof prefix === "function" ? prefix(index) : prefix;
          return line.startsWith(mark) ? line : mark + line;
        })
        .join("\n");
      return {
        text: text.slice(0, from) + marked + text.slice(to),
        start: from,
        end: from + marked.length,
      };
    });

  /** Inserta un bloque suelto, separado por líneas en blanco. */
  const insertBlock = (block: string, cursorOffset = block.length) =>
    edit(({ text, start, end }) => {
      const head = text.slice(0, start).replace(/\n*$/, "");
      const tail = text.slice(end).replace(/^\n*/, "");
      const prefix = head ? `${head}\n\n` : "";
      return {
        text: prefix + block + (tail ? `\n\n${tail}` : "\n"),
        start: prefix.length + cursorOffset,
        end: prefix.length + cursorOffset,
      };
    });

  // ------------------------------------------------------------- archivos

  const importMarkdown = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error("El archivo supera 1 MB.");
      return;
    }
    const text = await file.text();
    if (value.trim() && !confirm("Esto reemplaza todo el documento actual. ¿Seguimos?")) {
      return;
    }
    setValue(text.slice(0, MAX_DOC_LENGTH));
    setMode("write");
    toast.success(`${file.name} cargado`, {
      description: "Revisá cómo quedó y guardá para publicarlo.",
    });
  };

  const insertImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const data = new FormData();
    data.set("projectId", projectId);
    data.append("files", file);
    const result = await uploadFiles(data);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const uploaded = result.data[0];
    insertBlock(`![${uploaded.filename}](${uploaded.url})`);
  };

  const download = () => {
    const blob = new Blob([value], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "leeme.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------- guardar

  const save = async () => {
    setSaving(true);
    const result = await saveProjectDoc(projectId, value);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.data.empty ? "Documento vacío: se borró" : "Léeme guardado");
    router.refresh();
    onClose?.();
  };

  const showPreview = async () => {
    setMode("preview");
    setPreview(null);
    const result = await previewProjectDoc(value);
    if (!result.ok) {
      toast.error(result.error);
      setMode("write");
      return;
    }
    setPreview(result.data.segments);
  };

  return (
    <div className="rounded-[var(--r-lg)] border border-line bg-surface">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5">
        <Group>
          <Tool label="Título" onClick={() => prefixLines("## ")}>
            <Heading2 className="size-3.5" strokeWidth={1.9} />
          </Tool>
          <Tool label="Negrita" onClick={() => wrap("**", "**", "texto")}>
            <Bold className="size-3.5" strokeWidth={2.2} />
          </Tool>
          <Tool label="Itálica" onClick={() => wrap("_", "_", "texto")}>
            <Italic className="size-3.5" strokeWidth={2} />
          </Tool>
        </Group>

        <Separator />

        <Group>
          <Tool label="Lista" onClick={() => prefixLines("- ")}>
            <List className="size-3.5" strokeWidth={1.9} />
          </Tool>
          <Tool label="Lista numerada" onClick={() => prefixLines((i) => `${i + 1}. `)}>
            <ListOrdered className="size-3.5" strokeWidth={1.9} />
          </Tool>
          <Tool label="Lista de tareas" onClick={() => prefixLines("- [ ] ")}>
            <ListChecks className="size-3.5" strokeWidth={1.9} />
          </Tool>
          <Tool label="Cita" onClick={() => prefixLines("> ")}>
            <Quote className="size-3.5" strokeWidth={1.9} />
          </Tool>
        </Group>

        <Separator />

        <Group>
          <Tool label="Enlace" onClick={() => wrap("[", "](https://)", "texto del enlace")}>
            <Link2 className="size-3.5" strokeWidth={1.9} />
          </Tool>
          <Tool
            label="Bloque de código"
            onClick={() => insertBlock("```\ncódigo\n```", 4)}
          >
            <Code2 className="size-3.5" strokeWidth={1.9} />
          </Tool>
          <Tool
            label="Tabla"
            onClick={() =>
              insertBlock(
                [
                  "| Rol | Usuario | Clave |",
                  "| --- | --- | --- |",
                  "|  |  |  |",
                  "|  |  |  |",
                ].join("\n"),
                2,
              )
            }
          >
            <Table className="size-3.5" strokeWidth={1.9} />
          </Tool>
          <Tool
            label={busy ? "Subiendo…" : "Imagen"}
            onClick={() => imageInput.current?.click()}
            disabled={busy}
          >
            {busy ? <Spinner className="size-3.5" /> : <ImagePlus className="size-3.5" strokeWidth={1.9} />}
          </Tool>
          <Tool label="Separador" onClick={() => insertBlock("---")}>
            <Minus className="size-3.5" strokeWidth={2} />
          </Tool>
        </Group>

        <Separator />

        <Tool
          label="Bloque solo para el equipo"
          onClick={() =>
            insertBlock(
              `${TEAM_BLOCK_OPEN}\n\n${TEAM_BLOCK_CLOSE}`,
              TEAM_BLOCK_OPEN.length + 1,
            )
          }
        >
          <Lock className="size-3.5" strokeWidth={1.9} />
        </Tool>

        <div className="ml-auto flex items-center gap-0.5">
          <Tool label="Subir un archivo .md" onClick={() => mdInput.current?.click()}>
            <Upload className="size-3.5" strokeWidth={1.9} />
          </Tool>
          <Tool label="Bajar como .md" onClick={download}>
            <Download className="size-3.5" strokeWidth={1.9} />
          </Tool>
          <Tool
            label="Copiar el Markdown"
            onClick={async () => {
              await navigator.clipboard.writeText(value);
              toast.success("Markdown copiado");
            }}
          >
            <Copy className="size-3.5" strokeWidth={1.9} />
          </Tool>
        </div>
      </div>

      {/* Escribir / Vista previa */}
      <div className="flex items-center gap-1 border-b border-line-soft px-2 py-1.5">
        <Toggle active={mode === "write"} onClick={() => setMode("write")}>
          <Pencil className="size-3" strokeWidth={2} />
          Escribir
        </Toggle>
        <Toggle active={mode === "preview"} onClick={showPreview}>
          <Eye className="size-3" strokeWidth={2} />
          Vista previa
        </Toggle>
        <span className="ml-auto text-2xs tabular text-ink-4">
          {value.length.toLocaleString("es-AR")} / {MAX_DOC_LENGTH.toLocaleString("es-AR")}
        </span>
      </div>

      {mode === "write" ? (
        <textarea
          ref={area}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
          spellCheck
          placeholder={PLACEHOLDER}
          className="block max-h-[70vh] min-h-[380px] w-full resize-y bg-transparent px-4 py-3.5 font-mono text-xs leading-relaxed text-ink placeholder:text-ink-4 focus:outline-none"
        />
      ) : (
        <div className="min-h-[380px] px-4 py-3.5">
          {preview === null ? (
            <p className="flex items-center gap-2 text-xs text-ink-4">
              <Spinner className="size-3.5" />
              Armando la vista previa…
            </p>
          ) : preview.length === 0 ? (
            <p className="text-xs text-ink-4">El documento está vacío.</p>
          ) : (
            <DocBody segments={preview} />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2.5">
        <p className="text-2xs leading-relaxed text-ink-4">
          Markdown con tablas y listas de tareas.{" "}
          <span className="text-ink-3">{TEAM_BLOCK_OPEN}</span> abre un bloque que sólo ve
          el equipo (cerralo con <span className="text-ink-3">{TEAM_BLOCK_CLOSE}</span>).
        </p>
        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (dirty && !confirm("Hay cambios sin guardar. ¿Los descartamos?")) return;
                onClose();
              }}
            >
              Cancelar
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={save} loading={saving}>
            Guardar
          </Button>
        </div>
      </div>

      <input
        ref={mdInput}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        hidden
        onChange={(event) => {
          void importMarkdown(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void insertImage(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

const PLACEHOLDER = `# Qué es este proyecto

Dos o tres líneas para alguien que llega hoy.

## Cómo levantarlo

1. …

${TEAM_BLOCK_OPEN}
## Cuentas de prueba

| Rol | Usuario | Clave |
| --- | --- | --- |
| Admin | … | … |
${TEAM_BLOCK_CLOSE}
`;

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Separator() {
  return <span className="mx-1 h-4 w-px bg-line-soft" aria-hidden />;
}

function Tool({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="sm"
        icon
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-[var(--r-sm)] px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
