# Hilo — estado del desarrollo

> Última sesión: 30 ago 2026. **Cada proyecto tiene un léeme: documento de
> contexto en Markdown, con bloques `:::equipo` que se recortan en el servidor.
> Compila y corre.**
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
| 26 | Léeme por proyecto, arriba del resumen y en `/p/[id]/leeme` | `ProjectDoc`, `src/server/domain/doc.ts` |
| 27 | Editor Markdown con barra, vista previa, import/export `.md` e imágenes | `src/components/app/project-doc-editor.tsx` |
| 28 | Bloques `:::equipo` recortados en el servidor | `splitDocSegments` en `src/lib/doc.ts` |
| 29 | Acomodar la portada arrastrándola, con acercamiento | `src/components/app/cover-adjuster.tsx`, `src/lib/cover.ts` |

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

### Verificado del léeme (30 ago)

- **Nada se filtra.** El HTML que recibe un visitante sin sesión en `/p/[id]` y
  en `/p/[id]/leeme` no contiene ninguna cadena del bloque `:::equipo` del
  proyecto de ejemplo (cuentas de staging, contraseñas, la nota del gestor):
  cero coincidencias sobre el HTML crudo, no sobre lo que se ve en pantalla.
- **Sanitización.** Sobre el pipeline real: `<script>` desaparece, `onerror` /
  `onclick` / `style` se caen y el `<img>` sobrevive limpio, `href="javascript:"`
  queda sin `href`, `<iframe>` se borra. Sobreviven `<kbd>`, `<details>`,
  `<br>`, las tablas con `align` y los bloques con `class="language-*"`.
- **`:::equipo` dentro de un bloque de código no abre un bloque real**: se
  renderiza literal, así se puede documentar la propia sintaxis.
- Guardar escribe `doc.updated`, el historial lo dice en palabras ("Ezequiel
  actualizó el léeme de Lumen") y hace fan-out a los participantes del proyecto.
- Importar un `.md`, la vista previa (servidor), la barra de herramientas con
  la selección preservada, y subir una imagen que queda insertada como
  `![nombre](/api/files/…)`.

### Verificado del encuadre de portada (30 ago)

- **La migración no toca datos.** `0003_cover_framing` son tres `ALTER TABLE
  ADD COLUMN` escritos a mano. Se probó sobre una copia sembrada llevada al
  estado anterior: proyectos 8, subproyectos 4, items 45, subtareas 17,
  adjuntos 5, actividad 111, léemes 2 — idénticos antes y después, y las
  portadas existentes quedaron en (50, 50, 100), que es el centrado de siempre.
- El arrastre mapea 1 a 1 con los píxeles de imagen que sobran: sobre una
  portada de 960×320 en un recorte de 628×98 sobran 111 px verticales, y
  arrastrar 53 px movió el encuadre 47 %.
- Guardar persiste y se aplica igual en la franja del proyecto y en la tarjeta
  del listado, que recortan distinto.

---

## Bugs encontrados y arreglados

### 30 ago — encuadre de portada

- **Los botones de acercar no acumulaban.** `setZoom(value.coverZoom + paso)`
  lee el valor del render en curso: seis clics rápidos —o dos vueltas de rueda
  seguidas— contaban como uno. Pasado a `setValue(current => …)`, que suma
  sobre el valor vigente.
- **Prisma proponía reconstruir la tabla `Project`** (crear, copiar, `DROP`,
  renombrar) para agregar tres columnas con valor por defecto. Sobre `Project`
  esa operación es justo la que en `0001_single_team` se llevó puestos los
  subproyectos. Reemplazada por `ADD COLUMN`, que no mueve datos.
- El acercamiento sutil del hover en la tarjeta chocaba con el `transform` del
  encuadre: uno pisaba al otro. El hover se mudó a un contenedor.

### 30 ago — léeme

- **La barra de herramientas perdía el cursor.** Reposicionar la selección con
  `requestAnimationFrame` después de `setValue` no sobrevive: al apretar un
  botón el foco se va al botón y React reemplaza el contenido del textarea
  después. La restauración tiene que pasar en un efecto sobre `[value]`, ya con
  el DOM repintado. Sin eso, cada botón mandaba el cursor al principio.
- **`allowDangerousHtml` sin `rehype-raw` no habilita nada.** El HTML embebido
  en un `.md` importado (`<details>`, `<kbd>`, `<br>`) se descartaba entero y en
  silencio. El orden correcto es `remarkRehype({allowDangerousHtml}) → rehypeRaw
  → rehypeSanitize`: parsear primero y sanitizar último, nunca al revés.
- **La base de desarrollo local estaba dos PRs atrás** (sin `ApiToken`), así que
  `migrate resolve --applied 0000_baseline` marcaba como aplicado un baseline
  que la base no tenía y `migrate deploy` moría en `no such table: ApiToken`.
  Se regeneró con `db:reset`. En una base de producción real el camino del
  entrypoint sigue siendo válido; el problema era esta copia vieja.

### 29 ago — single-team

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
- **Cada deploy copia la base antes de migrarla.** El entrypoint corre antes
  del `exec` que arranca Next, así que la base está cerrada y una copia tal cual
  es consistente (no hace falta `sqlite3`, que no está en la imagen). Quedan en
  `/app/data/backups/prod-<fecha>.db`, se conservan las últimas 5, y si la copia
  falla el arranque se aborta: migrar sin copia es peor que no desplegar. Ojo:
  viven en el mismo volumen que la base, así que protegen contra una migración
  que salga mal, no contra perder el volumen.
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