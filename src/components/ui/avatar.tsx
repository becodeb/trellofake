import * as React from "react";

import { cn } from "@/lib/cn";
import { accentHex } from "@/lib/domain";
import { initials } from "@/lib/format";

export type PersonLike = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  accentColor?: string | null;
};

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-7 text-[11px]",
  lg: "size-9 text-xs",
  xl: "size-14 text-base",
} as const;

/**
 * Avatar de iniciales con el color propio de cada persona. Es el mismo color
 * en toda la app, así el equipo empieza a reconocerse por tono además de por
 * nombre.
 */
export function Avatar({
  person,
  size = "md",
  className,
  ring = false,
}: {
  person: PersonLike;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  const color = accentHex(person.accentColor);

  return (
    <span
      className={cn(
        "relative inline-grid place-items-center shrink-0 rounded-full font-semibold select-none overflow-hidden",
        SIZES[size],
        ring && "ring-2 ring-[var(--surface)]",
        className,
      )}
      style={{
        background: person.avatarUrl ? undefined : `${color}1f`,
        color,
      }}
      title={person.name}
    >
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.avatarUrl}
          alt={person.name}
          className="size-full object-cover"
          draggable={false}
        />
      ) : (
        <span
          className="leading-none"
          style={{ letterSpacing: "0.01em" }}
          aria-hidden
        >
          {initials(person.name)}
        </span>
      )}
      <span className="sr-only">{person.name}</span>
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: PersonLike[];
  max?: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex -space-x-1.5">
        {shown.map((person) => (
          <Avatar key={person.id} person={person} size={size} ring />
        ))}
      </div>
      {rest > 0 && (
        <span className="ml-1.5 text-2xs font-medium text-ink-3 tabular">+{rest}</span>
      )}
    </div>
  );
}

/**
 * Avatar con el porcentaje de colaboración. Es la pieza que hace visible que
 * una tarea es de varias personas y en qué medida.
 */
export function WeightedAvatar({
  person,
  weight,
  size = "sm",
}: {
  person: PersonLike;
  weight: number;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2"
      title={`${person.name} — ${weight}% de la tarea`}
    >
      <Avatar person={person} size={size} />
      <span className="text-2xs font-medium tabular text-ink-2">{weight}%</span>
    </span>
  );
}
