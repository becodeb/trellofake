"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

const base =
  "w-full bg-surface border border-line rounded-[var(--r-md)] text-ink placeholder:text-ink-4 " +
  "transition-[border-color,box-shadow] duration-100 " +
  "hover:border-line-strong focus:border-accent focus:outline-none " +
  "focus:shadow-[0_0_0_3px_var(--accent-wash)] disabled:opacity-50";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(base, "h-8.5 px-2.5 text-sm", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(base, "px-2.5 py-2 text-sm leading-relaxed resize-none", className)}
      {...props}
    />
  );
}

/**
 * Textarea que crece con el contenido. Escribir una nota larga no debería
 * obligar a scrollear dentro de una cajita de tres líneas.
 */
export function AutoTextarea({
  className,
  value,
  minRows = 2,
  maxHeight = 420,
  ref: forwardedRef,
  ...props
}: React.ComponentProps<"textarea"> & { minRows?: number; maxHeight?: number }) {
  const inner = React.useRef<HTMLTextAreaElement>(null);

  // El componente necesita su propia referencia para medir el alto; si además
  // le pasan una desde afuera, se atienden las dos.
  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      inner.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const resize = React.useCallback(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [maxHeight]);

  React.useLayoutEffect(resize, [value, resize]);

  return (
    <textarea
      ref={setRef}
      rows={minRows}
      value={value}
      onInput={resize}
      className={cn(base, "px-2.5 py-2 text-sm leading-relaxed resize-none", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("block text-xs font-medium text-ink-2 mb-1.5", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && <Label>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-[var(--tone-blocked)]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

/** Mensaje de error de formulario, discreto pero imposible de no ver. */
export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="animate-rise flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--tone-blocked)]/25 bg-[var(--tone-blocked-wash)] px-2.5 py-2 text-xs text-[var(--tone-blocked)]"
    >
      {children}
    </p>
  );
}
