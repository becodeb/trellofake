"use client";

import { useActionState } from "react";

import { signup } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, null);

  return (
    <form action={formAction} className="space-y-3.5">
      <Field label="Nombre del equipo" hint="Podés cambiarlo después.">
        <Input name="workspaceName" placeholder="Estudio Cardinal" required autoFocus />
      </Field>

      <div className="h-px bg-line-soft" />

      <Field label="Tu nombre">
        <Input name="name" autoComplete="name" placeholder="Ezequiel Fernández" required />
      </Field>

      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="vos@equipo.com"
          required
        />
      </Field>

      <Field label="Contraseña" hint="Mínimo 8 caracteres.">
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          minLength={8}
          required
        />
      </Field>

      {state && !state.ok && <FormError>{state.error}</FormError>}

      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        Crear equipo
      </Button>
    </form>
  );
}
