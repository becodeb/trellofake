# Hilo

Punto de encuentro entre una comunidad educativa y el equipo que construye sus
aplicaciones.

Hilo combina dos experiencias en el mismo lugar: quienes desarrollan conservan
la gestión de proyectos, tareas, responsables, problemas y decisiones; quienes
no trabajan con el código pueden seguir todo lo que se construye (el contenido
es público), conversar con el equipo y proponer necesidades. La intención es que
nadie pierda el contexto ni tenga que encontrar a la persona correcta por otro
canal.

---

## Arrancar

```bash
npm install
```

```bash
npm run setup
```

```bash
npm run dev
```

`setup` genera el cliente de Prisma, aplica las migraciones (`migrate deploy`)
y carga datos de ejemplo. Después, entrar en <http://localhost:3000/login>:

| Cuenta | Contraseña | Rol |
|---|---|---|
| `ezequiel@fernandezcruz.com.ar` | `hilo1234` | Admin |
| `juan@cardinal.studio` | `hilo1234` | Desarrollador |
| `valentina@cardinal.studio` | `hilo1234` | Desarrolladora |
| `alma@rededucativa.edu.ar` | `hilo1234` | Comunidad |

Los datos de ejemplo no son relleno: son un equipo de tres personas a mitad de
camino, con trabajo empezado, cosas trabadas, decisiones viejas y dos semanas
de historial. La app se ve como se ve en uso, no como se ve el primer día.

Para volver a empezar de cero: `npm run db:reset`.

---

## Decisiones de arquitectura

**Una instancia = un equipo.** No hay multi-tenancy: la base guarda un único
`Team` cuyo id es el del workspace histórico, así las claves de storage
(`<teamId>/<hash>`) y los tokens de API conservan su valor sin migrar datos. La
membresía es global (`Membership @@unique([userId])`) y el contenido es
público: la lectura no pide sesión y la escritura se gobierna por capacidades
(`can()`). El alta de la primera cuenta queda como admin; las siguientes
entran como comunidad.

**Un `Item` para los seis tipos de contenido.** Tarea, idea, nota, problema,
decisión y actualización comparten tabla. Todas necesitan lo mismo —autor,
cuerpo, comentarios, adjuntos, actividad, búsqueda— y sólo las tareas suman
estado, asignaciones y progreso. Seis tablas hubieran significado seis veces
cada una de esas superficies.

**Un subproyecto *es* un proyecto.** `Project` es auto-referencial y guarda una
ruta materializada (`/rootId/parentId/`), así que resolver un subárbol completo
—para sumar tareas o para leer su historial— es un solo `startsWith` en vez de
recorrer el árbol.

**La actividad se reparte al escribir, no al leer.** Cada acción escribe un
`Activity` y se reparte (`FeedEntry`) a las personas para las que es relevante,
con el motivo por el que les llega. Eso hace que el feed personal y los
no-leídos sean un índice y no un recálculo de pertenencias en cada visita. Es
lo que permite responder "qué pasó desde tu última visita" sin costo.

**El progreso se guarda, no se calcula al leer.** El dashboard muestra decenas
de proyectos; recorrer el árbol en cada render no escala. Las reglas completas
están documentadas arriba de `src/server/domain/progress.ts`: una tarea con
subtareas promedia sus hijas, sin subtareas usa el peso de su estado, y un
proyecto promedia sus subproyectos y sus tareas de primer nivel.

**Los estados son strings validados en el dominio, no enums de base.** Sumar un
estado, un rol o un tipo de contenido se hace en `src/lib/domain.ts` y se
propaga solo, sin migración. También mantiene el esquema portable: cambiar
SQLite por PostgreSQL es cambiar dos líneas de `schema.prisma`.

**Los roles gobiernan las acciones, no la lectura.** `admin` y `developer`
gestionan trabajo; `community` participa; un visitante sin sesión lee como
invitado. Toda mutación pasa por `requireTeamAction(capability)` y, si no hay
sesión, responde `{ ok: false }` con UNAUTHENTICATED en lugar de filtrar datos.

