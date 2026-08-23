"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, KeyRound, MoreHorizontal, UserPlus } from "lucide-react";

import { ROLE_LABEL, WORKSPACE_ROLES, type WorkspaceRole } from "@/lib/domain";
import { relativeTime } from "@/lib/format";
import { addMember, removeMember, setMemberRole } from "@/server/actions/workspace";
import type { WorkspaceMember } from "@/server/domain/dashboard";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/overlays";

/**
 * Gente del equipo.
 *
 * Un admin puede dar de alta a alguien nuevo directamente. Si el email no
 * tenía cuenta, el sistema genera una contraseña temporal y se la muestra al
 * admin una sola vez para que se la pase: nadie elige la contraseña de otro.
 */
export function MemberList({
  slug,
  members,
  viewerId,
}: {
  slug: string;
  members: WorkspaceMember[];
  viewerId: string;
}) {
  const router = useRouter();
  const [inviting, setInviting] = React.useState(false);

  const changeRole = async (userId: string, role: string) => {
    const result = await setMemberRole(slug, userId, role);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Rol actualizado");
      router.refresh();
    }
  };

  const remove = async (userId: string, name: string) => {
    const result = await removeMember(slug, userId);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(`${name} salió del equipo`);
      router.refresh();
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
        {members.map((member) => (
          <div
            key={member.id}
            className="row hairline flex items-center gap-3 px-3.5 py-2.5"
          >
            <Avatar person={member.user} size="lg" />

            <div className="min-w-0 flex-1">
              <Link
                href={`/w/${slug}/gente/${member.user.id}`}
                className="block truncate text-sm font-medium text-ink hover:underline"
              >
                {member.user.name}
                {member.user.id === viewerId && (
                  <span className="ml-1.5 text-2xs font-normal text-ink-4">vos</span>
                )}
              </Link>
              <span className="block truncate text-2xs text-ink-4">
                {member.user.email}
                {member.title && ` · ${member.title}`}
              </span>
            </div>

            <span className="hidden text-2xs text-ink-4 sm:block">
              Visto {relativeTime(member.lastSeenAt)}
            </span>

            <span className="w-16 shrink-0 text-right text-xs text-ink-2">
              {ROLE_LABEL[member.role as WorkspaceRole] ?? member.role}
            </span>

            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="xs" icon aria-label={`Opciones de ${member.user.name}`}>
                  <MoreHorizontal className="size-4" strokeWidth={2} />
                </Button>
              </MenuTrigger>
              <MenuContent align="end" className="w-52">
                <MenuLabel>Rol en el equipo</MenuLabel>
                {WORKSPACE_ROLES.map((role) => (
                  <MenuItem key={role} onSelect={() => changeRole(member.user.id, role)}>
                    <span className="flex-1">{ROLE_LABEL[role]}</span>
                    {member.role === role && (
                      <Check className="size-3.5 text-accent" strokeWidth={2.4} />
                    )}
                  </MenuItem>
                ))}
                {member.user.id !== viewerId && (
                  <>
                    <MenuSeparator />
                    <MenuItem
                      destructive
                      onSelect={() => remove(member.user.id, member.user.name)}
                    >
                      Sacar del equipo
                    </MenuItem>
                  </>
                )}
              </MenuContent>
            </Menu>
          </div>
        ))}

        <button
          onClick={() => setInviting(true)}
          className="flex w-full items-center gap-2.5 border-t border-line-soft px-3.5 py-3 text-sm text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <span className="grid size-9 place-items-center rounded-full border border-dashed border-line-strong">
            <UserPlus className="size-4" strokeWidth={1.9} />
          </span>
          Sumar a alguien
        </button>
      </div>

      <p className="mt-2 text-2xs leading-relaxed text-ink-4">
        Los <strong className="font-medium text-ink-3">desarrolladores</strong> gestionan
        proyectos y trabajo interno. La <strong className="font-medium text-ink-3">comunidad</strong>{" "}
        sigue los proyectos visibles, comenta y propone ideas.
      </p>

      <AddMemberDialog slug={slug} open={inviting} onOpenChange={setInviting} />
    </>
  );
}

function AddMemberDialog({
  slug,
  open,
  onOpenChange,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [role, setRole] = React.useState<WorkspaceRole>("community");
  const [pending, setPending] = React.useState(false);
  const [credentials, setCredentials] = React.useState<{ name: string; password: string } | null>(
    null,
  );

  React.useEffect(() => {
    if (open) return;
    setName("");
    setEmail("");
    setTitle("");
    setRole("community");
    setCredentials(null);
  }, [open]);

  const submit = async () => {
    if (pending) return;
    setPending(true);
    const result = await addMember(slug, { name, email, role, title: title || undefined });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    router.refresh();
    if (result.data.temporaryPassword) {
      setCredentials({ name: result.data.name, password: result.data.temporaryPassword });
    } else {
      toast.success(`${result.data.name} se sumó al equipo`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={credentials ? "Listo" : "Sumar a alguien"}
        description={
          credentials
            ? undefined
            : "Si el email ya tiene cuenta, se suma directo. Si no, se crea una."
        }
      >
        {credentials ? (
          <div className="px-5 pb-2">
            <p className="text-sm text-ink-2">
              <strong className="font-medium text-ink">{credentials.name}</strong> ya es parte
              del equipo. Pasale esta contraseña temporal para que entre; la va a poder cambiar
              desde su perfil.
            </p>

            <div className="mt-3 flex items-center gap-2 rounded-[var(--r-md)] border border-line bg-surface-2 px-3 py-2.5">
              <KeyRound className="size-3.5 shrink-0 text-ink-4" strokeWidth={1.9} />
              <code className="flex-1 font-mono text-sm text-ink">{credentials.password}</code>
              <Button
                size="xs"
                variant="default"
                onClick={() => {
                  void navigator.clipboard.writeText(credentials.password);
                  toast.success("Copiada");
                }}
              >
                <Copy className="size-3" strokeWidth={2} />
                Copiar
              </Button>
            </div>

            <p className="mt-2 text-2xs text-ink-4">
              Esta contraseña se muestra una sola vez.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 px-5">
            <Field label="Nombre">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Valentina Ruiz"
                autoFocus
              />
            </Field>

            <Field label="Email">
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="valentina@equipo.com"
              />
            </Field>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Qué hace" hint="Opcional.">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Diseño"
                />
              </Field>

              <Field label="Rol">
                <div className="grid grid-cols-3 gap-1 rounded-[var(--r-md)] bg-surface-2 p-1">
                  {WORKSPACE_ROLES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRole(option)}
                      className={
                        "flex-1 rounded-[var(--r-sm)] px-2 py-1.5 text-xs font-medium transition-all " +
                        (role === option
                          ? "bg-surface text-ink shadow-[var(--shadow-sm)]"
                          : "text-ink-3 hover:text-ink")
                      }
                    >
                      {ROLE_LABEL[option]}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>
        )}

        <DialogFooter>
          {credentials ? (
            <Button variant="primary" onClick={() => onOpenChange(false)}>
              Listo
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={submit}
                loading={pending}
                disabled={!name.trim() || !email.trim()}
              >
                Sumar al equipo
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
