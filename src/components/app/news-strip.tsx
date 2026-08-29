"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";

import { cn } from "@/lib/cn";
import { markRead } from "@/server/actions/team";
import type { ActivityEvent } from "@/lib/shared";
import { ActivityLine } from "@/components/app/activity";
import { Button } from "@/components/ui/button";

/**
 * "Desde tu última visita".
 *
 * Es la respuesta a la pregunta que uno se hace al volver después de dos días.
 * Muestra solo lo que te involucra —no todo lo que pasó— y desaparece cuando
 * ya no hay nada nuevo, en vez de quedar ocupando lugar con un cero.
 */
export function NewsStrip({
  events,
  unread,
  direct,
  currentUserId,
  className,
}: {
  events: ActivityEvent[];
  unread: number;
  direct: number;
  currentUserId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || events.length === 0) return null;

  const markAll = () => {
    setDismissed(true);
    startTransition(async () => {
      await markRead();
      router.refresh();
    });
  };

  return (
    <section
      className={cn(
        "animate-rise overflow-hidden rounded-[var(--r-lg)] border border-accent-line bg-accent-wash/60",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
        <h2 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.07em] text-accent-ink">
          Desde tu última visita
          <span className="text-2xs font-medium tabular opacity-70">
            {unread}
            {direct > 0 && ` · ${direct} para vos`}
          </span>
        </h2>

        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            onClick={markAll}
            loading={pending}
            className="text-accent-ink hover:bg-accent-line/40"
          >
            <Check className="size-3" strokeWidth={2.4} />
            Marcar visto
          </Button>
        </div>
      </div>

      <div className="px-4 pb-1 pl-7">
        {events.map((event) => (
          <ActivityLine
            key={event.id}
            event={event}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      {unread > events.length && (
        <Link
          href={"/novedades"}
          className="flex items-center gap-1.5 border-t border-accent-line/70 px-4 py-2 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-line/25"
        >
          Ver las {unread} novedades
          <ArrowRight className="size-3" strokeWidth={2.2} />
        </Link>
      )}
    </section>
  );
}
