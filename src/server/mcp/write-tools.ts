import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { ctx, toWire, ALL_STATUSES } from "@/server/mcp/tools";
import { MAX_UPLOAD_BYTES } from "@/server/storage";
import { MIN_ZOOM, MAX_ZOOM } from "@/lib/cover";
import { PROJECT_STATUSES, WORKSPACE_ROLES } from "@/lib/domain";
import type { ActionResult } from "@/server/actions/shared";

import {
  createItem,
  updateItem,
  setItemStatus,
  setItemProgress,
  setAssignees,
  convertToTask,
  moveItem,
  deleteItem,
  recomputeProject,
  createSchema as createItemSchema,
  updateSchema as updateItemSchema,
  assigneeSchema as setAssigneesSchema,
} from "@/server/actions/items";
import {
  createProject,
  updateProject,
  setProjectStatus,
  restoreProject,
  setProjectProgress,
  setProjectCover,
  setProjectMembers,
  addLink,
  removeLink,
  deleteProject,
  createSchema as createProjectSchema,
  updateSchema as updateProjectSchema,
  linkSchema as addLinkSchema,
} from "@/server/actions/projects";
import {
  addComment,
  editComment,
  deleteComment,
  schema as addCommentSchema,
} from "@/server/actions/comments";
import {
  createProposal,
  replyToProposal,
  triageProposal,
  promoteProposal,
  createSchema as createProposalSchema,
  triageSchema as triageProposalSchema,
} from "@/server/actions/proposals";
import {
  createResource,
  deleteResource,
  schema as createResourceSchema,
} from "@/server/actions/resources";
import {
  saveProjectDoc,
  previewProjectDoc,
  docSchema,
} from "@/server/actions/doc";
import { uploadFiles, uploadCover, deleteAttachment } from "@/server/actions/files";
import {
  updateTeam,
  addMember,
  setMemberRole,
  removeMember,
  markRead,
  settingsSchema as updateTeamSchema,
  memberSchema as addMemberSchema,
} from "@/server/actions/team";
import { updateProfile } from "@/server/actions/auth";

/**
 * Tools de escritura `hilo_*` (mcp-write-tools).
 *
 * Cada tool es un traductor delgado: valida forma con Zod (reusando, cuando
 * existe, el `.shape` del schema que ya usa la server action — Zod v4 expone
 * `.shape` incluso a través de `.refine()`), arma los argumentos posicionales
 * que la action espera y traduce su `ActionResult` a un resultado MCP. Nunca
 * duplica una capacidad ni una regla de negocio: eso vive únicamente en
 * `requireTeamAction()` y en la action misma. El actor (usuario del token) lo
 * resuelve `getCurrentUser()` vía `@/server/auth/actor`, corriendo la ruta
 * dentro de `actorStore.run(...)` — no hace falta pasarlo acá.
 *
 * Excluidas a propósito (nunca se registran tools para esto): signup, login,
 * logout, changePassword y la creación/revocación de tokens de API (un token
 * no puede acuñar tokens), y `touchVisit` (ping de presencia sin valor para
 * un cliente MCP).
 */

/** Traduce un `ActionResult` a un resultado de tool MCP. */
function fromActionResult<T>(result: ActionResult<T>) {
  if (result.ok) return { content: [{ type: "text" as const, text: JSON.stringify(toWire(result.data ?? null)) }] };
  return { content: [{ type: "text" as const, text: result.error }], isError: true as const };
}

/** Para el puñado de funciones que no siguen el contrato `ActionResult` (tiran en vez de devolver `{ok:false}`). */
function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : "Algo salió mal.";
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

const base64FileSchema = z.object({
  filename: z.string().trim().min(1, "El archivo necesita un nombre."),
  mimeType: z.string().trim().min(1, "El archivo necesita un tipo MIME."),
  base64: z.string().min(1, "El archivo llegó vacío."),
});

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Decodifica un archivo `{filename, mimeType, base64}` a un `File` real.
 * Rechaza base64 inválido y capa el tamaño decodificado al límite de
 * almacenamiento (10 MB) antes de construir el buffer definitivo.
 */
function decodeBase64File(input: { filename: string; mimeType: string; base64: string }): File {
  const clean = input.base64.replace(/\s+/g, "");
  if (clean.length === 0 || clean.length % 4 !== 0 || !BASE64_RE.test(clean)) {
    throw new Error(`El archivo "${input.filename}" no es base64 válido.`);
  }
  const buffer = Buffer.from(clean, "base64");
  if (buffer.length === 0) {
    throw new Error(`El archivo "${input.filename}" no es base64 válido.`);
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`El archivo "${input.filename}" supera los 10 MB una vez decodificado.`);
  }
  return new File([buffer], input.filename, { type: input.mimeType || "application/octet-stream" });
}

