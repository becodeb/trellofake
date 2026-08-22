"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { changePassword, updateProfile } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function ProfileForm({
  name: initialName,
  avatarUrl: initialAvatar,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName);
  const [avatarUrl, setAvatarUrl] = React.useState(initialAvatar ?? "");
  const [savingProfile, setSavingProfile] = React.useState(false);

  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [savingPassword, setSavingPassword] = React.useState(false);

  const saveProfile = async () => {
    const data = new FormData();
    data.set("name", name);
    data.set("avatarUrl", avatarUrl);

    setSavingProfile(true);
    const result = await updateProfile(data);
    setSavingProfile(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Perfil actualizado");
    router.refresh();
  };

  const savePassword = async () => {
    const data = new FormData();
    data.set("current", current);
    data.set("next", next);

    setSavingPassword(true);
    const result = await changePassword(data);
    setSavingPassword(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Contraseña cambiada");
    setCurrent("");
    setNext("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3.5 rounded-[var(--r-lg)] border border-line bg-surface p-4">
        <Field label="Nombre">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <Field
          label="Foto"
          hint="Pegá la URL de una imagen. Si lo dejás vacío, se usan tus iniciales."
        >
          <Input
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://…"
          />
        </Field>

        <div className="flex justify-end border-t border-line-soft pt-3">
          <Button
            variant="primary"
            size="sm"
            onClick={saveProfile}
            loading={savingProfile}
            disabled={name === initialName && avatarUrl === (initialAvatar ?? "")}
          >
            Guardar
          </Button>
        </div>
      </div>

      <div className="space-y-3.5 rounded-[var(--r-lg)] border border-line bg-surface p-4">
        <p className="text-xs font-medium text-ink-2">Cambiar contraseña</p>

        <Field label="Contraseña actual">
          <Input
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
          />
        </Field>

        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres.">
          <Input
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <div className="flex justify-end border-t border-line-soft pt-3">
          <Button
            variant="default"
            size="sm"
            onClick={savePassword}
            loading={savingPassword}
            disabled={!current || next.length < 8}
          >
            Cambiar contraseña
          </Button>
        </div>
      </div>
    </div>
  );
}
