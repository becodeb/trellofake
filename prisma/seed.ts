/**
 * Datos de ejemplo.
 *
 * No es relleno: recrea un equipo de tres personas a mitad de camino en varios
 * proyectos, con historia repartida en dos semanas. Sirve para ver la app como
 * se ve en uso real —con trabajo empezado, cosas trabadas y decisiones viejas—
 * y no como se ve el primer día, que es cuando cualquier herramienta parece
 * buena.
 *
 *   npm run db:seed        (o npm run db:reset para vaciar y volver a sembrar)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  ACTIVITY,
  accentFromId,
  accentHex,
  evenWeights,
  statusMeta,
  type FeedReason,
} from "../src/lib/domain";
import { coverImage, screenshotImage } from "./png";

const db = new PrismaClient();

const PASSWORD = "hilo1234";

// ---------------------------------------------------------------- utilidades

const DAY = 24 * 60 * 60 * 1000;

/** Fecha relativa a ahora, con hora del día fija para que el historial agrupe bien. */
function ago(days: number, hour = 10, minute = 0): Date {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function ahead(days: number): Date {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(18, 0, 0, 0);
  return d;
}

type EventInput = {
  at: Date;
  actorId: string;
  verb: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  projectId?: string | null;
  itemId?: string | null;
  meta?: Record<string, unknown>;
};

const events: EventInput[] = [];

function event(input: EventInput) {
  events.push(input);
}

async function main() {
  console.log("Limpiando…");
  // El orden importa: las tablas hoja primero para no pelear con las FK.
  await db.feedEntry.deleteMany();
  await db.activity.deleteMany();
  await db.mention.deleteMany();
  await db.attachment.deleteMany();
  await db.comment.deleteMany();
  await db.itemAssignment.deleteMany();
  await db.item.deleteMany();
  await db.resourceLink.deleteMany();
  await db.projectMember.deleteMany();
  await db.project.deleteMany();
  await db.membership.deleteMany();
  await db.session.deleteMany();
  await db.workspace.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ------------------------------------------------------------------ gente

  console.log("Creando el equipo…");

  const eze = await db.user.create({
    data: {
      name: "Ezequiel Fernández",
      email: "ezequiel@fernandezcruz.com.ar",
      passwordHash,
      accentColor: "clay",
    },
  });
  const juan = await db.user.create({
    data: { name: "Juan Ibarra", email: "juan@cardinal.studio", passwordHash, accentColor: "pine" },
  });
  const vale = await db.user.create({
    data: {
      name: "Valentina Ruiz",
      email: "valentina@cardinal.studio",
      passwordHash,
      accentColor: "indigo",
    },
  });

  const workspace = await db.workspace.create({
    data: {
      name: "Estudio Cardinal",
      slug: "cardinal",
      mission: "Diseñamos y construimos productos digitales para otros equipos.",
      members: {
        create: [
          { userId: eze.id, role: "admin", title: "Producto", lastSeenAt: ago(2, 19) },
          { userId: juan.id, role: "member", title: "Backend", lastSeenAt: ago(0, 9) },
          { userId: vale.id, role: "member", title: "Diseño", lastSeenAt: ago(1, 17) },
        ],
      },
    },
  });

  const ws = workspace.id;

  // --------------------------------------------------------------- proyectos

  console.log("Creando proyectos…");

  async function project(input: {
    name: string;
    description?: string;
    parent?: { id: string; path: string; depth: number } | null;
    status?: string;
    priority?: string;
    accent?: string;
    start?: Date;
    target?: Date | null;
    completedAt?: Date | null;
    archivedAt?: Date | null;
    members: string[];
    createdBy: string;
    createdAt: Date;
    position: number;
  }) {
    const parent = input.parent ?? null;
    const created = await db.project.create({
      data: {
        workspaceId: ws,
        parentId: parent?.id ?? null,
        path: parent ? `${parent.path}${parent.id}/` : "/",
        depth: parent ? parent.depth + 1 : 0,
        name: input.name,
        description: input.description ?? null,
        accent: input.accent ?? accentFromId(input.name),
        status: input.status ?? "active",
        priority: input.priority ?? "medium",
        startDate: input.start ?? null,
        targetDate: input.target ?? null,
        completedAt: input.completedAt ?? null,
        archivedAt: input.archivedAt ?? null,
        position: input.position,
        createdById: input.createdBy,
        createdAt: input.createdAt,
        members: {
          create: input.members.map((userId, index) => ({
            userId,
            role: index === 0 ? "lead" : "contributor",
          })),
        },
      },
    });

    event({
      at: input.createdAt,
      actorId: input.createdBy,
      verb: parent ? ACTIVITY.projectCreated : ACTIVITY.projectCreated,
      targetType: "project",
      targetId: created.id,
      targetLabel: created.name,
      projectId: created.id,
      meta: parent ? { subproject: true } : {},
    });

    return created;
  }

  const lumen = await project({
    name: "Lumen — tienda online",
    description:
      "Rehacemos la tienda de Lumen de cero: catálogo, checkout y panel para que el cliente cargue productos sin pedirnos nada.",
    priority: "high",
    accent: "clay",
    start: ago(38),
    target: ahead(26),
    members: [eze.id, juan.id, vale.id],
    createdBy: eze.id,
    createdAt: ago(38, 9, 20),
    position: 1,
  });

  const lumenFront = await project({
    name: "Frontend",
    description: "Catálogo, ficha de producto y checkout.",
    parent: lumen,
    priority: "high",
    accent: "amber",
    start: ago(34),
    target: ahead(18),
    members: [vale.id, eze.id],
    createdBy: eze.id,
    createdAt: ago(37, 11),
    position: 1,
  });

  const lumenBack = await project({
    name: "Backend y API",
    description: "Catálogo, stock, pagos y webhooks del proveedor.",
    parent: lumen,
    priority: "urgent",
    accent: "pine",
    start: ago(34),
    target: ahead(12),
    members: [juan.id, eze.id],
    createdBy: juan.id,
    createdAt: ago(37, 11, 20),
    position: 2,
  });

  const lumenAdmin = await project({
    name: "Panel de administración",
    description: "Para que Lumen cargue productos y vea pedidos sin depender de nosotros.",
    parent: lumen,
    priority: "medium",
    accent: "indigo",
    start: ago(20),
    target: ahead(30),
    members: [eze.id, vale.id],
    createdBy: eze.id,
    createdAt: ago(20, 15),
    position: 3,
  });

  const ronda = await project({
    name: "Ronda — app de reservas",
    description:
      "App para reservar turnos en estudios de grabación. Arrancamos por el diseño y la validación con tres estudios reales.",
    priority: "medium",
    accent: "teal",
    start: ago(16),
    target: ahead(45),
    members: [vale.id, eze.id],
    createdBy: vale.id,
    createdAt: ago(16, 10),
    position: 2,
  });

  const rondaDiseno = await project({
    name: "Diseño de producto",
    parent: ronda,
    priority: "high",
    accent: "plum",
    start: ago(15),
    target: ahead(10),
    members: [vale.id],
    createdBy: vale.id,
    createdAt: ago(15, 12),
    position: 1,
  });

  const sitio = await project({
    name: "Sitio del estudio",
    description: "Nuestro propio sitio. Frenado hasta que baje la carga de Lumen.",
    status: "paused",
    priority: "low",
    accent: "moss",
    start: ago(60),
    target: null,
    members: [vale.id, eze.id],
    createdBy: vale.id,
    createdAt: ago(60, 16),
    position: 3,
  });

  const migracion = await project({
    name: "Migración a Postgres",
    description:
      "Sacamos la base vieja de Mongo y pasamos todo a Postgres. Cerrado sin incidentes.",
    status: "done",
    priority: "high",
    accent: "stone",
    start: ago(70),
    target: ago(14),
    completedAt: ago(12, 18),
    archivedAt: ago(12, 18),
    members: [juan.id, eze.id],
    createdBy: juan.id,
    createdAt: ago(70, 9),
    position: 4,
  });

  // ---------------------------------------------------------------- recursos

  console.log("Cargando recursos…");

  const links = [
    { projectId: lumen.id, label: "cardinal/lumen", url: "https://github.com/cardinal/lumen", kind: "github", by: juan.id },
    { projectId: lumen.id, label: "Diseño en Figma", url: "https://figma.com/file/lumen-tienda", kind: "figma", by: vale.id },
    { projectId: lumen.id, label: "staging.lumen.com.ar", url: "https://staging.lumen.com.ar", kind: "site", by: juan.id },
    { projectId: lumen.id, label: "Carpeta del cliente", url: "https://drive.google.com/drive/folders/lumen", kind: "drive", by: eze.id },
    { projectId: lumenBack.id, label: "Documentación de la API", url: "https://docs.lumen.com.ar/api", kind: "docs", by: juan.id },
    { projectId: ronda.id, label: "Investigación con estudios", url: "https://docs.google.com/document/d/ronda-research", kind: "docs", by: vale.id },
    { projectId: ronda.id, label: "Prototipo navegable", url: "https://figma.com/proto/ronda", kind: "figma", by: vale.id },
  ];

  for (const [index, link] of links.entries()) {
    const created = await db.resourceLink.create({
      data: {
        projectId: link.projectId,
        label: link.label,
        url: link.url,
        kind: link.kind,
        position: index,
        addedById: link.by,
        createdAt: ago(30 - index, 12),
      },
    });
    event({
      at: created.createdAt,
      actorId: link.by,
      verb: ACTIVITY.linkAdded,
      targetType: "link",
      targetId: created.id,
      targetLabel: created.label,
      projectId: link.projectId,
      meta: { url: link.url },
    });
  }

  // ------------------------------------------------------------------ items

  console.log("Creando contenido…");

  type ItemSpec = {
    project: string;
    type: string;
    title: string;
    body?: string;
    status?: string;
    priority?: string;
    due?: Date | null;
    createdBy: string;
    createdAt: Date;
    assignees?: Array<{ user: string; weight?: number }>;
    scope?: "individual" | "team";
    progressMode?: "auto" | "manual";
    progress?: number;
    completedAt?: Date | null;
    subtasks?: Array<{ title: string; status: string; by?: string }>;
  };

  const specs: ItemSpec[] = [
    // ---------------- Lumen · Frontend
    {
      project: lumenFront.id,
      type: "task",
      title: "Grilla de catálogo con filtros",
      body: "Filtros por categoría, talle y rango de precio. El filtro tiene que vivir en la URL para poder compartir una búsqueda.",
      status: "done",
      priority: "high",
      createdBy: eze.id,
      createdAt: ago(31, 10),
      completedAt: ago(21, 17, 40),
      assignees: [{ user: vale.id, weight: 70 }, { user: eze.id, weight: 30 }],
      due: ago(22),
    },
    {
      project: lumenFront.id,
      type: "task",
      title: "Ficha de producto",
      body: "Galería, selector de variantes y stock en vivo. Falta el estado de agotado.",
      status: "in_review",
      priority: "high",
      createdBy: vale.id,
      createdAt: ago(24, 11),
      assignees: [{ user: vale.id }],
      due: ahead(2),
      subtasks: [
        { title: "Galería con zoom", status: "done", by: vale.id },
        { title: "Selector de talle y color", status: "done", by: vale.id },
        { title: "Aviso de stock bajo", status: "done", by: vale.id },
        { title: "Estado agotado con aviso por mail", status: "in_progress", by: vale.id },
      ],
    },
    {
      project: lumenFront.id,
      type: "task",
      title: "Checkout en tres pasos",
      body: "Datos, envío y pago. Sin cuenta obligatoria: se puede comprar como invitado.",
      status: "in_progress",
      priority: "urgent",
      createdBy: eze.id,
      createdAt: ago(14, 9, 30),
      assignees: [{ user: vale.id, weight: 50 }, { user: eze.id, weight: 30 }, { user: juan.id, weight: 20 }],
      due: ahead(5),
      subtasks: [
        { title: "Formulario de datos y validación", status: "done", by: vale.id },
        { title: "Cálculo de envío por código postal", status: "done", by: juan.id },
        { title: "Integración con la pasarela", status: "in_progress", by: juan.id },
        { title: "Pantalla de confirmación", status: "todo", by: vale.id },
        { title: "Mail de compra", status: "todo", by: eze.id },
      ],
    },
    {
      project: lumenFront.id,
      type: "problem",
      title: "El catálogo tarda 4 segundos en móvil 3G",
      body: "Las imágenes salen sin comprimir desde el CMS del cliente. En escritorio no se nota, en móvil es insoportable.",
      status: "investigating",
      priority: "high",
      createdBy: vale.id,
      createdAt: ago(6, 16, 20),
    },
    {
      project: lumenFront.id,
      type: "idea",
      title: "Búsqueda con sugerencias mientras se escribe",
      body: "El catálogo va a tener 800 productos. Filtrar a mano va a ser un problema antes de lo que pensamos.",
      status: "proposed",
      priority: "medium",
      createdBy: vale.id,
      createdAt: ago(4, 15),
    },

    // ---------------- Lumen · Backend
    {
      project: lumenBack.id,
      type: "task",
      title: "API de catálogo y stock",
      status: "done",
      priority: "high",
      createdBy: juan.id,
      createdAt: ago(33, 10),
      completedAt: ago(19, 12),
      assignees: [{ user: juan.id }],
    },
    {
      project: lumenBack.id,
      type: "task",
      title: "Integración con la pasarela de pagos",
      body: "Mercado Pago. Los webhooks llegan duplicados, hay que hacer el procesamiento idempotente.",
      status: "blocked",
      priority: "urgent",
      createdBy: juan.id,
      createdAt: ago(11, 14),
      assignees: [{ user: juan.id }],
      due: ago(1),
    },
    {
      project: lumenBack.id,
      type: "task",
      title: "Sincronización con el ERP del cliente",
      body: "Nos pasan un CSV cada noche. Hay que importarlo sin pisar el stock que cambió durante el día.",
      status: "todo",
      priority: "medium",
      createdBy: eze.id,
      createdAt: ago(8, 11),
      assignees: [{ user: juan.id, weight: 80 }, { user: eze.id, weight: 20 }],
      due: ahead(9),
    },
    {
      project: lumenBack.id,
      type: "decision",
      title: "Guardamos el stock en Postgres, no en el ERP",
      body: "El ERP del cliente responde en 2-3 segundos y se cae los domingos. Mantenemos nuestra propia copia del stock y sincronizamos de noche. Si hay diferencia, gana la nuestra hasta la sincronización siguiente.\n\nLo decidimos entre los tres después de la caída del domingo pasado.",
      createdBy: juan.id,
      createdAt: ago(9, 18, 30),
    },
    {
      project: lumenBack.id,
      type: "problem",
      title: "Los webhooks de pago llegan duplicados",
      body: "Mercado Pago reintenta si no contestamos en 5 segundos, y a veces tardamos más. Resultado: pedidos duplicados.",
      status: "open",
      priority: "urgent",
      createdBy: juan.id,
      createdAt: ago(3, 11, 15),
    },
    {
      project: lumenBack.id,
      type: "note",
      title: "Credenciales y entornos",
      body: "Staging: staging.lumen.com.ar — las credenciales están en el 1Password del estudio, carpeta Lumen.\nLos webhooks de prueba se disparan desde el panel de Mercado Pago, cuenta de test.\nEl CSV del ERP llega a las 3 AM a la casilla erp@lumen.com.ar.",
      createdBy: juan.id,
      createdAt: ago(26, 17),
    },

    // ---------------- Lumen · Admin
    {
      project: lumenAdmin.id,
      type: "task",
      title: "Implementar dashboard",
      body: "Pedidos del día, productos sin stock y ventas de la semana. Nada más: el cliente se pierde si le damos veinte números.",
      status: "in_progress",
      priority: "high",
      createdBy: eze.id,
      createdAt: ago(10, 9),
      assignees: [{ user: eze.id, weight: 50 }, { user: juan.id, weight: 30 }, { user: vale.id, weight: 20 }],
      due: ahead(7),
      subtasks: [
        { title: "Backend de métricas", status: "done", by: juan.id },
        { title: "Consultas agregadas", status: "done", by: juan.id },
        { title: "Maqueta del dashboard", status: "done", by: vale.id },
        { title: "Gráfico de ventas semanales", status: "todo", by: eze.id },
        { title: "Exportar a CSV", status: "todo", by: eze.id },
      ],
    },
    {
      project: lumenAdmin.id,
      type: "task",
      title: "Alta y edición de productos",
      status: "todo",
      priority: "high",
      createdBy: eze.id,
      createdAt: ago(7, 10),
      assignees: [{ user: eze.id }],
      due: ahead(14),
    },
    {
      project: lumenAdmin.id,
      type: "task",
      title: "Definir permisos del panel",
      body: "El cliente quiere que los vendedores vean pedidos pero no puedan tocar precios.",
      status: "todo",
      priority: "medium",
      createdBy: eze.id,
      createdAt: ago(5, 16),
      scope: "team",
    },

    // ---------------- Lumen · raíz
    {
      project: lumen.id,
      type: "update",
      title: "Checkout andando de punta a punta en staging",
      body: "Hoy quedó el flujo completo funcionando en staging: se puede comprar como invitado, calcula el envío y llega el mail. Falta la pasarela real, que está trabada por lo de los webhooks duplicados.\n\nMañana sigo con la pantalla de confirmación.",
      createdBy: vale.id,
      createdAt: ago(1, 18, 40),
    },
    {
      project: lumen.id,
      type: "update",
      title: "Reunión con Lumen: mueven la fecha dos semanas",
      body: "Nos dieron aire hasta fin de mes porque ellos todavía no tienen las fotos de producto. Aprovechamos para meter el panel de administración en el alcance, que estaba quedando afuera.",
      createdBy: eze.id,
      createdAt: ago(20, 12, 15),
    },
    {
      project: lumen.id,
      type: "decision",
      title: "El checkout no pide crear cuenta",
      body: "Lo discutimos con el cliente. Obligar a registrarse antes de comprar tira abajo la conversión y ellos no tienen un programa de fidelidad que lo justifique. Se puede crear la cuenta después de comprar, con un click desde el mail.",
      createdBy: eze.id,
      createdAt: ago(22, 16, 45),
    },

    // ---------------- Ronda
    {
      project: rondaDiseno.id,
      type: "task",
      title: "Flujo de reserva en tres pantallas",
      status: "in_progress",
      priority: "high",
      createdBy: vale.id,
      createdAt: ago(12, 10),
      assignees: [{ user: vale.id }],
      due: ahead(4),
      subtasks: [
        { title: "Elegir estudio y sala", status: "done", by: vale.id },
        { title: "Elegir día y horario", status: "done", by: vale.id },
        { title: "Confirmar y pagar la seña", status: "in_progress", by: vale.id },
      ],
    },
    {
      project: rondaDiseno.id,
      type: "task",
      title: "Sistema visual: tipografía y color",
      status: "done",
      priority: "medium",
      createdBy: vale.id,
      createdAt: ago(14, 11),
      completedAt: ago(8, 16),
      assignees: [{ user: vale.id }],
    },
    {
      project: ronda.id,
      type: "note",
      title: "Qué nos dijeron los tres estudios",
      body: "Los tres se quejaron de lo mismo: la gente reserva y no aparece. Dos de los tres ya cobran una seña por WhatsApp a mano.\n\nEl que más factura lleva todo en un cuaderno y no quiere saber nada con una app que le cambie la manera de trabajar. Su problema no es reservar, es cobrar la seña.",
      createdBy: vale.id,
      createdAt: ago(13, 19),
    },
    {
      project: ronda.id,
      type: "decision",
      title: "Cobramos seña desde el día uno",
      body: "Después de hablar con los tres estudios quedó claro que la seña no es una funcionalidad más adelante: es el motivo por el que usarían esto. Entra en la primera versión aunque nos coma dos semanas.",
      createdBy: vale.id,
      createdAt: ago(11, 17, 30),
    },
    {
      project: ronda.id,
      type: "idea",
      title: "Recordatorio por WhatsApp 24 h antes",
      body: "Los estudios ya lo hacen a mano. Automatizarlo es barato y es lo primero que pidieron los tres.",
      status: "accepted",
      priority: "high",
      createdBy: eze.id,
      createdAt: ago(10, 15),
    },
    {
      project: ronda.id,
      type: "idea",
      title: "Perfil público del estudio con fotos",
      status: "proposed",
      priority: "low",
      createdBy: vale.id,
      createdAt: ago(9, 14),
    },
    {
      project: ronda.id,
      type: "update",
      title: "Prototipo listo para mostrar",
      body: "El flujo de reserva está navegable en Figma. Lo pruebo el jueves con el estudio de Chacarita.",
      createdBy: vale.id,
      createdAt: ago(2, 17, 20),
    },

    // ---------------- Sitio (pausado)
    {
      project: sitio.id,
      type: "task",
      title: "Escribir los casos de estudio",
      status: "todo",
      priority: "low",
      createdBy: eze.id,
      createdAt: ago(55, 11),
      assignees: [{ user: eze.id }],
    },
    {
      project: sitio.id,
      type: "note",
      title: "Por qué está en pausa",
      body: "Lo frenamos cuando entró Lumen. Retomarlo cuando el checkout esté cerrado, no antes: ya nos pasó de tener dos frentes abiertos y hacer mal los dos.",
      createdBy: eze.id,
      createdAt: ago(40, 18),
    },

    // ---------------- Migración (terminada)
    {
      project: migracion.id,
      type: "task",
      title: "Migrar datos y verificar integridad",
      status: "done",
      priority: "high",
      createdBy: juan.id,
      createdAt: ago(60, 10),
      completedAt: ago(14, 15),
      assignees: [{ user: juan.id, weight: 60 }, { user: eze.id, weight: 40 }],
    },
    {
      project: migracion.id,
      type: "decision",
      title: "Postgres en vez de seguir con Mongo",
      body: "Las consultas que necesitábamos eran relacionales desde el principio y las estábamos armando a mano en la aplicación. Con Postgres el reporte de ventas pasó de 400 líneas a una consulta.",
      createdBy: juan.id,
      createdAt: ago(66, 16),
    },
  ];

  const created = new Map<string, { id: string; projectId: string; title: string; type: string }>();

  for (const spec of specs) {
    const assignees = spec.assignees ?? [];
    const weights = assignees.some((a) => a.weight !== undefined)
      ? assignees.map((a) => a.weight ?? 0)
      : evenWeights(assignees.length);

    const status = spec.status ?? statusesDefault(spec.type);

    const item = await db.item.create({
      data: {
        workspaceId: ws,
        projectId: spec.project,
        type: spec.type,
        title: spec.title,
        body: spec.body ?? null,
        status,
        priority: spec.priority ?? "medium",
        dueDate: spec.due ?? null,
        assigneeScope: spec.scope ?? "individual",
        progressMode: spec.progressMode ?? "auto",
        progress: statusMeta(spec.type, status).weight,
        completedAt: spec.completedAt ?? null,
        createdById: spec.createdBy,
        createdAt: spec.createdAt,
        position: created.size,
        assignments: {
          create: assignees.map((a, index) => ({
            userId: a.user,
            weight: weights[index],
            assignedById: spec.createdBy,
            assignedAt: spec.createdAt,
          })),
        },
      },
    });

    created.set(spec.title, {
      id: item.id,
      projectId: item.projectId,
      title: item.title,
      type: item.type,
    });

    event({
      at: spec.createdAt,
      actorId: spec.createdBy,
      verb: ACTIVITY.itemCreated,
      targetType: "item",
      targetId: item.id,
      targetLabel: item.title,
      projectId: item.projectId,
      itemId: item.id,
      meta: { type: item.type },
    });

    if (assignees.length > 0) {
      event({
        at: new Date(spec.createdAt.getTime() + 60_000),
        actorId: spec.createdBy,
        verb: ACTIVITY.itemAssigned,
        targetType: "item",
        targetId: item.id,
        targetLabel: item.title,
        projectId: item.projectId,
        itemId: item.id,
        meta: { people: assignees.map((a) => nameOf(a.user, { eze, juan, vale })) },
      });
    }

    // Subtareas: se crean unos días después del padre, como pasa de verdad.
    for (const [index, subtask] of (spec.subtasks ?? []).entries()) {
      const at = new Date(spec.createdAt.getTime() + (index + 1) * DAY * 0.6);
      const sub = await db.item.create({
        data: {
          workspaceId: ws,
          projectId: spec.project,
          parentId: item.id,
          type: "task",
          title: subtask.title,
          status: subtask.status,
          priority: "medium",
          progress: statusMeta("task", subtask.status).weight,
          completedAt: subtask.status === "done" ? new Date(at.getTime() + DAY) : null,
          createdById: subtask.by ?? spec.createdBy,
          createdAt: at,
          position: index,
          assignments: subtask.by
            ? {
                create: [
                  { userId: subtask.by, weight: 100, assignedById: spec.createdBy, assignedAt: at },
                ],
              }
            : undefined,
        },
      });

      event({
        at,
        actorId: subtask.by ?? spec.createdBy,
        verb: ACTIVITY.subtaskAdded,
        targetType: "item",
        targetId: sub.id,
        targetLabel: sub.title,
        projectId: spec.project,
        itemId: sub.id,
        meta: { parent: item.title },
      });

      if (subtask.status === "done") {
        event({
          at: new Date(at.getTime() + DAY),
          actorId: subtask.by ?? spec.createdBy,
          verb: ACTIVITY.itemCompleted,
          targetType: "item",
          targetId: sub.id,
          targetLabel: sub.title,
          projectId: spec.project,
          itemId: sub.id,
          meta: { type: "task" },
        });
      }
    }

    if (spec.completedAt) {
      event({
        at: spec.completedAt,
        actorId: assignees[0]?.user ?? spec.createdBy,
        verb: ACTIVITY.itemCompleted,
        targetType: "item",
        targetId: item.id,
        targetLabel: item.title,
        projectId: item.projectId,
        itemId: item.id,
        meta: { type: item.type },
      });
    } else if (status === "in_progress" || status === "in_review" || status === "blocked") {
      event({
        at: new Date(spec.createdAt.getTime() + DAY * 2),
        actorId: assignees[0]?.user ?? spec.createdBy,
        verb: ACTIVITY.itemStatusChanged,
        targetType: "item",
        targetId: item.id,
        targetLabel: item.title,
        projectId: item.projectId,
        itemId: item.id,
        meta: {
          from: "todo",
          to: status,
          fromLabel: "Pendiente",
          toLabel: statusMeta(spec.type, status).label,
          type: item.type,
        },
      });
    }
  }

  // -------------------------------------------------------------- comentarios

  console.log("Agregando conversación…");

  const conversations: Array<{
    on: string;
    author: string;
    body: string;
    at: Date;
    mentions?: string[];
  }> = [
    {
      on: "Los webhooks de pago llegan duplicados",
      author: eze.id,
      body: "Juan, ¿esto explica los tres pedidos repetidos que nos marcó Lumen el lunes?",
      at: ago(3, 12, 10),
      mentions: [juan.id],
    },
    {
      on: "Los webhooks de pago llegan duplicados",
      author: juan.id,
      body: "Sí, es exactamente eso. Los tres tienen el mismo id de pago. Voy a guardar el id del webhook y descartar el que ya procesamos, es la solución que recomiendan ellos.",
      at: ago(3, 12, 40),
    },
    {
      on: "Integración con la pasarela de pagos",
      author: juan.id,
      body: "La dejo bloqueada hasta resolver lo de los duplicados. No tiene sentido seguir metiendo casos arriba de algo que procesa dos veces.",
      at: ago(2, 9, 30),
    },
    {
      on: "Checkout en tres pasos",
      author: juan.id,
      body: "Terminé el cálculo de envío. Valentina, fijate que el código postal ahora valida contra la lista de Correo Argentino, así no se puede escribir cualquier cosa.",
      at: ago(2, 16),
      mentions: [vale.id],
    },
    {
      on: "Checkout en tres pasos",
      author: eze.id,
      body: "Buenísimo. Me guardo la pantalla de confirmación para mañana así vos seguís con la pasarela.",
      at: ago(1, 10, 20),
    },
    {
      on: "El catálogo tarda 4 segundos en móvil 3G",
      author: vale.id,
      body: "Medí con throttling de 3G: 4,2 s hasta que se ve la primera imagen. Las fotos que sube el cliente pesan 3 MB cada una.",
      at: ago(6, 16, 50),
    },
    {
      on: "El catálogo tarda 4 segundos en móvil 3G",
      author: juan.id,
      body: "Puedo meter conversión a webp y redimensionado al subir, del lado del servidor. Así no dependemos de que el cliente se acuerde de comprimir.",
      at: ago(5, 11),
    },
    {
      on: "Implementar dashboard",
      author: juan.id,
      body: "Las consultas agregadas ya están. Ezequiel, el endpoint es /api/admin/metrics y devuelve los tres números que pediste.",
      at: ago(4, 15, 30),
      mentions: [eze.id],
    },
    {
      on: "Búsqueda con sugerencias mientras se escribe",
      author: eze.id,
      body: "Me gusta pero no ahora. Anotémosla para después del lanzamiento, cuando veamos cómo busca la gente de verdad.",
      at: ago(3, 18),
    },
    {
      on: "Flujo de reserva en tres pantallas",
      author: eze.id,
      body: "Valentina, ¿la seña entra en la tercera pantalla o es un paso aparte?",
      at: ago(5, 12),
      mentions: [vale.id],
    },
    {
      on: "Flujo de reserva en tres pantallas",
      author: vale.id,
      body: "En la tercera, junto con la confirmación. Meter un cuarto paso solo para pagar hacía que la gente abandonara en las pruebas de papel.",
      at: ago(5, 14, 15),
    },
    {
      on: "Cobramos seña desde el día uno",
      author: eze.id,
      body: "De acuerdo. Es la diferencia entre una agenda linda y algo por lo que pagarían.",
      at: ago(11, 18),
    },
  ];

  for (const line of conversations) {
    const target = created.get(line.on);
    if (!target) continue;

    const comment = await db.comment.create({
      data: {
        workspaceId: ws,
        authorId: line.author,
        itemId: target.id,
        body: line.body,
        createdAt: line.at,
      },
    });

    for (const userId of line.mentions ?? []) {
      await db.mention.create({
        data: { userId, commentId: comment.id, createdAt: line.at },
      });
    }

    event({
      at: line.at,
      actorId: line.author,
      verb: line.mentions?.length ? ACTIVITY.mentioned : ACTIVITY.commentAdded,
      targetType: "comment",
      targetId: comment.id,
      targetLabel: target.title,
      projectId: target.projectId,
      itemId: target.id,
      meta: { excerpt: line.body.slice(0, 160), on: target.type, mentions: line.mentions ?? [] },
    });
  }

  // Cierre del proyecto archivado, para que el archivo tenga historia real.
  event({
    at: ago(12, 18),
    actorId: juan.id,
    verb: ACTIVITY.projectArchived,
    targetType: "project",
    targetId: migracion.id,
    targetLabel: migracion.name,
    projectId: migracion.id,
    meta: { from: "active", to: "done" },
  });
  event({
    at: ago(45, 11),
    actorId: eze.id,
    verb: ACTIVITY.projectStatusChanged,
    targetType: "project",
    targetId: sitio.id,
    targetLabel: sitio.name,
    projectId: sitio.id,
    meta: { from: "active", to: "paused" },
  });


  // ----------------------------------------------------------- imagenes

  console.log("Generando imágenes…");

  const storageRoot = path.resolve(process.env.STORAGE_DIR ?? "./storage");

  /** Escribe un PNG en el almacenamiento y lo registra como adjunto. */
  async function attach(input: {
    bytes: Buffer;
    filename: string;
    uploaderId: string;
    projectId: string;
    itemId?: string;
    at: Date;
  }) {
    const key = `${ws}/${randomBytes(8).toString("hex")}.png`;
    const target = path.join(storageRoot, key);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, input.bytes);

    const attachment = await db.attachment.create({
      data: {
        workspaceId: ws,
        uploaderId: input.uploaderId,
        filename: input.filename,
        mimeType: "image/png",
        sizeBytes: input.bytes.length,
        storageKey: key,
        kind: "image",
        projectId: input.projectId,
        itemId: input.itemId ?? null,
        createdAt: input.at,
      },
    });

    return { id: attachment.id, url: `/api/files/${key}` };
  }

  // Portadas: identifican al proyecto de un vistazo en el dashboard.
  for (const project of [lumen, ronda]) {
    const cover = await attach({
      bytes: coverImage(accentHex(project.accent)),
      filename: `portada-${project.id.slice(-6)}.png`,
      uploaderId: project.createdById,
      projectId: project.id,
      at: project.createdAt,
    });
    await db.project.update({ where: { id: project.id }, data: { coverUrl: cover.url } });
  }

  // Capturas pegadas en los problemas, que es donde de verdad se usan.
  const evidence: Array<{ on: string; by: string; filename: string; at: Date; accent: string }> = [
    {
      on: "El catálogo tarda 4 segundos en móvil 3G",
      by: vale.id,
      filename: "catalogo-3g-waterfall.png",
      at: ago(6, 16, 30),
      accent: "amber",
    },
    {
      on: "Los webhooks de pago llegan duplicados",
      by: juan.id,
      filename: "pedidos-duplicados.png",
      at: ago(3, 11, 20),
      accent: "pine",
    },
    {
      on: "Prototipo listo para mostrar",
      by: vale.id,
      filename: "flujo-reserva.png",
      at: ago(2, 17, 25),
      accent: "plum",
    },
  ];

  for (const shot of evidence) {
    const target = created.get(shot.on);
    if (!target) continue;
    const file = await attach({
      bytes: screenshotImage(accentHex(shot.accent)),
      filename: shot.filename,
      uploaderId: shot.by,
      projectId: target.projectId,
      itemId: target.id,
      at: shot.at,
    });
    event({
      at: shot.at,
      actorId: shot.by,
      verb: ACTIVITY.fileUploaded,
      targetType: "file",
      targetId: file.id,
      targetLabel: target.title,
      projectId: target.projectId,
      itemId: target.id,
      meta: { count: 1, filenames: [shot.filename] },
    });
  }

  // -------------------------------------------------------------- actividad

  console.log("Escribiendo el historial…");

  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  const projectMembers = new Map<string, string[]>();
  for (const p of await db.projectMember.findMany({
    select: { projectId: true, userId: true },
  })) {
    const list = projectMembers.get(p.projectId) ?? [];
    list.push(p.userId);
    projectMembers.set(p.projectId, list);
  }

  const assignmentsByItem = new Map<string, string[]>();
  for (const a of await db.itemAssignment.findMany({
    select: { itemId: true, userId: true },
  })) {
    const list = assignmentsByItem.get(a.itemId) ?? [];
    list.push(a.userId);
    assignmentsByItem.set(a.itemId, list);
  }

  for (const e of events) {
    const activity = await db.activity.create({
      data: {
        workspaceId: ws,
        actorId: e.actorId,
        verb: e.verb,
        projectId: e.projectId ?? null,
        itemId: e.itemId ?? null,
        targetType: e.targetType,
        targetId: e.targetId,
        targetLabel: e.targetLabel,
        meta: e.meta ? JSON.stringify(e.meta) : null,
        createdAt: e.at,
      },
    });

    // Mismo reparto que hace la app en caliente: mención > asignación > proyecto.
    const audience = new Map<string, FeedReason>();
    const put = (userId: string, reason: FeedReason, rank: number) => {
      if (userId === e.actorId) return;
      const current = audience.get(userId);
      const currentRank = current ? RANK[current] : 99;
      if (rank < currentRank) audience.set(userId, reason);
    };

    for (const userId of (e.meta?.mentions as string[] | undefined) ?? []) {
      put(userId, "mentioned", 0);
    }
    for (const userId of e.itemId ? (assignmentsByItem.get(e.itemId) ?? []) : []) {
      put(userId, "assigned", 1);
    }
    for (const userId of e.projectId ? (projectMembers.get(e.projectId) ?? []) : []) {
      put(userId, "participant", 4);
    }

    if (audience.size === 0) continue;

    await db.feedEntry.createMany({
      data: Array.from(audience, ([userId, reason]) => ({
        userId,
        activityId: activity.id,
        workspaceId: ws,
        reason,
        direct: reason === "mentioned" || reason === "assigned" || reason === "reply",
        // Lo de los últimos tres días queda sin leer: hay novedades al entrar.
        readAt: e.at < ago(3, 0) ? new Date() : null,
        createdAt: e.at,
      })),
    });
  }

  // ---------------------------------------------------------------- progreso

  console.log("Calculando progreso…");
  await recomputeAll();

  const counts = {
    proyectos: await db.project.count(),
    items: await db.item.count(),
    comentarios: await db.comment.count(),
    eventos: await db.activity.count(),
    novedades: await db.feedEntry.count({ where: { readAt: null } }),
  };

  console.log("\nListo.\n");
  console.table(counts);
  console.log(`\nEntrá en http://localhost:3000/login\n`);
  console.log(`  ezequiel@fernandezcruz.com.ar   ${PASSWORD}   (admin)`);
  console.log(`  juan@cardinal.studio            ${PASSWORD}`);
  console.log(`  valentina@cardinal.studio       ${PASSWORD}\n`);
}

