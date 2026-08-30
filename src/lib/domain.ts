/**
 * Vocabulario del producto.
 *
 * Toda la app (schema, dominio de servidor y UI) habla de estados, tipos y
 * prioridades a traves de este archivo. Agregar un estado nuevo o un tipo de
 * contenido nuevo se hace aca y se propaga solo, sin migraciones ni cambios
 * dispersos por la interfaz.
 */

// ---------------------------------------------------------------- roles

export const WORKSPACE_ROLES = ["admin", "developer", "community"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  developer: "Desarrollador",
  community: "Comunidad",
  member: "Desarrollador",
};

/**
 * Capacidades por rol. La UI y las server actions preguntan por capacidad, no
 * por rol, de modo que sumar un rol intermedio (ej. "manager") mas adelante no
 * obliga a tocar cada pantalla.
 */
export const CAPABILITIES = [
  "workspace.manage",
  "member.manage",
  "project.create",
  "project.manage",
  "project.archive",
  "content.write",
  "comment.write",
  "proposal.manage",
  "resource.manage",
  "api-tokens.create",
  "api-tokens.revoke",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<WorkspaceRole, readonly Capability[]> = {
  admin: CAPABILITIES,
  developer: [
    "project.create",
    "project.manage",
    "project.archive",
    "content.write",
    "comment.write",
    "proposal.manage",
    "resource.manage",
  ],
  community: ["comment.write"],
};

export function roleCan(role: string, capability: Capability): boolean {
  // Compatibilidad con bases creadas antes de separar equipo y comunidad.
  if (role === "member") role = "developer";
  const caps = ROLE_CAPABILITIES[role as WorkspaceRole];
  return caps ? caps.includes(capability) : false;
}

export function isTeamRole(role: string): boolean {
  return role === "admin" || role === "developer" || role === "member";
}

export const PROPOSAL_STATUSES = [
  "proposed",
  "reviewing",
  "accepted",
  "planned",
  "declined",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  proposed: "Nueva",
  reviewing: "En conversación",
  accepted: "Aceptada",
  planned: "Llevada a proyecto",
  declined: "No se hará por ahora",
};

export const RESOURCE_KINDS = [
  "database",
  "api",
  "repository",
  "design",
  "document",
  "service",
  "link",
] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  database: "Base de datos",
  api: "API / integración",
  repository: "Repositorio",
  design: "Diseños",
  document: "Documentación",
  service: "Servicio",
  link: "Enlace",
};

export const PROJECT_ROLES = ["lead", "contributor"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];
export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  lead: "Responsable",
  contributor: "Colabora",
};

// ---------------------------------------------------------- prioridades

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<
  Priority,
  { label: string; short: string; rank: number; bars: number }
> = {
  urgent: { label: "Urgente", short: "Urg", rank: 3, bars: 3 },
  high: { label: "Alta", short: "Alta", rank: 2, bars: 2 },
  medium: { label: "Media", short: "Media", rank: 1, bars: 1 },
  low: { label: "Baja", short: "Baja", rank: 0, bars: 0 },
};

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

// ------------------------------------------------------ tipos de contenido

