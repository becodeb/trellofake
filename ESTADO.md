# Hilo — estado del desarrollo

> Última sesión: 22 ago 2026. **La reconversión para red educativa está implementada, compila y corre.**
> Para el panorama del producto y las decisiones de arquitectura, leer
> [README.md](README.md). Este archivo es la bitácora de desarrollo.

**Repositorio:** <https://github.com/becodeb/trellofake> (público, rama `main`)

## Arrancar

```bash
npm run setup && npm run dev
```

Cuentas de ejemplo en el README. `npm run db:reset` vuelve a sembrar.

---

## Qué está terminado

Las 18 capacidades del MVP, todas verificadas contra la app corriendo:

| # | Capacidad | Dónde vive |
|---|---|---|
| 1 | Workspace | `/w/[slug]`, guards en `src/server/auth/context.ts` |
| 2 | Roles admin/miembro | capacidades en `src/lib/domain.ts`, alta en `/ajustes` |
| 3 | Dashboard | `/w/[slug]` |
| 4 | Crear, editar, pausar, terminar y archivar proyectos | encabezado de proyecto |
| 5 | Subproyectos | mismo modelo, ruta materializada |
| 6 | Tareas colaborativas | panel de detalle |
| 7 | Asignar a uno, varios o todo el equipo | `AssigneePicker` |
| 8 | Progreso y % de colaboración | `src/server/domain/progress.ts` |
| 9 | Subtareas | panel de detalle, alta en línea |
| 10 | Ideas, notas, problemas, decisiones, avances | pestaña Espacio |
| 11 | Comentarios con menciones | `src/components/app/comments.tsx` |
| 12 | Actividad automática | `src/server/domain/activity.ts` |
| 13 | Feed personalizado | `/novedades`, fan-out en escritura |
| 14 | Historial por proyecto | pestaña Historial |
| 15 | Links de recursos | autodetección de tipo por URL |
| 16 | Archivos e imágenes | `/api/files`, `src/server/storage.ts` |
| 17 | Búsqueda global | ⌘K y `/buscar` |
| 18 | Novedades y no-leídos | `FeedEntry` + `Membership.lastSeenAt` |
| 19 | Roles admin/desarrollador/comunidad | capacidades en `src/lib/domain.ts` |
| 20 | Visibilidad comunidad/solo equipo | `Project.visibility` + filtros de acceso |
| 21 | Buzón de propuestas y conversación | `/ideas` + `Proposal` |
| 22 | Derivar o iniciar una idea como proyecto | acciones en `proposals.ts` |
| 23 | Biblioteca global de recursos | `/recursos` + `KnowledgeResource` |
| 24 | Guías de integración Markdown/GitHub | pestaña `Cómo conectarse` |

Extras que salieron del mismo modelo sin costo: página por persona
(`/gente/[userId]`, contesta "qué está haciendo cada uno"), tablero con
drag & drop, tema claro/oscuro, y datos de ejemplo con imágenes generadas.

### Verificado en el navegador

- Login, logout y alta de equipo.
- Las 28 rutas responden 200 (y 404 donde corresponde).
- Crear tarea en línea dispara la cadena completa: item → actividad → fan-out
  al feed → progreso del proyecto → roll-up al padre.
- Ruta de archivos: 200 con sesión, 401 sin sesión, 404 ante path traversal.
- Paleta de comandos buscando entre proyectos, tareas y decisiones.
- Tema oscuro.
- `next build` limpio y `tsc --noEmit` sin errores.

---

## Bugs encontrados y arreglados en esta sesión

- **Login se colgaba en pantalla en blanco.** El cliente hacía `router.replace`
  seguido de `router.refresh()`, y ese refresh volvía a renderizar `/login`,
  que ahora redirige. Ahora la acción redirige desde el servidor y `run()`
  reconoce y relanza las señales de navegación de Next (`NEXT_REDIRECT`) en
  vez de tragárselas como errores.
- **Componentes cliente importaban valores desde módulos `server-only`**, lo
  que rompía el build. Las formas y helpers puros que cruzan la frontera se
  movieron a `src/lib/shared.ts`.
- **`/nuevo-equipo` estaba enlazada pero no existía**: alguien sin workspace
  caía en un 404. Ahora hay página y acción `createWorkspace`.
- Detalles de redacción: "Ezequiel asignó X a Ezequiel Fernández" ahora es
  "se asignó X"; acentos faltantes en las etiquetas del dominio; "proyectos
  activos" contaba subproyectos.

---

## Notas de operación

- **No correr `next build` con el dev server levantado**: comparten `.next` y
  el dev queda corrupto (`Cannot find module './611.js'`). Parar, buildear,
  volver a levantar.
- El proyecto vive dentro de OneDrive. En esta sesión `node_modules`
  desapareció una vez tras un apagón; si pasa, `npm install` lo recupera.
- `npm install` avisa que hay postinstall bloqueados (esbuild, sharp). No
  afecta: `tsx` y `prisma generate` funcionan igual.

---

## Si se sigue

Nada de esto es necesario para que el producto funcione; son los siguientes
pasos naturales, ordenados por lo que más aportaría:

1. **Notificaciones fuera de la app** (mail o webhook) cuando te asignan o te
   mencionan. La infraestructura ya está: `FeedEntry.direct` marca exactamente
   esos eventos.
2. **Reordenar por arrastre dentro de una columna.** Hoy el tablero mueve entre
   estados; `Item.position` es un float, así que reordenar es calcular el punto
   medio entre vecinos.
3. **Invitaciones por link** en vez del alta con contraseña temporal.
4. **Búsqueda con índice** al pasar a PostgreSQL: `search.ts` está aislado a
   propósito para que sea un cambio de un archivo.
5. **Tiempo real** (los eventos ya existen; falta el canal).
6. **Tests**: el dominio —`progress.ts`, `activity.ts`, el reparto de pesos—
   es puro y fácil de cubrir. Es lo primero que pediría un segundo par de manos.
