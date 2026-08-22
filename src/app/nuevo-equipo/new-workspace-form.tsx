"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createWorkspace } from "@/server/actions/workspace";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function NewWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || pending) return;

    setPending(true);
    const result = await createWorkspace(name.trim());
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.replace(`/w/${result.data.slug}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Nombre del equipo" hint="Podés cambiarlo después.">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Estudio Cardinal"
          autoFocus
          required
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        loading={pending}
        disabled={!name.trim()}
      >
        Crear equipo
      </Button>
    </form>
  );
}