const RANK: Record<FeedReason, number> = {
  mentioned: 0,
  assigned: 1,
  reply: 2,
  author: 3,
  participant: 4,
};

function statusesDefault(type: string): string {
  return { task: "todo", idea: "proposed", note: "recorded", problem: "open", decision: "decided", update: "posted" }[
    type
  ] ?? "todo";
}

function nameOf(id: string, users: { eze: { id: string; name: string }; juan: { id: string; name: string }; vale: { id: string; name: string } }) {
  return [users.eze, users.juan, users.vale].find((u) => u.id === id)?.name ?? "alguien";
}

/**
 * Recalcula progreso de abajo hacia arriba: subtareas, después tareas raíz,
 * después proyectos de la hoja al tronco. Es la misma regla que aplica la app
 * en caliente, reescrita acá para que el seed no dependa del runtime de Next.
 */
async function recomputeAll() {
  const items = await db.item.findMany({
    select: { id: true, type: true, status: true, parentId: true, progressMode: true, progress: true },
  });

  const childrenOf = new Map<string, typeof items>();
  for (const item of items) {
    if (!item.parentId) continue;
    const list = childrenOf.get(item.parentId) ?? [];
    list.push(item);
    childrenOf.set(item.parentId, list);
  }

  for (const item of items) {
    const meta = statusMeta(item.type, item.status);
    let progress: number;

    if (meta.terminal && meta.weight === 100) progress = 100;
    else if (item.progressMode === "manual") progress = item.progress;
    else {
      const children = childrenOf.get(item.id) ?? [];
      progress = children.length
        ? Math.round(
            children.reduce((sum, child) => {
              const childMeta = statusMeta(child.type, child.status);
              return sum + (childMeta.terminal && childMeta.weight === 100 ? 100 : childMeta.weight);
            }, 0) / children.length,
          )
        : meta.weight;
    }

    await db.item.update({ where: { id: item.id }, data: { progress } });
  }

  const projects = await db.project.findMany({
    select: { id: true, depth: true, status: true },
    orderBy: { depth: "desc" },
  });

  for (const project of projects) {
    if (project.status === "done") {
      await db.project.update({ where: { id: project.id }, data: { progress: 100 } });
      continue;
    }

    const [children, tasks] = await Promise.all([
      db.project.findMany({
        where: { parentId: project.id, status: { not: "cancelled" } },
        select: { progress: true },
      }),
      db.item.findMany({
        where: { projectId: project.id, type: "task", parentId: null },
        select: { progress: true },
      }),
    ]);

    const units = [...children.map((c) => c.progress), ...tasks.map((t) => t.progress)];
    const progress = units.length
      ? Math.round(units.reduce((a, b) => a + b, 0) / units.length)
      : 0;

    await db.project.update({ where: { id: project.id }, data: { progress } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
