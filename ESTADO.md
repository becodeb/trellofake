# Hilo — estado del desarrollo

> Última sesión: 29 ago 2026. **Implementado single-team: una instancia = un equipo, lectura pública, rutas planas, migraciones reales. Compila y corre.**
> Para el panorama del producto y las decisiones de arquitectura, leer
> [README.md](README.md). Este archivo es la bitácora de desarrollo.

**Repositorio:** <https://github.com/becodeb/trellofake> (público, rama `main`)

## Arrancar

```bash
npm run setup && npm run dev
```

`setup` aplica migraciones y siembra. `npm run db:reset` borra la base de
desarrollo y la vuelve a sembrar. Cuentas de ejemplo en el README.

---

## Qué está terminado

Las capacidades del MVP, todas verificadas contra la app corriendo:

| # | Capacidad | Dónde vive |
|---|---|---|
| 1 | Equipo único (Team = antiguo workspace, mismo id) | `prisma/migrations/0001_single_team`, `src/server/auth/context.ts` |
| 2 | Membresía global `@@unique([userId])`; alta con rol | `Membership`, signup en `actions/auth.ts` |
| 3 | Lectura pública sin sesión (guest) | `getTeamContext()` + rutas bajo `(app)` |
| 4 | Guardas de escritura por capacidad | `requireTeamAction(cap)` en las ~30 acciones |
| 5 | Dashboard | `/` |
| 6 | Crear, editar, pausar, terminar y archivar proyectos | encabezado de proyecto |
| 7 | Subproyectos | mismo modelo, ruta materializada |
| 8 | Tareas colaborativas | panel de detalle |
| 9 | Asignar a uno, varios o todo el equipo | `AssigneePicker` |
| 10 | Progreso y % de colaboración | `src/server/domain/progress.ts` |
| 11 | Subtareas | panel de detalle, alta en línea |
| 12 | Ideas, notas, problemas, decisiones, avances | pestaña Espacio |
| 13 | Comentarios con menciones | `src/components/app/comments.tsx` |
| 14 | Actividad automática | `src/server/domain/activity.ts` |
| 15 | Feed personalizado | `/novedades`, fan-out en escritura |
| 16 | Historial por proyecto | pestaña Historial |
| 17 | Links de recursos | autodetección de tipo por URL |
| 18 | Archivos e imágenes públicos | `/api/files`, `Cache-Control: public` |
| 19 | Búsqueda global | ⌘K y `/buscar` |
| 20 | Novedades y no-leídos | `FeedEntry` + `Membership.lastSeenAt` |
| 21 | Rutas planas + 301 de `/w/<slug>/…` | `src/middleware.ts` (matcher `/w/:path*`) |
| 22 | Buzón de propuestas y conversación | `/ideas` + `Proposal` |
| 23 | Derivar o iniciar una idea como proyecto | acciones en `proposals.ts` |
| 24 | Biblioteca de recursos y guías | `/recursos` + `KnowledgeResource` |
| 25 | API MCP por token (Streamable HTTP) | `/api/mcp`, scoping al team por membership |

### Verificado

- Migración `0001_single_team` sobre una copia de la base real: `Team` copia el
  id del workspace, cero pérdida de filas (proyectos, items, comentarios,
  adjuntos, propuestas, actividad, feed), `ApiToken` intacto, claves de
  storage intactas.
- Fresh DB: `migrate deploy` + seed → exactamente un `Team` (id `hilo`).
- Middleware: `/w/hilo/proyectos` → 301 `/proyectos`; `/w/hilo` → 301 `/`;
  `/w/otro/x` → 404.
- Guest: `/`, `/proyectos`, `/p/[id]`, `/ideas`, `/recursos`, `/buscar` → 200.
- Archivo existente → 200 (cache público); clave inexistente → 404.
- MCP: token válido completa el handshake `initialize`; token desconocido o
  ausente → 401; usuario sin membresía → 403.
- `tsc --noEmit` limpio y `next build` limpio.

---

## Bugs encontrados y arreglados en esta sesión

- **`middleware.ts` en la raíz no se ejecutaba.** El repo usa `src/app`:
  Next solo encuentra el middleware dentro de `src/`. La compilación lo
  manifestaba (`.next/server/middleware-manifest.json`) pero las requests
  nunca lo atravesaban. Movido a `src/middleware.ts` y verificado con `next
  start` (301/404 reales).
- **La migración borraba subproyectos y subtareas en SQLite.** El engine corre
  las migraciones con `PRAGMA foreign_keys = ON`: al reconstruir `Project` e
  `Item` (auto-referenciadas por `parentId`), el `DROP TABLE` original hacía
  cascade sobre las tablas recién copiadas. `0001_single_team` arranca con
  `PRAGMA foreign_keys = OFF;` y termina re-activándolo; re-verificado en copia:
  cero pérdida.
- **Adjuntos sin sesión:** el guard de membresía del route de archivos se cayó
  a propósito (contenido público) y se sirve con `Cache-Control: public`.

---

## Notas de operación

- **No correr `next build` con el dev server levantado**: comparten `.next` y
  el dev queda corrupto. Parar, buildear, volver a levantar.
- El middleware vive en **`src/middleware.ts`** (no en la raíz): con `src/app`,
  raíz no se compila.
- `TEAM_SLUG` (default `"hilo"`) decide qué slug redirige a la ruta limpia.
  En una base migrada el slug hereda el del workspace histórico (p. ej.
  `cardinal`): definir `TEAM_SLUG` en el deploy de producción a ese valor, o
  re-sembrar. Ya está cableado en `docker-compose.prod.yml`.
- Bases viejas creadas con `db push` (sin historial): el entrypoint ejecuta
  `migrate resolve --applied 0000_baseline` (con tolerancia a fallo) y luego
  `migrate deploy` para aplicar `0001_single_team`. Nunca `--force-reset`.
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
3. **Búsqueda con índice** al pasar a PostgreSQL: `search.ts` está aislado a
   propósito para que sea un cambio de un archivo.
4. **Tiempo real** (los eventos ya existen; falta el canal).
5. **Tests**: el dominio —`progress.ts`, `activity.ts`, el reparto de pesos—
   es puro y fácil de cubrir. Es lo primero que pediría un segundo par de manos.