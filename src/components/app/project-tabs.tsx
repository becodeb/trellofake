"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

/** Pestañas del proyecto. El número al lado dice si vale la pena entrar. */
export function ProjectTabs({
  slug,
  projectId,
  counts,
}: {
  slug: string;
  projectId: string;
  counts: { tasks: number; children: number; files: number };
}) {
  const pathname = usePathname();
  const base = `/w/${slug}/p/${projectId}`;

  const tabs = [
    { href: base, label: "Resumen", exact: true },
    { href: `${base}/tareas`, label: "Tareas", count: counts.tasks },
    { href: `${base}/espacio`, label: "Espacio" },
    { href: `${base}/historial`, label: "Historial" },
    { href: `${base}/archivos`, label: "Archivos", count: counts.files },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-line pb-px">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-accent font-medium text-ink"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-2xs tabular text-ink-4">{tab.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
