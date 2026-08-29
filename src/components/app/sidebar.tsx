"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  ChevronRight,
  Compass,
  Inbox,
  ListChecks,
  Plus,
  Search,
  Settings,
  LayoutGrid,
  Library,
  Lightbulb,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { accentHex } from "@/lib/domain";
import { Wordmark } from "@/components/brand";
import { Tooltip } from "@/components/ui/overlays";
import type { ProjectNode } from "@/server/domain/projects";

export type SidebarProps = {
  teamName: string;
  projects: ProjectNode[];
  unread: number;
  myOpenTasks: number;
  canManage: boolean;
  canWork: boolean;
  onSearch: () => void;
  onCreate: () => void;
  onNavigate?: () => void;
};

export function Sidebar({
  teamName,
  projects,
  unread,
  myOpenTasks,
  canManage,
  canWork,
  onSearch,
  onCreate,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Inicio", icon: Compass, exact: true },
    { href: "/novedades", label: "Novedades", icon: Inbox, badge: unread },
    ...(canWork
      ? [{ href: "/mi-trabajo", label: "Mi trabajo", icon: ListChecks, count: myOpenTasks }]
      : []),
    { href: "/proyectos", label: "Proyectos", icon: LayoutGrid },
    { href: "/ideas", label: "Ideas propuestas", icon: Lightbulb },
    { href: "/recursos", label: "Recursos compartidos", icon: Library },
  ];

  return (
    <div className="flex h-full flex-col gap-1 px-2.5 pb-3 pt-3">
      <div className="flex items-center justify-between px-1.5 pb-2">
        <Link href="/" onClick={onNavigate} className="min-w-0">
          <Wordmark size="sm" />
        </Link>
      </div>

      <div className="truncate px-1 pb-1 text-2xs font-medium uppercase tracking-[0.08em] text-ink-4">
        {teamName}
      </div>

      {/* Las dos acciones que se usan cien veces por día viven arriba de todo. */}
      <div className="mb-1 flex gap-1.5">
        {canWork && (
          <button
            onClick={onCreate}
            className="group flex h-8 flex-1 items-center gap-2 rounded-[var(--r-md)] bg-accent px-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
            Crear
          </button>
        )}
        {canWork && <Tooltip content="Buscar" shortcut="⌘K">
          <button
            onClick={onSearch}
            aria-label="Buscar"
            className="grid size-8 place-items-center rounded-[var(--r-md)] border border-line bg-surface text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
          >
            <Search className="size-3.5" strokeWidth={2} />
          </button>
        </Tooltip>}
      </div>

      <nav className="flex flex-col gap-px">
        {links.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <NavLink
              key={link.href}
              href={link.href}
              icon={<link.icon className="size-4" strokeWidth={1.9} />}
              active={active}
              badge={link.badge}
              count={link.count}
              onClick={onNavigate}
            >
              {link.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        <div className="mb-1 flex items-center justify-between px-2">
          <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-4">
            Proyectos
          </span>
        </div>

        {projects.length === 0 ? (
          <p className="px-2 py-1.5 text-xs leading-relaxed text-ink-4">
            Todavía no hay proyectos.
          </p>
        ) : (
          <ul className="flex flex-col gap-px">
            {projects.map((project) => (
              <ProjectBranch
                key={project.id}
                node={project}
                depth={0}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-px border-t border-line-soft pt-2">
        <NavLink
          href="/archivo"
          icon={<Archive className="size-4" strokeWidth={1.9} />}
          active={pathname.startsWith("/archivo")}
          onClick={onNavigate}
        >
          Archivo
        </NavLink>
        {canManage && (
          <NavLink
            href="/ajustes"
            icon={<Settings className="size-4" strokeWidth={1.9} />}
            active={pathname.startsWith("/ajustes")}
            onClick={onNavigate}
          >
            Ajustes
          </NavLink>
        )}
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
  active,
  badge,
  count,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  badge?: number;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-[var(--r-md)] px-2 text-sm transition-colors",
        active
          ? "bg-surface-2 font-medium text-ink"
          : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {/* Marca de página actual: una barra de acento, no un bloque de color. */}
      <span
        className={cn(
          "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-accent transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <span className={cn("shrink-0", active ? "text-accent" : "text-ink-3")}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge !== undefined && badge > 0 && (
        <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold tabular text-on-accent">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {count !== undefined && count > 0 && badge === undefined && (
        <span className="shrink-0 text-2xs tabular text-ink-4">{count}</span>
      )}
    </Link>
  );
}

/** Rama del árbol de proyectos: se pliega, muestra el color del proyecto. */
function ProjectBranch({
  node,
  depth,
  pathname,
  onNavigate,
}: {
  node: ProjectNode;
  depth: number;
  pathname: string;
  onNavigate?: () => void;
}) {
  const href = `/p/${node.id}`;
  const active = pathname.startsWith(href);
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = React.useState(active || depth === 0);

  React.useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <li>
      <div
        className={cn(
          "group relative flex h-7 items-center rounded-[var(--r-sm)] transition-colors",
          active ? "bg-surface-2" : "hover:bg-surface-2",
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "grid size-4 shrink-0 place-items-center rounded-[3px] text-ink-4 transition-colors hover:text-ink-2",
            !hasChildren && "invisible",
          )}
          aria-label={open ? "Contraer" : "Expandir"}
        >
          <ChevronRight
            className={cn("size-3 transition-transform duration-150", open && "rotate-90")}
            strokeWidth={2.25}
          />
        </button>

        <Link
          href={href}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2 pr-2 text-sm"
        >
          <span
            className="size-1.5 shrink-0 rounded-[2px]"
            style={{
              background: accentHex(node.accent),
              opacity: node.status === "active" ? 1 : 0.4,
            }}
          />
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              active ? "font-medium text-ink" : "text-ink-2 group-hover:text-ink",
            )}
          >
            {node.name}
          </span>
          {node.progress > 0 && node.progress < 100 && (
            <span className="shrink-0 text-[10px] tabular text-ink-4">{node.progress}</span>
          )}
        </Link>
      </div>

      {hasChildren && open && (
        <ul className="flex flex-col gap-px">
          {node.children.map((child) => (
            <ProjectBranch
              key={child.id}
              node={child as ProjectNode}
              depth={depth + 1}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}