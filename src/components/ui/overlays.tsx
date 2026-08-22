"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Capas flotantes. Todas comparten superficie, sombra y animación de entrada
 * para que abrir un menú, un popover o un diálogo se sienta como el mismo
 * gesto en distintos tamaños.
 */

const surface =
  "bg-surface border border-line rounded-[var(--r-lg)] shadow-[var(--shadow-lg)] " +
  "data-[state=open]:animate-rise data-[state=closed]:animate-fade-out origin-[var(--radix-popper-transform-origin)]";

// ------------------------------------------------------------------ diálogo

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  width = "md",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  width?: "sm" | "md" | "lg";
}) {
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[1px] data-[state=open]:animate-fade"
        style={{ animationDuration: "150ms" }}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
          "bg-surface border border-line rounded-[var(--r-xl)] shadow-[var(--shadow-lg)]",
          "data-[state=open]:animate-rise focus:outline-none",
          widths[width],
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-md font-semibold text-ink">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-xs text-ink-3">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">
                {title}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="-mr-1 -mt-0.5 grid size-7 shrink-0 place-items-center rounded-[var(--r-sm)] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink">
            <X className="size-4" />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pb-1", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center justify-end gap-2 border-t border-line-soft px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

// -------------------------------------------------------------------- panel

/** Panel lateral: el detalle de un elemento sin perder de vista la lista. */
export function Sheet({
  open,
  onOpenChange,
  children,
  title,
  width = 520,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title: string;
  width?: number;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] data-[state=open]:animate-fade" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed right-0 top-0 z-50 flex h-dvh w-full flex-col bg-surface shadow-[var(--shadow-lg)]",
            "border-l border-line focus:outline-none",
            "data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
          )}
          style={{ maxWidth: width }}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// --------------------------------------------------------------------- menú

export const Menu = DropdownPrimitive.Root;
export const MenuTrigger = DropdownPrimitive.Trigger;

export function MenuContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(surface, "z-50 min-w-[180px] overflow-hidden p-1", className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function MenuItem({
  className,
  destructive = false,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-[var(--r-sm)] px-2 py-1.5 text-sm outline-none",
        "data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        destructive
          ? "text-[var(--tone-blocked)] data-[highlighted]:bg-[var(--tone-blocked-wash)]"
          : "text-ink-2 data-[highlighted]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("px-2 pb-1 pt-1.5 text-2xs font-medium uppercase tracking-wide text-ink-4", className)}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-line-soft" />;
}

// ------------------------------------------------------------------ popover

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(surface, "z-50 p-1 focus:outline-none", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

// ------------------------------------------------------------------ tooltip

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={420} skipDelayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
  shortcut,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string;
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-[70] flex items-center gap-2 rounded-[var(--r-sm)] bg-ink px-2 py-1 text-2xs font-medium",
            "text-[var(--paper)] shadow-[var(--shadow-md)] data-[state=delayed-open]:animate-fade",
          )}
        >
          {content}
          {shortcut && (
            <span className="rounded-[3px] bg-white/15 px-1 py-px font-mono text-[9px] tracking-wide">
              {shortcut}
            </span>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** Tecla rápida en la interfaz. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[3px] border border-line bg-surface-2 px-1 py-px font-mono text-[10px] leading-4 text-ink-3">
      {children}
    </kbd>
  );
}
