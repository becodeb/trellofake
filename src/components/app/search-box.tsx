"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/** Caja de búsqueda de la página de resultados: navega, no consulta en vivo. */
export function SearchBox({ slug, initial }: { slug: string; initial: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);

  React.useEffect(() => setValue(initial), [initial]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        router.push(q ? `/w/${slug}/buscar?q=${encodeURIComponent(q)}` : `/w/${slug}/buscar`);
      }}
      className="flex items-center gap-2.5 rounded-[var(--r-md)] border border-line bg-surface px-3 transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-wash)]"
    >
      <Search className="size-4 shrink-0 text-ink-4" strokeWidth={2} />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoFocus
        placeholder="Buscar en todo el workspace…"
        className="h-10 flex-1 bg-transparent text-md text-ink placeholder:text-ink-4 focus:outline-none"
      />
    </form>
  );
}