export function registerWriteTools(server: McpServer) {
  // ------------------------------------------------------------------ items

  server.registerTool(
    "hilo_create_item",
    {
      description: "Crea un elemento (task, idea, note, problem, decision o update) en un proyecto.",
      inputSchema: createItemSchema.shape,
    },
    async (args) => {
      ctx();
      return fromActionResult(await createItem(args));
    },
  );

  server.registerTool(
    "hilo_update_item",
    {
      description: "Actualiza título, cuerpo, prioridad o fecha límite de un elemento.",
      inputSchema: { itemId: z.string().min(1), ...updateItemSchema.shape },
    },
    async (args) => {
      ctx();
      const { itemId, ...raw } = args;
      return fromActionResult(await updateItem(itemId, raw));
    },
  );

  server.registerTool(
    "hilo_set_item_status",
    {
      description: "Cambia el estado de un elemento (todo, doing, done, etc. según su tipo).",
      inputSchema: { itemId: z.string().min(1), status: z.enum(ALL_STATUSES) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await setItemStatus(args.itemId, args.status));
    },
  );

  server.registerTool(
    "hilo_set_item_progress",
    {
      description: "Fija el avance (0-100) de un elemento en modo manual, o lo vuelve a automático.",
      inputSchema: {
        itemId: z.string().min(1),
        progress: z.number().min(0).max(100),
        mode: z.enum(["auto", "manual"]),
      },
    },
    async (args) => {
      ctx();
      return fromActionResult(await setItemProgress(args.itemId, args.progress, args.mode));
    },
  );

  server.registerTool(
    "hilo_set_item_assignees",
    {
      description: "Asigna personas (o todo el equipo) a un elemento, con reparto de pesos.",
      inputSchema: { itemId: z.string().min(1), ...setAssigneesSchema.shape },
    },
    async (args) => {
      ctx();
      const { itemId, ...raw } = args;
      return fromActionResult(await setAssignees(itemId, raw));
    },
  );

  server.registerTool(
    "hilo_convert_item_to_task",
    {
      description: "Convierte una idea en tarea, conservando de dónde salió.",
      inputSchema: { itemId: z.string().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await convertToTask(args.itemId));
    },
  );

  server.registerTool(
    "hilo_move_item",
    {
      description: "Reordena un elemento y, si cambia de columna, actualiza su estado.",
      inputSchema: {
        itemId: z.string().min(1),
        status: z.string().trim().optional(),
        position: z.number().int(),
      },
    },
    async (args) => {
      ctx();
      return fromActionResult(
        await moveItem(args.itemId, { status: args.status, position: args.position }),
      );
    },
  );

  server.registerTool(
    "hilo_delete_item",
    {
      description: "Borra un elemento.",
      inputSchema: { itemId: z.string().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await deleteItem(args.itemId));
    },
  );

  server.registerTool(
    "hilo_recompute_project",
    {
      description:
        "Recalcula desde cero el progreso de un proyecto y de todos sus elementos (mantenimiento).",
      inputSchema: { projectId: z.string().min(1) },
    },
    async (args) => {
      ctx();
      // recomputeProject no sigue el contrato ActionResult: lanza en vez de
      // devolver {ok:false}, así que se atrapa acá igual que hace `run()`.
      try {
        await recomputeProject(args.projectId);
        return { content: [{ type: "text" as const, text: "null" }] };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // --------------------------------------------------------------- projects

  server.registerTool(
    "hilo_create_project",
    {
      description: "Crea un proyecto o subproyecto.",
      inputSchema: createProjectSchema.shape,
    },
    async (args) => {
      ctx();
      return fromActionResult(await createProject(args));
    },
  );

  server.registerTool(
    "hilo_update_project",
    {
      description: "Actualiza nombre, descripción, prioridad, acento o fechas de un proyecto.",
      inputSchema: { projectId: z.string().min(1), ...updateProjectSchema.shape },
    },
    async (args) => {
      ctx();
      const { projectId, ...raw } = args;
      return fromActionResult(await updateProject(projectId, raw));
    },
  );

  server.registerTool(
    "hilo_set_project_status",
    {
      description: "Cambia el estado de un proyecto. Pasar a done/cancelled lo archiva.",
      inputSchema: { projectId: z.string().min(1), status: z.enum(PROJECT_STATUSES) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await setProjectStatus(args.projectId, args.status));
    },
  );

  server.registerTool(
    "hilo_restore_project",
    {
      description: "Retoma un proyecto archivado: vuelve al tablero activo sin perder nada.",
      inputSchema: { projectId: z.string().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await restoreProject(args.projectId));
    },
  );

  server.registerTool(
    "hilo_set_project_progress",
    {
      description: "Fija el avance (0-100) de un proyecto en modo manual, o lo vuelve a automático.",
      inputSchema: {
        projectId: z.string().min(1),
        progress: z.number().min(0).max(100),
        mode: z.enum(["auto", "manual"]),
      },
    },
    async (args) => {
      ctx();
      return fromActionResult(await setProjectProgress(args.projectId, args.progress, args.mode));
    },
  );

  server.registerTool(
    "hilo_set_project_cover_framing",
    {
      description: "Acomoda el encuadre (posición y zoom) de la portada ya subida de un proyecto.",
      inputSchema: {
        projectId: z.string().min(1),
        coverX: z.number().min(0).max(100),
        coverY: z.number().min(0).max(100),
        coverZoom: z.number().min(MIN_ZOOM).max(MAX_ZOOM),
      },
    },
    async (args) => {
      ctx();
      return fromActionResult(
        await setProjectCover(args.projectId, {
          coverX: args.coverX,
          coverY: args.coverY,
          coverZoom: args.coverZoom,
        }),
      );
    },
  );

  server.registerTool(
    "hilo_set_project_members",
    {
      description: "Reemplaza la lista de miembros de un proyecto.",
      inputSchema: { projectId: z.string().min(1), userIds: z.array(z.string()) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await setProjectMembers(args.projectId, args.userIds));
    },
  );

  server.registerTool(
    "hilo_add_project_link",
    {
      description: "Agrega un enlace (sitio, repo, etc.) a un proyecto.",
      inputSchema: { projectId: z.string().min(1), ...addLinkSchema.shape },
    },
    async (args) => {
      ctx();
      const { projectId, ...raw } = args;
      return fromActionResult(await addLink(projectId, raw));
    },
  );

  server.registerTool(
    "hilo_remove_project_link",
    {
      description: "Quita un enlace de un proyecto.",
      inputSchema: { projectId: z.string().min(1), linkId: z.string().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await removeLink(args.projectId, args.linkId));
    },
  );

  server.registerTool(
    "hilo_delete_project",
    {
      description: "Borra un proyecto de verdad (no lo archiva). Reservado a quien administra el equipo.",
      inputSchema: { projectId: z.string().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await deleteProject(args.projectId));
    },
  );

  // --------------------------------------------------------------- comments

  server.registerTool(
    "hilo_add_comment",
    {
      description: "Agrega un comentario a un elemento o a la conversación general de un proyecto.",
      inputSchema: addCommentSchema.shape,
    },
    async (args) => {
      ctx();
      return fromActionResult(await addComment(args));
    },
  );

  server.registerTool(
    "hilo_edit_comment",
    {
      description: "Edita el cuerpo de un comentario propio.",
      inputSchema: { commentId: z.string().min(1), body: z.string().trim().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await editComment(args.commentId, args.body));
    },
  );

  server.registerTool(
    "hilo_delete_comment",
    {
      description: "Borra un comentario propio (o cualquiera, si el rol administra el equipo).",
      inputSchema: { commentId: z.string().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await deleteComment(args.commentId));
    },
  );

  // -------------------------------------------------------------- proposals

  server.registerTool(
    "hilo_create_proposal",
    {
      description: "Crea una propuesta de la comunidad (proyecto nuevo, mejora o necesidad).",
      inputSchema: createProposalSchema.shape,
    },
    async (args) => {
      ctx();
      return fromActionResult(await createProposal(args));
    },
  );

  server.registerTool(
    "hilo_reply_to_proposal",
    {
      description: "Responde a una propuesta.",
      inputSchema: { proposalId: z.string().min(1), body: z.string().trim().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await replyToProposal(args.proposalId, args.body));
    },
  );

  server.registerTool(
    "hilo_triage_proposal",
    {
      description: "Cambia el estado de una propuesta y, opcionalmente, el proyecto destino.",
      inputSchema: { proposalId: z.string().min(1), ...triageProposalSchema.shape },
    },
    async (args) => {
      ctx();
      const { proposalId, ...raw } = args;
      return fromActionResult(await triageProposal(proposalId, raw));
    },
  );

  server.registerTool(
    "hilo_promote_proposal",
    {
      description: "Promueve una propuesta aceptada a un proyecto nuevo.",
      inputSchema: { proposalId: z.string().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await promoteProposal(args.proposalId));
    },
  );

  // -------------------------------------------------------------- resources

  server.registerTool(
    "hilo_create_resource",
    {
      description: "Agrega un recurso de conocimiento (base de datos, API, repo, guía de acceso...).",
      inputSchema: createResourceSchema.shape,
    },
    async (args) => {
      ctx();
      return fromActionResult(await createResource(args));
    },
  );

  server.registerTool(
    "hilo_delete_resource",
    {
      description: "Borra un recurso de conocimiento.",
      inputSchema: { resourceId: z.string().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await deleteResource(args.resourceId));
    },
  );

  // -------------------------------------------------------------------- doc

  server.registerTool(
    "hilo_save_project_doc",
    {
      description: "Guarda (o, si queda vacío, borra) el léeme en Markdown de un proyecto.",
      inputSchema: { projectId: z.string().min(1), markdown: docSchema.shape.markdown },
    },
    async (args) => {
      ctx();
      return fromActionResult(await saveProjectDoc(args.projectId, args.markdown));
    },
  );

  server.registerTool(
    "hilo_preview_project_doc",
    {
      description: "Renderiza un Markdown de léeme con el mismo pipeline que la página publicada, sin guardarlo.",
      inputSchema: { markdown: docSchema.shape.markdown },
    },
    async (args) => {
      ctx();
      return fromActionResult(await previewProjectDoc(args.markdown));
    },
  );

  // ------------------------------------------------------------------ files

  server.registerTool(
    "hilo_upload_files",
    {
      description:
        "Sube hasta 10 archivos (imágenes u otros) codificados en base64 y los asocia a un proyecto y/o elemento.",
      inputSchema: {
        projectId: z.string().trim().optional(),
        itemId: z.string().trim().optional(),
        files: z.array(base64FileSchema).min(1).max(10),
      },
    },
    async (args) => {
      ctx();
      let formData: FormData;
      try {
        formData = new FormData();
        if (args.projectId) formData.set("projectId", args.projectId);
        if (args.itemId) formData.set("itemId", args.itemId);
        for (const file of args.files) formData.append("files", decodeBase64File(file));
      } catch (error) {
        return errorResult(error);
      }
      return fromActionResult(await uploadFiles(formData));
    },
  );

  server.registerTool(
    "hilo_upload_project_cover",
    {
      description: "Sube una imagen codificada en base64 y la deja como portada de un proyecto.",
      inputSchema: { projectId: z.string().min(1), file: base64FileSchema },
    },
    async (args) => {
      ctx();
      let formData: FormData;
      try {
        formData = new FormData();
        formData.set("file", decodeBase64File(args.file));
      } catch (error) {
        return errorResult(error);
      }
      return fromActionResult(await uploadCover(args.projectId, formData));
    },
  );

  server.registerTool(
    "hilo_delete_attachment",
    {
      description: "Borra un archivo adjunto propio (o cualquiera, si el rol administra el equipo).",
      inputSchema: { attachmentId: z.string().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await deleteAttachment(args.attachmentId));
    },
  );

  // ------------------------------------------------------------------- team

  server.registerTool(
    "hilo_update_team",
    {
      description: "Actualiza el nombre y la misión del equipo.",
      inputSchema: updateTeamSchema.shape,
    },
    async (args) => {
      ctx();
      return fromActionResult(await updateTeam(args));
    },
  );

  server.registerTool(
    "hilo_add_member",
    {
      description:
        "Da de alta a una persona en el equipo. Si el email no tiene cuenta, se crea con contraseña temporal.",
      inputSchema: addMemberSchema.shape,
    },
    async (args) => {
      ctx();
      return fromActionResult(await addMember(args));
    },
  );

  server.registerTool(
    "hilo_set_member_role",
    {
      description: "Cambia el rol de una persona del equipo (siempre debe quedar al menos un admin).",
      inputSchema: { userId: z.string().min(1), role: z.enum(WORKSPACE_ROLES) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await setMemberRole(args.userId, args.role));
    },
  );

  server.registerTool(
    "hilo_remove_member",
    {
      description: "Saca a una persona del equipo (no se puede sacar a una misma, ni al último admin).",
      inputSchema: { userId: z.string().min(1) },
    },
    async (args) => {
      ctx();
      return fromActionResult(await removeMember(args.userId));
    },
  );

  server.registerTool(
    "hilo_mark_read",
    {
      description:
        "Marca novedades como leídas: una entrada puntual, o todo el feed (y mueve la línea de última visita) si no se indica ninguna.",
      inputSchema: { entryId: z.string().trim().optional() },
    },
    async (args) => {
      ctx();
      return fromActionResult(await markRead(args.entryId));
    },
  );

  // ------------------------------------------------------------------- auth

  server.registerTool(
    "hilo_update_profile",
    {
      description: "Actualiza el nombre y la URL de avatar del usuario del token.",
      inputSchema: { name: z.string().trim().min(2), avatarUrl: z.string().trim().optional() },
    },
    async (args) => {
      ctx();
      const formData = new FormData();
      formData.set("name", args.name);
      if (args.avatarUrl) formData.set("avatarUrl", args.avatarUrl);
      return fromActionResult(await updateProfile(formData));
    },
  );
}
