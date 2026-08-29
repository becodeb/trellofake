"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LogIn, LogOut, Menu, Moon, Search, Sun, User as UserIcon, UserPlus } from "lucide-react";

import { cn } from "@/lib/cn";
import { logout } from "@/server/actions/auth";
import { ROLE_LABEL, type WorkspaceRole } from "@/lib/domain";
import { Avatar, type PersonLike } from "@/components/ui/avatar";
import {
  Menu as DropMenu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/overlays";
import { Sidebar } from "@/components/app/sidebar";
import { CommandPalette } from "@/components/app/command-palette";
import { QuickCreate } from "@/components/app/quick-create";
import type { ProjectOption } from "@/components/app/pickers";
import type { ProjectNode } from "@/server/domain/projects";

export type ShellProps = {
  teamName: string;
  /** null cuando no hay sesión: el shell se sirve igual, público. */
  user: (PersonLike & { email?: string }) | null;
  role: string;
  isGuest: boolean;
  canManage: boolean;
  canWork: boolean;
  projects: ProjectNode[];
  projectOptions: ProjectOption[];
  members: PersonLike[];
  unread: number;
  myOpenTasks: number;
  children: React.ReactNode;
};

/**
 * Estructura de la aplicación: navegación fija a la izquierda, contenido a la
 * derecha. En pantallas chicas la navegación pasa a ser un cajón, porque una
 * herramienta de trabajo tiene que poder consultarse desde el teléfono aunque
 * se use sentado.
 *
 * Los visitantes sin sesión navegan igual: ven los CTAs Ingresar/Registrarte
 * en lugar del menú de usuario, y las acciones de escritura quedan ocultas.
 */
export function AppShell({
  teamName,
  user,
  role,
  isGuest,
  canManage,
  canWork,
  projects,
  projectOptions,
  members,
  unread,
  myOpenTasks,
  children,
}: ShellProps) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => setDrawerOpen(false), [pathname]);

  // Atajos globales. "c" solo dispara si no estás escribiendo en otro lado.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!canWork) return;
        setPaletteOpen((v) => !v);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "c" && canWork) {
        event.preventDefault();
        setCreateOpen(true);
      }
      if (event.key === "/" && canWork) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canWork]);

  const nav = (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Sidebar
          teamName={teamName}
          projects={projects}
          unread={unread}
          myOpenTasks={myOpenTasks}
          canManage={canManage}
          canWork={canWork}
          onSearch={() => setPaletteOpen(true)}
          onCreate={() => setCreateOpen(true)}
          onNavigate={() => setDrawerOpen(false)}
        />
      </div>
      {user ? (
        <UserMenu user={user} role={role} />
      ) : (
        <GuestMenu />
      )}
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-paper">
      <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 border-r border-line lg:block">
        {nav}
      </aside>

      {/* Cajón de navegación para pantallas chicas. */}
      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] data-[state=open]:animate-fade lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed left-0 top-0 z-50 h-dvh w-[264px] border-r border-line bg-paper shadow-[var(--shadow-lg)] data-[state=open]:animate-rise lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Navegación</DialogPrimitive.Title>
            {nav}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-paper/85 px-3 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="grid size-8 place-items-center rounded-[var(--r-md)] text-ink-2 transition-colors hover:bg-surface-2"
            aria-label="Abrir navegación"
          >
            <Menu className="size-4.5" strokeWidth={1.9} />
          </button>
          <span className="truncate text-sm font-medium text-ink">{teamName}</span>
          {canWork && (
            <button
              onClick={() => setPaletteOpen(true)}
              className="ml-auto grid size-8 place-items-center rounded-[var(--r-md)] text-ink-2 transition-colors hover:bg-surface-2"
              aria-label="Buscar"
            >
              <Search className="size-4" strokeWidth={1.9} />
            </button>
          )}
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {canWork && (
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          canManage={canManage}
        />
      )}
      {canWork && (
        <QuickCreate
          open={createOpen}
          onOpenChange={setCreateOpen}
          projects={projectOptions}
          members={members}
        />
      )}
    </div>
  );
}

function UserMenu({ user, role }: { user: PersonLike & { email?: string }; role: string }) {
  const router = useRouter();
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("hilo-theme", next ? "dark" : "light");
    } catch {
      // Modo incógnito con almacenamiento bloqueado: el tema dura la sesión.
    }
  };

  return (
    <div className="border-t border-line-soft p-2">
      <DropMenu>
        <MenuTrigger className="flex w-full items-center gap-2 rounded-[var(--r-md)] px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2">
          <Avatar person={user} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
            <span className="block truncate text-2xs text-ink-4">
              {ROLE_LABEL[role as WorkspaceRole] ?? role}
            </span>
          </span>
        </MenuTrigger>

        <MenuContent align="start" side="top" className="w-[212px]">
          <MenuLabel>{user.email}</MenuLabel>
          <MenuItem onSelect={() => router.push("/perfil")}>
            <UserIcon className="size-3.5" strokeWidth={1.9} />
            Mi perfil
          </MenuItem>
          <MenuItem
            onSelect={(event) => {
              event.preventDefault();
              toggleTheme();
            }}
          >
            {dark ? (
              <Sun className="size-3.5" strokeWidth={1.9} />
            ) : (
              <Moon className="size-3.5" strokeWidth={1.9} />
            )}
            {dark ? "Tema claro" : "Tema oscuro"}
          </MenuItem>
          <MenuSeparator />
          <MenuItem destructive onSelect={() => void logout()}>
            <LogOut className="size-3.5" strokeWidth={1.9} />
            Cerrar sesión
          </MenuItem>
        </MenuContent>
      </DropMenu>
    </div>
  );
}

/** Visitante sin sesión: entrar o crearse una cuenta, nada más. */
function GuestMenu() {
  return (
    <div className="space-y-1 border-t border-line-soft p-2">
      <Link
        href="/login"
        className="flex h-8 w-full items-center gap-2 rounded-[var(--r-md)] px-2 text-sm font-medium text-accent-ink transition-colors hover:bg-surface-2"
      >
        <LogIn className="size-3.5" strokeWidth={1.9} />
        Ingresar
      </Link>
      <Link
        href="/signup"
        className="flex h-8 w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-accent px-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
      >
        <UserPlus className="size-3.5" strokeWidth={1.9} />
        Registrarte
      </Link>
    </div>
  );
}

/** Contenedor de página: ancho máximo y respiración consistentes. */
export function Page({
  children,
  className,
  width = "default",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "default" | "wide" | "full";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 py-7 sm:px-7 lg:px-9",
        width === "default" && "max-w-[1180px]",
        width === "wide" && "max-w-[1480px]",
        className,
      )}
    >
      {children}
    </div>
  );
}