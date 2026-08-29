"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Check, Copy, KeyRound, Plus } from "lucide-react";

import { createApiTokenAction, revokeApiToken } from "@/server/actions/tokens";
import { shortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

/**
 * Opciones de expiración de la UI. Viven en el cliente a propósito: un módulo
 * "use server" solo expone acciones a los clientes, los valores constantes no
 * se transportan y quedan `undefined` en runtime. La acción del servidor
 * valida cualquier fecha futura por sí sola.
 */
const EXPIRY_OPTIONS = [
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 año" },
] as const;

export type ApiTokenRow = {
  id: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
};

/**
 * Acceso por API: tokens para clientes MCP.
 *
 * El token crudo se muestra una sola vez, en el momento de crearlo, junto con
 * la URL del endpoint. Después solo queda el hash (enmascarado) en la lista.
 */
export function ApiTokens({ slug, tokens }: { slug: string; tokens: ApiTokenRow[] }) {
  const router = useRouter();
  const [expiry, setExpiry] = React.useState<string>(EXPIRY_OPTIONS[1].label);
  const [pending, setPending] = React.useState(false);
  const [created, setCreated] = React.useState<{ raw: string; expiresAt: string } | null>(null);
  // `location` no existe durante el render del servidor: la URL del endpoint se
  // calcula recién en el navegador. El cuadro que la muestra solo aparece tras
  // crear un token (acción de cliente), así que siempre llega seteada.
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);

  const create = async () => {
    if (pending) return;
    const option = EXPIRY_OPTIONS.find((o) => o.label === expiry) ?? EXPIRY_OPTIONS[0];
    const expiresAt = new Date(Date.now() + option.days * 86_400_000).toISOString();

    setPending(true);
    const result = await createApiTokenAction(slug, { expiresAt });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setCreated({ raw: result.data.rawToken, expiresAt });
    toast.success("Token creado");
    router.refresh();
  };

  const revoke = async (tokenId: string) => {
    const result = await revokeApiToken(slug, tokenId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Token revocado");
    router.refresh();
  };

  const mcpUrl = `${origin}/api/mcp`;

  return (
    <div className="space-y-4">
      <div className="space-y-3.5 rounded-[var(--r-lg)] border border-line bg-surface p-4">
        <Field
          label="Crear token de acceso"
          hint="Un token le da a un cliente IA acceso de solo lectura a este workspace. Vence solo, y podés revocarlo cuando quieras."
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-[var(--r-md)] bg-surface-2 p-1">
              {EXPIRY_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setExpiry(option.label)}
                  className={
                    "flex-1 rounded-[var(--r-sm)] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all " +
                    (expiry === option.label
                      ? "bg-surface text-ink shadow-[var(--shadow-sm)]"
                      : "text-ink-3 hover:text-ink")
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button variant="primary" size="sm" onClick={create} loading={pending}>
              <Plus className="size-3.5" strokeWidth={2.2} />
              Crear token
            </Button>
          </div>
        </Field>

        {created && (
          <div className="rounded-[var(--r-md)] border border-line-strong bg-surface-2 p-3">
            <p className="text-2xs font-medium tracking-wide text-ink-3 uppercase">
              Guardá este token — no se vuelve a mostrar
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-2">
              Copialo en la configuración del cliente MCP (Claude, Cursor, opencode...), junto
              con la URL del endpoint. Vence el {shortDate(created.expiresAt)}.
            </p>

            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-line bg-surface px-3 py-2">
                <KeyRound className="size-3.5 shrink-0 text-ink-4" strokeWidth={1.9} />
                <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">
                  {created.raw}
                </code>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => {
                    void navigator.clipboard.writeText(created.raw);
                    toast.success("Token copiado");
                  }}
                >
                  <Copy className="size-3" strokeWidth={2} />
                  Copiar
                </Button>
              </div>
              <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-line bg-surface px-3 py-2">
                <span className="size-3.5 shrink-0 font-mono text-xs leading-none text-ink-4">
                  URL
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{mcpUrl}</code>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => {
                    void navigator.clipboard.writeText(mcpUrl);
                    toast.success("URL copiada");
                  }}
                >
                  <Copy className="size-3" strokeWidth={2} />
                  Copiar
                </Button>
              </div>
            </div>

            <div className="mt-2 flex justify-end">
              <Button size="xs" variant="ghost" onClick={() => setCreated(null)}>
                <Check className="size-3" strokeWidth={2} />
                Listo
              </Button>
            </div>
          </div>
        )}
      </div>

      {tokens.length > 0 && (
        <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
          {tokens.map((token) => (
            <div key={token.id} className="row hairline flex items-center gap-3 px-3.5 py-2.5">
              <KeyRound className="size-4 shrink-0 text-ink-4" strokeWidth={1.9} />
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">
                {token.id.slice(0, 10)}…
              </code>
              <span className="hidden text-2xs text-ink-3 sm:block">
                Vence {shortDate(token.expiresAt)}
              </span>
              {token.revoked ? (
                <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-2xs font-medium text-ink-3">
                  Revocado
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => revoke(token.id)}
                  className="text-ink-3 group-hover:text-[var(--tone-blocked)]"
                >
                  <Ban className="size-3" strokeWidth={2} />
                  Revocar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-2xs leading-relaxed text-ink-4">
        Los tokens se guardan como hash (nunca el valor crudo), expiran solos y se pueden
        revocar en cualquier momento. El límite de lectura es de 120 pedidos por minuto y
        token.
      </p>
    </div>
  );
}