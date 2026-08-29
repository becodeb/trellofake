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
copiarlas para otra persona o una IA. Tokens y contraseñas quedan fuera.

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
src/server/
  auth/          sesiones y contexto de equipo; guards por capacidad
  domain/        lógica de negocio: progreso, actividad, feed, búsqueda, proyectos
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
`/api/mcp` para que cualquier IA —Claude, Cursor, opencode, etc.— pueda leer lo que el
equipo subió: proyectos, tareas, ideas, notas, problemas, decisiones, propuestas,
recursos y guías de integración. El acceso es de solo lectura: la IA ve el equipo
entero (el contenido es público) y el rol del token gobierna qué operaciones podría
permitir el contrato.

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

| Tool | Qué lee |
|---|---|
| `hilo_list_projects` / `hilo_get_project` | proyectos y subproyectos |
| `hilo_list_items` / `hilo_get_item` | tareas, ideas, notas, problemas, decisiones y avances (con filtros) |
| `hilo_list_proposals` | propuestas del buzón con sus conversaciones |
| `hilo_list_resources` | biblioteca de recursos y guías de integración |
| `hilo_list_people` | quiénes son del equipo y qué hacen |
| `hilo_get_feed` | actividad reciente del equipo |
| `hilo_search` | búsqueda global |

### 4. Límites y seguridad

- Solo lectura: ninguna tool muta datos.
- 120 pedidos por minuto por token.
- El token equivale a una credencial del equipo: mantenelo fuera de repositorios y
  revocá cualquier token que se filtre. Si el usuario del token pierde la membresía,
  las llamadas reciben 403.