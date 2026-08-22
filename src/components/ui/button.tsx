"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/cn";

/**
 * Un solo botón para toda la app. El acento se reserva para la acción
 * principal de cada pantalla: si hay dos botones "primary" a la vista,
 * alguno de los dos está mal.
 */

const VARIANTS = {
  primary:
    "bg-accent text-on-accent border border-transparent hover:bg-accent-hover shadow-[0_1px_2px_rgba(28,26,23,0.12)]",
  default:
    "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong shadow-[0_1px_1px_rgba(28,26,23,0.03)]",
  subtle: "bg-surface-2 text-ink border border-transparent hover:bg-surface-3",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:bg-surface-2 hover:text-ink",
  danger:
    "bg-transparent text-[var(--tone-blocked)] border border-transparent hover:bg-[var(--tone-blocked-wash)]",
} as const;

const SIZES = {
  xs: "h-6 px-2 text-2xs gap-1 rounded-[var(--r-sm)]",
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-[var(--r-sm)]",
  md: "h-8 px-3 text-sm gap-1.5 rounded-[var(--r-md)]",
  lg: "h-9.5 px-4 text-base gap-2 rounded-[var(--r-md)]",
} as const;

const ICON_SIZES = {
  xs: "size-6 p-0",
  sm: "size-7 p-0",
  md: "size-8 p-0",
  lg: "size-9.5 p-0",
} as const;

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: boolean;
  asChild?: boolean;
  loading?: boolean;
};

export function Button({
  className,
  variant = "default",
  size = "md",
  icon = false,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap select-none",
        "transition-[background-color,border-color,color,transform,opacity] duration-100",
        "active:scale-[0.985] disabled:opacity-45 disabled:pointer-events-none",
        SIZES[size],
        icon && ICON_SIZES[size],
        VARIANTS[variant],
        loading && "pointer-events-none opacity-70",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </Comp>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin",
        className,
      )}
      aria-hidden
    />
  );
}

/** Botón de icono que sólo aparece al pasar el mouse por la fila que lo contiene. */
export function RowAction({ className, ...props }: ButtonProps) {
  return (
    <Button
      variant="ghost"
      size="xs"
      icon
      className={cn(
        "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-ink-3",
        className,
      )}
      {...props}
    />
  );
}
