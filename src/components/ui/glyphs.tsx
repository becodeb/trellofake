import * as React from "react";

import { cn } from "@/lib/cn";
import { PRIORITY_META, statusMeta, type Priority, type Tone } from "@/lib/domain";

/**
 * El lenguaje de estado de la app.
 *
 * En vez de llenar las listas de pastillas de color, cada elemento lleva un
 * glifo chico que dice dos cosas a la vez: en qué estado está (color) y cuánto
 * avanzó (el arco relleno). Se lee de un vistazo y no compite con el texto.
 */

export const TONE_VAR: Record<Tone, string> = {
  neutral: "var(--tone-neutral)",
  progress: "var(--tone-progress)",
  review: "var(--tone-review)",
  done: "var(--tone-done)",
  blocked: "var(--tone-blocked)",
  idea: "var(--tone-idea)",
  info: "var(--tone-info)",
};

export const TONE_WASH: Record<Tone, string> = {
  neutral: "var(--tone-neutral-wash)",
  progress: "var(--tone-progress-wash)",
  review: "var(--tone-review-wash)",
  done: "var(--tone-done-wash)",
  blocked: "var(--tone-blocked-wash)",
  idea: "var(--tone-idea-wash)",
  info: "var(--tone-info-wash)",
};

export function ProgressGlyph({
  type,
  status,
  progress,
  size = 14,
  className,
}: {
  type: string;
  status: string;
  progress?: number;
  size?: number;
  className?: string;
}) {
  const meta = statusMeta(type, status);
  const color = TONE_VAR[meta.tone];
  const value = Math.max(0, Math.min(100, progress ?? meta.weight));

  const r = size / 2 - 1.25;
  const circumference = 2 * Math.PI * r;
  const done = meta.terminal && meta.weight === 100;
  const blocked = meta.tone === "blocked" && !meta.terminal;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        opacity={done ? 1 : 0.42}
      />
      {done ? (
        <>
          <circle cx={size / 2} cy={size / 2} r={r} fill={color} />
          <path
            d={`M${size * 0.3} ${size * 0.52} L${size * 0.44} ${size * 0.66} L${size * 0.72} ${size * 0.36}`}
            fill="none"
            stroke="var(--surface)"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : blocked ? (
        <rect
          x={size * 0.3}
          y={size / 2 - 0.9}
          width={size * 0.4}
          height={1.8}
          rx={0.9}
          fill={color}
        />
      ) : value > 0 ? (
        // Arco de progreso: empieza arriba y avanza en sentido horario.
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={r * 1.05}
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          opacity={0.9}
          style={{ transition: "stroke-dasharray 320ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      ) : null}
    </svg>
  );
}

/** Punto liso, para estados sin noción de avance (notas, decisiones). */
export function ToneDot({ tone, size = 6 }: { tone: Tone; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: TONE_VAR[tone] }}
      aria-hidden
    />
  );
}

/**
 * Prioridad. Sólo se dibuja cuando aporta: alta y urgente. Marcar cada tarea
 * "media" con un ícono equivale a no marcar nada.
 */
export function PriorityGlyph({
  priority,
  always = false,
  className,
}: {
  priority: string;
  always?: boolean;
  className?: string;
}) {
  const meta = PRIORITY_META[priority as Priority] ?? PRIORITY_META.medium;
  if (!always && meta.rank < 2) return null;

  const color =
    meta.rank === 3
      ? "var(--tone-blocked)"
      : meta.rank === 2
        ? "var(--tone-progress)"
        : "var(--ink-4)";

  return (
    <span
      className={cn("inline-flex items-end gap-[1.5px] h-3", className)}
      title={`Prioridad ${meta.label.toLowerCase()}`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2.5px] rounded-[1px] transition-colors"
          style={{
            height: `${4 + i * 3}px`,
            background: i < Math.max(1, meta.bars) ? color : "var(--line-strong)",
            opacity: i < Math.max(1, meta.bars) ? 1 : 0.7,
          }}
        />
      ))}
    </span>
  );
}

/** Barra de progreso fina. El número va al lado, nunca adentro. */
export function ProgressBar({
  value,
  tone = "done",
  className,
  height = 3,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-surface-3", className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: TONE_VAR[tone],
          transition: "width 420ms cubic-bezier(0.22,1,0.36,1)",
        }}
      />
    </div>
  );
}

/** Anillo de progreso para las tarjetas de proyecto. */
export function ProgressRing({
  value,
  size = 34,
  stroke = 2.5,
  color = "var(--accent)",
  showLabel = true,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  showLabel?: boolean;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
          style={{ transition: "stroke-dasharray 520ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      {showLabel && (
        <span className="absolute inset-0 grid place-items-center text-[9.5px] font-semibold tabular text-ink-2">
          {clamped}
        </span>
      )}
    </div>
  );
}

/**
 * Etiqueta de estado: punto + texto. Es lo que reemplaza a los badges de
 * colores. Sólo el punto lleva color; el texto se mantiene en tinta.
 */
export function StatusLabel({
  type,
  status,
  progress,
  className,
  withGlyph = true,
}: {
  type: string;
  status: string;
  progress?: number;
  className?: string;
  withGlyph?: boolean;
}) {
  const meta = statusMeta(type, status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-2", className)}>
      {withGlyph ? (
        <ProgressGlyph type={type} status={status} progress={progress} size={12} />
      ) : (
        <ToneDot tone={meta.tone} />
      )}
      {meta.label}
    </span>
  );
}
