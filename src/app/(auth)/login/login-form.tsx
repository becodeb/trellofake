"use client";

import { useActionState } from "react";

import { login } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";

/**
 * La acción redirige desde el servidor si las credenciales son correctas, así
 * que acá sólo queda mostrar el error cuando no lo son.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-3.5">
      {next && <input type="hidden" name="next" value={next} />}

      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="vos@equipo.com"
          required
          autoFocus
        />
      </Field>

      <Field label="Contraseña">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </Field>

      {state && !state.ok && <FormError>{state.error}</FormError>}

      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        Entrar
      </Button>
    </form>
  );
}
