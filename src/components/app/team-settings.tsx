"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateTeam } from "@/server/actions/team";
import { Button } from "@/components/ui/button";
import { AutoTextarea, Field, Input } from "@/components/ui/field";

export function TeamSettings({
  name: initialName,
  mission: initialMission,
}: {
  name: string;
  mission: string | null;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName);
  const [mission, setMission] = React.useState(initialMission ?? "");
  const [pending, setPending] = React.useState(false);

  const dirty = name !== initialName || mission !== (initialMission ?? "");

  const save = async () => {
    setPending(true);
    const result = await updateTeam({ name, mission: mission || null });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Guardado");
    router.refresh();
  };

  return (
    <div className="space-y-3.5 rounded-[var(--r-lg)] border border-line bg-surface p-4">
      <Field label="Nombre del equipo">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field
        label="En qué anda el equipo"
        hint="Una línea. Aparece como contexto para quien se suma."
      >
        <AutoTextarea
          value={mission}
          onChange={(event) => setMission(event.target.value)}
          placeholder="Diseñamos y construimos productos digitales."
          minRows={2}
        />
      </Field>

      <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3">
        <span className="text-2xs text-ink-4">
          Todo lo del equipo vive en la raíz de la app.
        </span>
        <Button variant="primary" size="sm" onClick={save} loading={pending} disabled={!dirty}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
