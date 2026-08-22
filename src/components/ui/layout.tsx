import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Piezas de composición de página. La jerarquía visual de la app sale de acá:
 * un encabezado con una sola voz principal, secciones que se anuncian con una
 * línea pequeña, y vacíos que explican qué hacer en vez de quedarse mudos.
 */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("mb-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1.5 text-2xs font-medium uppercase tracking-[0.08em] text-ink-4">
              {eyebrow}
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-prose text-sm text-ink-3">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function SectionHeader({
  title,
  count,
  action,
  className,
}: {
  title: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex items-center justify-between gap-3", className)}>
      <h2 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.07em] text-ink-3">
        {title}
        {count !== undefined && (
          <span className="text-2xs font-medium tabular text-ink-4">{count}</span>
        )}
      </h2>
      {action}
    </div>
  );
}

export function Card({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[var(--r-lg)] border border-line bg-surface",
        interactive &&
          "transition-[border-color,box-shadow,transform] duration-150 hover:border-line-strong hover:shadow-[var(--shadow-md)]",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--r-lg)] border border-dashed border-line text-center",
        compact ? "px-5 py-7" : "px-6 py-14",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 grid size-9 place-items-center rounded-full bg-surface-2 text-ink-3">
          {icon}
        </div>
      )}
      <p
        className={cn(
          "text-ink",
          compact ? "text-sm font-medium" : "font-display text-xl leading-tight",
        )}
      >
        {title}
      </p>
      {description && (
        <p className="mt-1.5 max-w-[38ch] text-xs leading-relaxed text-ink-3">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Separador con etiqueta, para cortar listas largas por fecha o por grupo. */
export function Divider({
  label,
  tone = "default",
  className,
}: {
  label?: React.ReactNode;
  tone?: "default" | "accent";
  className?: string;
}) {
  if (!label) return <div className={cn("h-px bg-line-soft", className)} />;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "shrink-0 text-2xs font-medium uppercase tracking-[0.07em]",
          tone === "accent" ? "text-accent-ink" : "text-ink-4",
        )}
      >
        {label}
      </span>
      <span
        className={cn("h-px flex-1", tone === "accent" ? "bg-accent-line" : "bg-line-soft")}
      />
    </div>
  );
}

/** Dato numérico del dashboard. Un número, una etiqueta, cero decoración. */
export function Stat({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl font-semibold tabular leading-none tracking-tight"
          style={{ color: tone ?? "var(--ink)" }}
        >
          {value}
        </span>
        {hint && <span className="text-2xs text-ink-4">{hint}</span>}
      </div>
      <div className="mt-1.5 text-xs text-ink-3">{label}</div>
    </>
  );

  const className =
    "block rounded-[var(--r-md)] px-3 py-2.5 transition-colors " +
    (href ? "hover:bg-surface-2" : "");

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }
  return <div className={className}>{content}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