**Las propuestas son una entrada, no otro tablero.** Una necesidad nace en el
buzón común, acumula conversación y el equipo la vincula a un proyecto o la
promueve a uno nuevo. Así las ideas no se mezclan con tareas antes de tiempo y
conservan quién las propuso.

**Los recursos documentan acceso, no secretos.** La biblioteca admite bases de
datos, diseños, repositorios, servicios y APIs. Las guías de integración pueden
guardarse como Markdown o enlazarse a GitHub; Hilo las muestra y permite
copiarlas para otra persona o una IA. Tokens y contraseñas quedan fuera: para
los datos de acceso que el equipo sí necesita compartir está el bloque
`:::equipo` del léeme, que se explica abajo.

**Cada proyecto tiene un léeme, y es lo primero que se lee.** El equivalente al
README de un repositorio: qué es el proyecto, cómo se trabaja con él y los datos
que hacen falta para empezar. Se escribe en Markdown —con barra de herramientas
para quien no lo conoce— y se puede importar y exportar como `.md` sin pérdida,
porque lo que se guarda es el texto plano y no un formato propio. Aparece
plegado arriba del resumen del proyecto y completo en su propia pestaña.

**El documento puede tener partes que no son públicas.** Como todo el contenido
de Hilo se lee sin sesión, el léeme admite bloques marcados con `:::equipo`:

```markdown
:::equipo
Las cuentas de staging, los entornos internos, a quién pedirle acceso.
:::
```

Ese recorte pasa en el servidor, antes de convertir el Markdown a HTML: quien no
tiene rol de equipo no recibe ese texto ni en el HTML ni en el payload de React,
y el token MCP de una cuenta de comunidad tampoco lo ve. No es CSS ni un filtro
en el cliente. Aun así, es para datos de prueba y de acceso interno: las
credenciales de producción siguen viviendo en un gestor de contraseñas, y las
imágenes que se suban al documento quedan accesibles por su URL directa.

**La portada se acomoda, no se recorta.** Al subir una imagen de portada se
guarda el archivo original y, aparte, tres números: qué punto de la imagen tiene
que quedar a la vista (`coverX`, `coverY`) y cuánto se acerca (`coverZoom`). Se
arrastra la foto dentro del recorte, como al acomodar una foto de perfil. Guardar
el encuadre en vez del recorte tiene dos ventajas concretas: se puede volver a
mover mañana sin haber perdido calidad, y el mismo punto sirve para la franja
ancha del proyecto y para la tarjeta del listado —que es mucho más baja— sin
pedir dos imágenes. Los valores por defecto (50, 50, 100) son exactamente un
`object-cover` centrado, así que las portadas viejas se ven igual que siempre.

**Los permisos se preguntan por capacidad, no por rol.** La UI y las acciones
preguntan `can("project.archive")`, no `role === "admin"`. Agregar un rol
intermedio más adelante no obliga a tocar cada pantalla.

---

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | Next.js 15 (App Router, Server Actions) | Un solo proceso, datos en el servidor, mutaciones sin API intermedia |
| Base | Prisma + SQLite con migraciones | Cero infraestructura en desarrollo; el esquema ya es portable a Postgres |
| Estilos | Tailwind CSS v4 | Tokens en CSS, sin archivo de configuración |
| UI | Radix + cmdk + dnd-kit | Accesibilidad y foco resueltos por piezas probadas |
| Auth | Propia (cookie + tabla de sesiones) | La base guarda el hash del token, no el token |
| Archivos | Disco local tras una interfaz | `src/server/storage.ts` expone `put`/`get`/`urlFor`: mover a S3 es cambiar ese archivo |
| Markdown | remark + rehype con `rehype-sanitize` | El léeme se guarda como texto plano; el HTML se arma en el servidor y pasa por una lista blanca |

---

## Migraciones y operación

El esquema vive en `prisma/migrations/` (nada de `db push`):