export const ITEM_TYPES = [
  "task",
  "idea",
  "note",
  "problem",
  "decision",
  "update",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export type ItemTypeMeta = {
  label: string;
  plural: string;
  /** Frase que explica para que sirve, usada en menus y estados vacios. */
  hint: string;
  /** Verbo de creacion, para botones. */
  action: string;
  defaultStatus: string;
  /** Solo las tareas participan del calculo de progreso y asignaciones. */
  schedulable: boolean;
};

export const ITEM_TYPE_META: Record<ItemType, ItemTypeMeta> = {
  task: {
    label: "Tarea",
    plural: "Tareas",
    hint: "Algo que hay que hacer",
    action: "Nueva tarea",
    defaultStatus: "todo",
    schedulable: true,
  },
  idea: {
    label: "Idea",
    plural: "Ideas",
    hint: "Una propuesta que todavía no es trabajo",
    action: "Nueva idea",
    defaultStatus: "proposed",
    schedulable: false,
  },
  note: {
    label: "Nota",
    plural: "Notas",
    hint: "Información que conviene conservar",
    action: "Nueva nota",
    defaultStatus: "recorded",
    schedulable: false,
  },
  problem: {
    label: "Problema",
    plural: "Problemas",
    hint: "Un bloqueo o una dificultad",
    action: "Nuevo problema",
    defaultStatus: "open",
    schedulable: false,
  },
  decision: {
    label: "Decisión",
    plural: "Decisiones",
    hint: "Algo que el equipo decidió y conviene recordar",
    action: "Nueva decisión",
    defaultStatus: "decided",
    schedulable: false,
  },
  update: {
    label: "Actualización",
    plural: "Actualizaciones",
    hint: "Esto hice hoy",
    action: "Publicar avance",
    defaultStatus: "posted",
    schedulable: false,
  },
};

export function isItemType(value: string): value is ItemType {
  return (ITEM_TYPES as readonly string[]).includes(value);
}

// --------------------------------------------------------------- estados

/**
 * `tone` mapea a una variable CSS (--tone-*) para no repartir hex por la UI.
 * `weight` es el progreso implicito del estado cuando no hay subtareas.
 * `terminal` marca los estados que cierran el elemento.
 */
export type StatusMeta = {
  value: string;
  label: string;
  tone: Tone;
  weight: number;
  terminal: boolean;
  /** Estado que saca al elemento del flujo sin considerarlo un logro. */
  discarded?: boolean;
};

export type Tone =
  | "neutral"
  | "progress"
  | "review"
  | "done"
  | "blocked"
  | "idea"
  | "info";

export const TASK_STATUSES: StatusMeta[] = [
  { value: "todo", label: "Pendiente", tone: "neutral", weight: 0, terminal: false },
  { value: "in_progress", label: "En progreso", tone: "progress", weight: 40, terminal: false },
  { value: "in_review", label: "En revisión", tone: "review", weight: 80, terminal: false },
  { value: "blocked", label: "Bloqueada", tone: "blocked", weight: 0, terminal: false },
  { value: "done", label: "Completada", tone: "done", weight: 100, terminal: true },
];

export const IDEA_STATUSES: StatusMeta[] = [
  { value: "proposed", label: "Propuesta", tone: "idea", weight: 0, terminal: false },
  { value: "accepted", label: "Aceptada", tone: "done", weight: 100, terminal: true },
  { value: "converted", label: "Convertida en tarea", tone: "info", weight: 100, terminal: true },
  { value: "discarded", label: "Descartada", tone: "neutral", weight: 0, terminal: true, discarded: true },
];

export const PROBLEM_STATUSES: StatusMeta[] = [
  { value: "open", label: "Abierto", tone: "blocked", weight: 0, terminal: false },
  { value: "investigating", label: "En análisis", tone: "progress", weight: 50, terminal: false },
  { value: "resolved", label: "Resuelto", tone: "done", weight: 100, terminal: true },
];

const SINGLE_STATE: Record<string, StatusMeta[]> = {
  note: [{ value: "recorded", label: "Nota", tone: "info", weight: 0, terminal: false }],
  decision: [{ value: "decided", label: "Decidido", tone: "info", weight: 100, terminal: true }],
  update: [{ value: "posted", label: "Publicado", tone: "info", weight: 0, terminal: false }],
};

export function statusesFor(type: string): StatusMeta[] {
  switch (type) {
    case "task":
      return TASK_STATUSES;
    case "idea":
      return IDEA_STATUSES;
    case "problem":
      return PROBLEM_STATUSES;
    default:
      return SINGLE_STATE[type] ?? TASK_STATUSES;
  }
}

const FALLBACK_STATUS: StatusMeta = {
  value: "unknown",
  label: "Sin estado",
  tone: "neutral",
  weight: 0,
  terminal: false,
};

export function statusMeta(type: string, status: string): StatusMeta {
  return statusesFor(type).find((s) => s.value === status) ?? FALLBACK_STATUS;
}

export function isValidStatus(type: string, status: string): boolean {
  return statusesFor(type).some((s) => s.value === status);
}

/** Estados de tarea que cuentan como trabajo abierto en las estadisticas. */
export const OPEN_TASK_STATUSES = ["todo", "in_progress", "in_review", "blocked"];
export const ACTIVE_TASK_STATUSES = ["in_progress", "in_review"];

// ------------------------------------------------------ estados de proyecto

export const PROJECT_STATUSES = ["active", "paused", "done", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; tone: Tone; closed: boolean; description: string }
> = {
  active: {
    label: "Activo",
    tone: "progress",
    closed: false,
    description: "El equipo está trabajando en esto ahora",
  },
  paused: {
    label: "En pausa",
    tone: "neutral",
    closed: false,
    description: "Detenido temporalmente, se retoma más adelante",
  },
  done: {
    label: "Terminado",
    tone: "done",
    closed: true,
    description: "Se completó. Pasa al historial sin perder información",
  },
  cancelled: {
    label: "Cancelado",
    tone: "blocked",
    closed: true,
    description: "No se continúa. Se conserva como registro",
  },
};

export function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

// ----------------------------------------------------------------- acentos

export const ACCENTS = [
  "clay",
  "amber",
  "moss",
  "pine",
  "teal",
  "indigo",
  "plum",
  "stone",
] as const;
export type Accent = (typeof ACCENTS)[number];

export const ACCENT_HEX: Record<Accent, string> = {
  clay: "#b4643f",
  amber: "#a8803a",
  moss: "#6e8257",
  pine: "#437c66",
  teal: "#3f7b86",
  indigo: "#5a648f",
  plum: "#7e5a7c",
  stone: "#6b6862",
};

export function accentHex(accent: string | null | undefined): string {
  return ACCENT_HEX[(accent ?? "clay") as Accent] ?? ACCENT_HEX.clay;
}

/** Acento estable derivado de un id, para no pedirle color al usuario. */
export function accentFromId(id: string): Accent {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

// -------------------------------------------------------------- actividad

/**
 * Verbos del registro de actividad. El historial de un proyecto y el feed
 * personal se arman leyendo estos eventos, nunca comentarios manuales.
 */
export const ACTIVITY = {
  projectCreated: "project.created",
  projectUpdated: "project.updated",
  projectStatusChanged: "project.status_changed",
  projectArchived: "project.archived",
  projectRestored: "project.restored",
  projectProgress: "project.progress_changed",
  projectMemberAdded: "project.member_added",
  projectMemberRemoved: "project.member_removed",
  docUpdated: "doc.updated",
  linkAdded: "link.added",
  linkRemoved: "link.removed",
  itemCreated: "item.created",
  itemUpdated: "item.updated",
  itemStatusChanged: "item.status_changed",
  itemCompleted: "item.completed",
  itemReopened: "item.reopened",
  itemProgressChanged: "item.progress_changed",
  itemAssigned: "item.assigned",
  itemUnassigned: "item.unassigned",
  itemWeightsChanged: "item.weights_changed",
  itemPriorityChanged: "item.priority_changed",
  itemDueChanged: "item.due_changed",
  itemConverted: "item.converted",
  itemDeleted: "item.deleted",
  subtaskAdded: "subtask.added",
  commentAdded: "comment.added",
  mentioned: "comment.mentioned",
  fileUploaded: "file.uploaded",
  memberJoined: "member.joined",
  memberRoleChanged: "member.role_changed",
  memberRemoved: "member.removed",
  proposalCreated: "proposal.created",
  proposalReplied: "proposal.replied",
  proposalTriaged: "proposal.triaged",
  resourceAdded: "resource.added",
} as const;

export type ActivityVerb = (typeof ACTIVITY)[keyof typeof ACTIVITY];

/** Motivo por el que un evento llega al feed de una persona. */
export const FEED_REASONS = [
  "assigned",
  "mentioned",
  "reply",
  "author",
  "participant",
] as const;
export type FeedReason = (typeof FEED_REASONS)[number];

export const FEED_REASON_LABEL: Record<FeedReason, string> = {
  assigned: "Te lo asignaron",
  mentioned: "Te mencionaron",
  reply: "En algo tuyo",
  author: "Algo que creaste",
  participant: "Proyecto en el que participás",
};

/** Razones que ademas cuentan como notificacion directa (campanita). */
export const DIRECT_REASONS: FeedReason[] = ["assigned", "mentioned", "reply"];

// ------------------------------------------------------------ asignaciones

export const ASSIGNEE_SCOPES = ["individual", "team"] as const;
export type AssigneeScope = (typeof ASSIGNEE_SCOPES)[number];

export const PROGRESS_MODES = ["auto", "manual"] as const;
export type ProgressMode = (typeof PROGRESS_MODES)[number];

/**
 * Reparte 100 puntos entre n personas sin perder ni inventar puntos.
 * Los restos se distribuyen de a uno desde el primero.
 */
export function evenWeights(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Normaliza pesos arbitrarios a una suma exacta de 100. */
export function normalizeWeights(weights: number[]): number[] {
  const safe = weights.map((w) => Math.max(0, Math.round(w)));
  const total = safe.reduce((a, b) => a + b, 0);
  if (total === 0) return evenWeights(safe.length);
  const scaled = safe.map((w) => Math.floor((w * 100) / total));
  let diff = 100 - scaled.reduce((a, b) => a + b, 0);
  for (let i = 0; diff > 0; i = (i + 1) % scaled.length) {
    scaled[i] += 1;
    diff -= 1;
  }
  return scaled;
}
