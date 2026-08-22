import "server-only";

import { db } from "@/server/db";
import { personSelect } from "@/server/domain/projects";
import type { SearchHit, SearchKind } from "@/lib/shared";

export { SEARCH_KIND_LABEL, type SearchHit, type SearchKind } from "@/lib/shared";

/**
 * Búsqueda global.
 *
 * Barre proyectos, contenido (los seis tipos), comentarios, personas y archivos
 * en paralelo y devuelve un resultado unificado y rankeado. En SQLite `contains`
 * compila a LIKE, que es insensible a mayúsculas para ASCII; el día que esto
 * corra sobre Postgres, cambiar a `to_tsvector` afecta solo a este archivo.
 */

const LIMIT_PER_KIND = 8;

/** Coincidencia al principio del título > coincidencia interna > cuerpo. */
function score(query: string, title: string, body?: string | null): number {
  const q = query.toLowerCase();
  const t = title.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  if (body?.toLowerCase().includes(q)) return 30;
  return 10;
}

function excerpt(text: string | null, query: string, radius = 70): string | null {
  if (!text) return null;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export async function search(
  workspaceId: string,
  slug: string,
  rawQuery: string,
  options: { kinds?: SearchKind[]; limit?: number } = {},
): Promise<SearchHit[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const wants = (kind: SearchKind) => !options.kinds || options.kinds.includes(kind);

  const [projects, items, comments, people, files] = await Promise.all([
    wants("project")
      ? db.project.findMany({
          where: {
            workspaceId,
            OR: [{ name: { contains: query } }, { description: { contains: query } }],
          },
          select: {
            id: true,
            name: true,
            description: true,
            accent: true,
            status: true,
            updatedAt: true,
            archivedAt: true,
          },
          take: LIMIT_PER_KIND,
        })
      : Promise.resolve([]),

    db.item.findMany({
      where: {
        workspaceId,
        OR: [{ title: { contains: query } }, { body: { contains: query } }],
      },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        status: true,
        updatedAt: true,
        projectId: true,
        project: { select: { name: true, accent: true } },
      },
      take: LIMIT_PER_KIND * 4,
      orderBy: { updatedAt: "desc" },
    }),

    wants("comment")
      ? db.comment.findMany({
          where: { workspaceId, body: { contains: query } },
          select: {
            id: true,
            body: true,
            createdAt: true,
            itemId: true,
            projectId: true,
            author: { select: personSelect },
            item: { select: { id: true, title: true, projectId: true } },
            project: { select: { id: true, name: true, accent: true } },
          },
          take: LIMIT_PER_KIND,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),

    wants("person")
      ? db.membership.findMany({
          where: {
            workspaceId,
            user: { OR: [{ name: { contains: query } }, { email: { contains: query } }] },
          },
          select: { role: true, user: { select: { ...personSelect, email: true } } },
          take: LIMIT_PER_KIND,
        })
      : Promise.resolve([]),

    wants("file")
      ? db.attachment.findMany({
          where: { workspaceId, filename: { contains: query } },
          select: {
            id: true,
            filename: true,
            kind: true,
            createdAt: true,
            storageKey: true,
            projectId: true,
            itemId: true,
            project: { select: { id: true, name: true, accent: true } },
            item: { select: { id: true, projectId: true } },
          },
          take: LIMIT_PER_KIND,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const hits: SearchHit[] = [];

  for (const p of projects) {
    hits.push({
      id: p.id,
      kind: "project",
      title: p.name,
      excerpt: excerpt(p.description, query),
      href: `/w/${slug}/p/${p.id}`,
      projectName: null,
      accent: p.accent,
      status: p.archivedAt ? "archived" : p.status,
      when: p.updatedAt,
      score: score(query, p.name, p.description) + 15,
    });
  }

  for (const item of items) {
    if (!wants(item.type as SearchKind)) continue;
    hits.push({
      id: item.id,
      kind: item.type as SearchKind,
      title: item.title,
      excerpt: excerpt(item.body, query),
      href: `/w/${slug}/p/${item.projectId}?item=${item.id}`,
      projectName: item.project.name,
      accent: item.project.accent,
      status: item.status,
      when: item.updatedAt,
      score: score(query, item.title, item.body),
    });
  }

  for (const comment of comments) {
    const projectId = comment.item?.projectId ?? comment.projectId;
    hits.push({
      id: comment.id,
      kind: "comment",
      title: comment.item ? `Comentario en “${comment.item.title}”` : "Comentario en el proyecto",
      excerpt: excerpt(comment.body, query),
      href: comment.item
        ? `/w/${slug}/p/${projectId}?item=${comment.item.id}`
        : `/w/${slug}/p/${projectId}`,
      projectName: comment.project?.name ?? null,
      accent: comment.project?.accent ?? "stone",
      status: null,
      when: comment.createdAt,
      score: score(query, comment.body) - 10,
      person: comment.author,
    });
  }

  for (const member of people) {
    hits.push({
      id: member.user.id,
      kind: "person",
      title: member.user.name,
      excerpt: member.user.email,
      href: `/w/${slug}/gente/${member.user.id}`,
      projectName: null,
      accent: member.user.accentColor,
      status: member.role,
      when: new Date(),
      score: score(query, member.user.name, member.user.email) + 5,
      person: member.user,
    });
  }

  for (const file of files) {
    const projectId = file.item?.projectId ?? file.projectId;
    hits.push({
      id: file.id,
      kind: "file",
      title: file.filename,
      excerpt: null,
      href: file.itemId
        ? `/w/${slug}/p/${projectId}?item=${file.itemId}`
        : `/w/${slug}/p/${projectId}/files`,
      projectName: file.project?.name ?? null,
      accent: file.project?.accent ?? "stone",
      status: file.kind,
      when: file.createdAt,
      score: score(query, file.filename) - 5,
    });
  }

  return hits
    .sort((a, b) => b.score - a.score || b.when.getTime() - a.when.getTime())
    .slice(0, options.limit ?? 30);
}