- `0000_baseline`: el esquema anterior, como punto de partida del historial.
- `0001_single_team`: `Workspace` → `Team` (conservando el id), elimina las 10
  columnas `workspaceId` y las dos de visibilidad, y vuelve la membresía
  global. Borra tablas y columnas copiando datos: nunca se usa `--force-reset`.

El entrypoint del contenedor arranca bases nuevas con `migrate deploy` + seed y
bases existentes marcando el baseline como aplicado (`migrate resolve`) antes
de desplegar. El slug del equipo para las URLs históricas se configura con
`TEAM_SLUG` (por defecto `hilo`); las URLs `/w/<slug>/...` reciben un 301 a la
ruta limpia cuando el slug coincide y 404 en cualquier otro caso.

---

## Estructura

```
prisma/          esquema, migraciones, seed y el generador de PNG de los datos de ejemplo
src/lib/         vocabulario del producto (domain.ts), formato, tipos compartidos
                 (doc.ts: sintaxis del léeme y corte de los bloques :::equipo)
src/server/
  auth/          sesiones y contexto de equipo; guards por capacidad
  domain/        lógica de negocio: progreso, actividad, feed, búsqueda, proyectos
                 (doc.ts: Markdown → HTML sanitizado, recortado por audiencia)
  actions/       mutaciones validadas con Zod, contrato único ActionResult
                 (incluye propuestas y recursos compartidos)
src/components/
  ui/            primitivas: botones, campos, capas flotantes, glifos de estado
  app/           piezas del producto: shell, paleta, panel de detalle, tablero
src/app/         rutas: el grupo (app) contiene toda la app; (auth) login y alta
src/middleware.ts  redirección 301 de las URLs históricas /w/<slug>/...
```

`src/lib/domain.ts` es la fuente de verdad del vocabulario. Cualquier cambio de
estados, tipos, roles o prioridades empieza ahí.

---

## Lenguaje visual

Papel cálido en vez de blanco puro, tinta cálida en vez de negro, un solo
acento (arcilla) reservado para la acción principal de cada pantalla. Los
estados no se comunican con pastillas de colores sino con un glifo chico que
además muestra el avance; la prioridad sólo se dibuja cuando es alta o urgente,
porque marcar todo equivale a no marcar nada. Escala tipográfica compacta —13px
es el tamaño de trabajo— y bordes de un píxel en lugar de sombras.

Tema claro y oscuro, con la preferencia del sistema como valor inicial.

---

## Atajos

| Tecla | Acción |
|---|---|
| `⌘K` / `/` | Buscar en todo el equipo |
| `C` | Crear tarea, idea, nota, problema, decisión o avance |
| `⌘↵` | Guardar en cualquier compositor |
| `Esc` | Cerrar panel o diálogo |

---

## Comandos

```bash
npm run dev          # desarrollo
npm run build        # build de producción
npm run typecheck    # tipos sin emitir
npm run db:reset     # borra la base de desarrollo y la vuelve a sembrar
npm run db:studio    # explorar la base
```

---

## Conectar una IA (MCP)

