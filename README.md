# Hilo

Punto de encuentro entre una comunidad educativa y el equipo que construye sus
aplicaciones.

Hilo combina dos experiencias en el mismo lugar: quienes desarrollan conservan
la gestión de proyectos, tareas, responsables, problemas y decisiones; quienes
no trabajan con el código pueden seguir los proyectos publicados, conversar con
el equipo y proponer necesidades. La intención es que nadie pierda el contexto
ni tenga que encontrar a la persona correcta por otro canal.

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

`setup` genera el cliente de Prisma, crea la base SQLite y carga datos de
ejemplo. Después, entrar en <http://localhost:3000/login>:

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

**Dos superficies, un solo producto.** `admin` y `developer` gestionan trabajo;
`community` participa. Cada proyecto define si lo ve toda la comunidad o solo
el equipo. El mismo control se aplica al listado, al acceso directo y a las
acciones del servidor, por lo que una URL conocida no salta la privacidad.

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
| Base | Prisma + SQLite | Cero infraestructura en desarrollo; el esquema ya es portable a Postgres |
| Estilos | Tailwind CSS v4 | Tokens en CSS, sin archivo de configuración |
| UI | Radix + cmdk + dnd-kit | Accesibilidad y foco resueltos por piezas probadas |
| Auth | Propia (cookie + tabla de sesiones) | La base guarda el hash del token, no el token |
| Archivos | Disco local tras una interfaz | `src/server/storage.ts` expone `put`/`get`/`urlFor`: mover a S3 es cambiar ese archivo |

---

## Estructura

```
prisma/          esquema, seed y el generador de PNG que usan los datos de ejemplo
src/lib/         vocabulario del producto (domain.ts), formato, tipos compartidos
src/server/
  auth/          sesiones y guards de workspace por capacidad
  domain/        lógica de negocio: progreso, actividad, feed, búsqueda, proyectos
  actions/       mutaciones validadas con Zod, contrato único ActionResult
                 (incluye propuestas y recursos compartidos)
src/components/
  ui/            primitivas: botones, campos, capas flotantes, glifos de estado
  app/           piezas del producto: shell, paleta, panel de detalle, tablero
src/app/         rutas
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
| `⌘K` / `/` | Buscar en todo el workspace |
| `C` | Crear tarea, idea, nota, problema, decisión o avance |
| `⌘↵` | Guardar en cualquier compositor |
| `Esc` | Cerrar panel o diálogo |

---

## Comandos

```bash
npm run dev          # desarrollo
npm run build        # build de producción
npm run typecheck    # tipos sin emitir
npm run db:reset     # vaciar y volver a sembrar
npm run db:studio    # explorar la base
```
