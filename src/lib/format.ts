import { es } from "date-fns/locale";
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isThisYear,
  isToday,
  isYesterday,
  startOfDay,
} from "date-fns";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "hace 3 h" — compacto, para timelines densos. */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = (Date.now() - d.getTime()) / 1000;
  if (seconds < 60) return "recien";
  return `hace ${formatDistanceToNowStrict(d, { locale: es })}`;
}

/** Encabezado de grupo en historiales: "Hoy", "Ayer", "18 de agosto". */
export function dayHeading(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isToday(d)) return "Hoy";
  if (isYesterday(d)) return "Ayer";
  if (isThisYear(d)) return format(d, "d 'de' MMMM", { locale: es });
  return format(d, "d 'de' MMMM yyyy", { locale: es });
}

export function dayKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(startOfDay(d), "yyyy-MM-dd");
}

export function shortDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return isThisYear(d)
    ? format(d, "d MMM", { locale: es })
    : format(d, "d MMM yy", { locale: es });
}

export function longDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: es });
}

export function timeOfDay(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "HH:mm");
}

export type DueState = "overdue" | "today" | "soon" | "later" | "none";

/** Estado de una fecha limite: define color y urgencia en la UI. */
export function dueState(
  due: Date | string | null | undefined,
  completed = false,
): { state: DueState; label: string; days: number } {
  if (!due) return { state: "none", label: "", days: 0 };
  const d = typeof due === "string" ? new Date(due) : due;
  const days = differenceInCalendarDays(d, new Date());
  if (completed) return { state: "later", label: shortDate(d), days };
  if (days < 0)
    return {
      state: "overdue",
      label: days === -1 ? "Venció ayer" : `Venció hace ${Math.abs(days)} d`,
      days,
    };
  if (days === 0) return { state: "today", label: "Vence hoy", days };
  if (days === 1) return { state: "soon", label: "Mañana", days };
  if (days <= 7) return { state: "soon", label: `En ${days} días`, days };
  return { state: "later", label: shortDate(d), days };
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Lista legible: "Ezequiel, Juan y Valentina". */
export function joinNames(names: string[], max = 3): string {
  if (names.length === 0) return "";
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  let text =
    shown.length === 1
      ? shown[0]
      : `${shown.slice(0, -1).join(", ")} y ${shown[shown.length - 1]}`;
  if (rest > 0) text += ` +${rest}`;
  return text;
}
