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
