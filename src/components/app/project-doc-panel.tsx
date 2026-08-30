"use client";

import * as React from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectDocEditor } from "@/components/app/project-doc-editor";

/**
 * Alterna entre leer el documento y editarlo.
 *
 * El documento leído lo renderiza el servidor y llega como `children`: acá no
 * se vuelve a interpretar Markdown, sólo se decide si se muestra eso o el
 * editor. El markdown crudo únicamente llega a este componente cuando quien
 * mira puede escribir; para el resto de los lectores esta pieza ni se monta.
 */
export function ProjectDocPanel({
  projectId,
  markdown,
  children,
  startEditing = false,
}: {
  projectId: string;
  markdown: string;
  children: React.ReactNode;
  startEditing?: boolean;
}) {
  const [editing, setEditing] = React.useState(startEditing);

  if (editing) {
    return (
      <ProjectDocEditor
        projectId={projectId}
        initialMarkdown={markdown}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="default" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" strokeWidth={1.9} />
          Editar
        </Button>
      </div>
      {children}
    </div>
  );
}

/** Botón suelto para arrancar el documento cuando todavía no existe. */
export function StartDocButton({
  projectId,
  label = "Escribir el léeme",
}: {
  projectId: string;
  label?: string;
}) {
  const [editing, setEditing] = React.useState(false);

  if (editing) {
    return (
      <ProjectDocEditor
        projectId={projectId}
        initialMarkdown=""
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <Button variant="default" size="sm" onClick={() => setEditing(true)}>
      <Pencil className="size-3.5" strokeWidth={1.9} />
      {label}
    </Button>
  );
}
