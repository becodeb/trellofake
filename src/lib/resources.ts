import { RESOURCE_KIND_LABEL, type ResourceKind } from "@/lib/domain";

/**
 * Recursos: una URL con nombre y tipo.
 *
 * El usuario pega una URL y el sistema deduce de qué se trata en vez de
 * obligarlo a llenar campos rígidos (esta lógica vivía en `src/lib/links.ts`,
 * separada de `KnowledgeResource` porque hasta la migración 0004 eran dos
 * modelos distintos; unificados, el detector de tipo también se unifica acá).
 */

const PATTERNS: Array<{ kind: ResourceKind; test: RegExp }> = [
  { kind: "repository", test: /(github\.com|gitlab\.com|bitbucket\.org)/i },
  { kind: "design", test: /(figma\.com|sketch\.com|dribbble\.com|behance\.net|framer\.com)/i },
  {
    kind: "document",
    test: /(drive\.google\.com|dropbox\.com|onedrive|docs\.google\.com|notion\.so|readme\.io|confluence)/i,
  },
  { kind: "service", test: /(linear\.app|jira|trello\.com|asana\.com|slack\.com|discord\.(gg|com))/i },
];

const LOCAL_HOSTNAME = /^(localhost|127(\.\d{1,3}){3}|\[?::1\]?)$/i;
const LOCAL_TLD = /\.local$/i;

/** RFC 1918: 10/8, 172.16/12, 192.168/16. Lo que corre en la red del equipo. */
function isPrivateLan(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTNAME.test(hostname) || LOCAL_TLD.test(hostname) || isPrivateLan(hostname);
}

/** Tipo de recurso a partir de la URL. Editable después: es solo un valor inicial. */
export function detectResourceKind(url: string): ResourceKind {
  for (const { kind, test } of PATTERNS) if (test.test(url)) return kind;
  try {
    const { hostname } = new URL(url);
    if (isLocalHost(hostname)) return "local";
  } catch {
    // URL sin protocolo o inválida: cae al fallback de abajo.
  }
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

/** Nombre por defecto cuando el usuario solo pega una URL. */
export function suggestResourceName(url: string): string {
  try {
    const u = new URL(url);
    const kind = detectResourceKind(url);
    if (kind === "repository") {
      const segments = u.pathname.split("/").filter(Boolean);
      if (segments.length >= 2) return `${segments[0]}/${segments[1]}`;
    }
    if (kind === "local") return `${u.hostname}${u.port ? `:${u.port}` : ""}`;
    if (kind !== "site" && kind !== "link") return RESOURCE_KIND_LABEL[kind];
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "Recurso";
  }
}

// -------------------------------------------------------- guías remotas

export function normalizeMarkdownSource(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "raw.githubusercontent.com") return url.toString();
    if (url.hostname === "github.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      const blob = parts.indexOf("blob");
      if (blob === 2 && parts.length > 4) {
        return `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts.slice(3).join("/")}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function readRemoteMarkdown(source: string): Promise<string | null> {
  const url = normalizeMarkdownSource(source);
  if (!url) return null;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 300 },
      headers: { Accept: "text/plain" },
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text.slice(0, 100000);
  } catch {
    return null;
  }
}
