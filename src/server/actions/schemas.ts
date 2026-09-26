import { z } from "zod";

import {
  ACCENTS,
  ASSIGNEE_SCOPES,
  ITEM_TYPES,
  PRIORITIES,
  PROPOSAL_STATUSES,
  RESOURCE_KINDS,
  WORKSPACE_ROLES,
} from "@/lib/domain";
import { MAX_DOC_LENGTH } from "@/lib/doc";
import { normalizeMarkdownSource } from "@/lib/resources";

/**
 * Zod schemas de las server actions, en un módulo aparte.
 *
 * Un archivo `"use server"` (los de `src/server/actions/*.ts`) solo puede
 * exportar funciones async: el compilador de Server Actions de Next rechaza
 * cualquier otro export (una constante, un schema de Zod) con "Server
 * Actions must be async functions". Por eso los schemas viven acá, sin esa
 * directiva, y cada action los importa (con su nombre de siempre, vía alias)
 * en vez de declararlos inline. Las tools de escritura de MCP
 * (`@/server/mcp/write-tools`) importan estos mismos schemas — su `.shape`
 * les sirve de `inputSchema` — así la validación nunca se duplica.
 */

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(value) : null))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), "Fecha inválida.");

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => value || null)
  .refine((value) => value === null || /^https?:\/\//i.test(value), "Usá una URL http o https.");

// -------------------------------------------------------------------- items

export const itemCreateSchema = z.object({
  projectId: z.string().min(1, "Elegí un proyecto."),
  type: z.enum(ITEM_TYPES),
  title: z.string().trim().min(1, "Escribí un título."),
  body: z.string().trim().max(20000).optional(),
  priority: z.enum(PRIORITIES).default("medium"),
  status: z.string().trim().optional(),
  dueDate: optionalDate,
  parentId: z.string().trim().optional(),
  assigneeIds: z.array(z.string()).default([]),
  assigneeScope: z.enum(ASSIGNEE_SCOPES).default("individual"),
});

export const itemUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  body: z.string().trim().max(20000).nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: optionalDate.optional(),
});

export const itemAssigneeSchema = z.object({
  scope: z.enum(ASSIGNEE_SCOPES).default("individual"),
  assignees: z
    .array(z.object({ userId: z.string(), weight: z.number().min(0).max(100).optional() }))
    .default([]),
});

// ----------------------------------------------------------------- projects

export const projectCreateSchema = z.object({
  name: z.string().trim().min(2, "El proyecto necesita un nombre."),
  description: z.string().trim().max(2000).optional(),
  parentId: z.string().trim().optional(),
  priority: z.enum(PRIORITIES).default("medium"),
  accent: z.enum(ACCENTS).optional(),
  startDate: optionalDate,
  targetDate: optionalDate,
  memberIds: z.array(z.string()).default([]),
  coverUrl: z.string().trim().optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  accent: z.enum(ACCENTS).optional(),
  startDate: optionalDate.optional(),
  targetDate: optionalDate.optional(),
  coverUrl: z.string().trim().nullable().optional(),
});

export const projectLinkSchema = z.object({
  url: z.string().trim().min(3, "Pegá una URL."),
  label: z.string().trim().max(80).optional(),
});

// ----------------------------------------------------------------- comments

export const commentSchema = z
  .object({
    body: z.string().trim().min(1, "Escribí algo.").max(8000),
    itemId: z.string().trim().optional(),
    projectId: z.string().trim().optional(),
    attachmentIds: z.array(z.string()).default([]),
  })
  .refine((v) => Boolean(v.itemId) !== Boolean(v.projectId), {
    message: "Un comentario va en un elemento o en un proyecto.",
  });

// ---------------------------------------------------------------- proposals

export const proposalCreateSchema = z.object({
  title: z.string().trim().min(4, "Contá la idea en un título un poco más claro.").max(160),
  body: z.string().trim().min(12, "Agregá un poco de contexto para poder evaluarla.").max(8000),
  category: z.enum(["project", "improvement", "need"]).default("project"),
  targetProjectId: z.string().trim().optional(),
});

export const proposalTriageSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES),
  targetProjectId: z.string().trim().nullable().optional(),
});

// ----------------------------------------------------------------- resources

export const resourceSchema = z
  .object({
    name: z.string().trim().min(2, "Poné un nombre al recurso.").max(120),
    summary: z.string().trim().max(500).optional(),
    kind: z.enum(RESOURCE_KINDS).default("link"),
    url: optionalUrl,
    accessGuide: z.string().trim().max(5000).optional(),
    markdown: z.string().trim().max(100000).optional(),
    markdownUrl: optionalUrl,
    projectId: z.string().trim().optional(),
  })
  .refine((value) => Boolean(value.url || value.accessGuide || value.markdown || value.markdownUrl), {
    message: "Agregá un enlace o instrucciones para usar el recurso.",
  })
  .refine((value) => !value.markdownUrl || Boolean(normalizeMarkdownSource(value.markdownUrl)), {
    message: "La guía remota debe ser un archivo de GitHub (github.com o raw.githubusercontent.com).",
  });

// ----------------------------------------------------------------------- doc

export const docSchema = z.object({
  markdown: z.string().max(MAX_DOC_LENGTH, "El documento superó los 100.000 caracteres."),
});

// ---------------------------------------------------------------------- team

export const teamSettingsSchema = z.object({
  name: z.string().trim().min(2, "El equipo necesita un nombre."),
  mission: z.string().trim().max(280).nullable().optional(),
});

export const teamMemberSchema = z.object({
  name: z.string().trim().min(2, "Escribí el nombre de la persona."),
  email: z
    .string()
    .trim()
    .min(1, "Escribí un email.")
    .email("Ese email no parece válido.")
    .transform((v) => v.toLowerCase()),
  role: z.enum(WORKSPACE_ROLES).default("community"),
  title: z.string().trim().max(60).optional(),
});

// ---------------------------------------------------------------------- auth

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Escribí tu nombre."),
  avatarUrl: z.string().trim().optional(),
});
