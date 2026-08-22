/**
 * Los recursos de un proyecto son links libres: el usuario pega una URL y el
 * sistema deduce de que se trata en vez de obligarlo a llenar campos rigidos.
 */

export const LINK_KINDS = [
  "github",
  "figma",
  "drive",
  "docs",
  "design",
  "site",
  "board",
  "chat",
  "link",
] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  github: "Repositorio",
  figma: "Diseño",
  drive: "Drive",
  docs: "Documentación",
  design: "Diseño",
  site: "Sitio",
  board: "Tablero",
  chat: "Chat",
  link: "Link",
};

const PATTERNS: Array<{ kind: LinkKind; test: RegExp }> = [
  { kind: "github", test: /(github\.com|gitlab\.com|bitbucket\.org)/i },
  { kind: "figma", test: /(figma\.com|sketch\.com)/i },
  { kind: "drive", test: /(drive\.google\.com|dropbox\.com|onedrive)/i },
  { kind: "docs", test: /(docs\.google\.com|notion\.so|readme\.io|confluence)/i },
  { kind: "design", test: /(dribbble\.com|behance\.net|framer\.com)/i },
  { kind: "board", test: /(linear\.app|jira|trello\.com|asana\.com)/i },
  { kind: "chat", test: /(slack\.com|discord\.(gg|com))/i },
];

export function detectLinkKind(url: string): LinkKind {
  for (const { kind, test } of PATTERNS) if (test.test(url)) return kind;
  return /^https?:\/\//i.test(url) ? "site" : "link";
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

/** Etiqueta por defecto cuando el usuario solo pega una URL. */
export function suggestLabel(url: string): string {
  try {
    const u = new URL(url);
    const kind = detectLinkKind(url);
    if (kind === "github") {
      const segments = u.pathname.split("/").filter(Boolean);
      if (segments.length >= 2) return `${segments[0]}/${segments[1]}`;
    }
    if (kind !== "site" && kind !== "link") return LINK_KIND_LABEL[kind];
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}