Hilo expone un servidor [MCP](https://modelcontextprotocol.io) (Streamable HTTP) en
`/api/mcp` para que cualquier IA —Claude, Cursor, opencode, etc.— lea y escriba lo
mismo que el equipo ve en la app: proyectos, tareas, ideas, notas, problemas,
decisiones, propuestas, recursos y guías de integración. La IA actúa como el usuario
del token: cada llamada de escritura corre la misma server action que un click en la
UI, con el mismo chequeo de rol (`requireTeamAction`) y la misma actividad en el feed.

### 1. Crear un token

1. Entrá como admin y andá a **Ajustes → Acceso por API**.
2. Elegí la expiración y creá el token: se muestra **una sola vez**, guardalo.
3. La misma sección muestra la URL del endpoint.

Los tokens se guardan en la base como hash (nunca el valor crudo), vencen solos y se
revocan en cualquier momento desde la misma sección. Un token creado antes de la
migración a `Team` sigue siendo válido: su id (el hash) no cambia.

### 2. Conectar un cliente

**opencode** (`~/.config/opencode/opencode.json` o el `opencode.json` del proyecto):

```json
{
  "mcp": {
    "hilo": {
      "type": "remote",
      "url": "https://<tu-hilo>/api/mcp",
      "headers": { "Authorization": "Bearer {env:HILO_TOKEN}" },
      "enabled": true
    }
  }
}
```

Exportá el token y reiniciá opencode: `export HILO_TOKEN="<token>"`.

**Claude Code**:

```bash
claude mcp add --transport http hilo https://<tu-hilo>/api/mcp \
  --header "Authorization: Bearer <token>"
```

Verificá con `claude mcp list` (debería decir `✔ Connected`). También se puede
configurar en un `.mcp.json` en la raíz del proyecto.

**Claude Desktop**: agregá el servidor en `claude_desktop_config.json` (en
`~/Library/Application Support/Claude/` en macOS, `%APPDATA%\Claude\` en Windows o
`~/.config/Claude/` en Linux) con `type: "http"`, la URL y el header `Authorization`.

### 3. Qué puede hacer la IA

**Lectura**

| Tool | Qué lee |
|---|---|
| `hilo_list_projects` / `hilo_get_project` | proyectos y subproyectos |
| `hilo_list_items` / `hilo_get_item` | tareas, ideas, notas, problemas, decisiones y avances (con filtros) |
| `hilo_list_proposals` | propuestas del buzón con sus conversaciones |
| `hilo_list_resources` | biblioteca de recursos y guías de integración |
| `hilo_list_people` | quiénes son del equipo y qué hacen |
| `hilo_get_feed` | actividad reciente del equipo |
| `hilo_search` | búsqueda global |

**Escritura** — mismo permiso que la persona dueña del token tendría en la app:

| Área | Tools |
|---|---|
| Elementos | `hilo_create_item`, `hilo_update_item`, `hilo_set_item_status`, `hilo_set_item_progress`, `hilo_set_item_assignees`, `hilo_convert_item_to_task`, `hilo_move_item`, `hilo_delete_item`, `hilo_recompute_project` |
| Proyectos | `hilo_create_project`, `hilo_update_project`, `hilo_set_project_status`, `hilo_restore_project`, `hilo_set_project_progress`, `hilo_set_project_cover_framing`, `hilo_set_project_members`, `hilo_add_project_link`, `hilo_remove_project_link`, `hilo_delete_project` |
| Comentarios | `hilo_add_comment`, `hilo_edit_comment`, `hilo_delete_comment` |
| Propuestas | `hilo_create_proposal`, `hilo_reply_to_proposal`, `hilo_triage_proposal`, `hilo_promote_proposal` |
| Recursos | `hilo_create_resource`, `hilo_delete_resource` |
| Léeme del proyecto | `hilo_save_project_doc`, `hilo_preview_project_doc` |
| Archivos | `hilo_upload_files`, `hilo_upload_project_cover`, `hilo_delete_attachment` (los archivos van en base64: `{filename, mimeType, base64}`, hasta 10 MB decodificados) |
| Equipo | `hilo_update_team`, `hilo_add_member`, `hilo_set_member_role`, `hilo_remove_member`, `hilo_mark_read` |
| Perfil | `hilo_update_profile` |

No expuesto por MCP, a propósito: alta de cuenta, login/logout, cambio de contraseña,
creación/revocación de tokens de API (un token no puede acuñar tokens) y el ping de
presencia (`touchVisit`).

### 4. Límites y seguridad

- Lectura y escritura: cada tool de escritura corre la misma server action y el mismo
  chequeo de rol que la UI. Una cuenta de comunidad conectada por MCP tiene las mismas
  limitaciones que tendría en el navegador (por ejemplo, no puede crear proyectos ni
  gestionar el equipo).
- 120 pedidos por minuto por token.
- El token equivale a una credencial del equipo: mantenelo fuera de repositorios y
  revocá cualquier token que se filtre. Si el usuario del token pierde la membresía,
  las llamadas reciben 403.