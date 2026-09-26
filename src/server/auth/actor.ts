import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import type { SessionUser } from "@/server/auth/session";

/**
 * Contexto de "actor" para requests sin cookie (el servidor MCP, autenticado
 * por token de API).
 *
 * `getCurrentUser()` consulta este store antes que la cookie de sesión: si
 * hay un actor seteado, es el usuario que ya autenticó `/api/mcp` contra la
 * fila `ApiToken` y la cookie ni se toca. Fuera de un request de MCP el store
 * está vacío y el flujo de cookie de siempre sigue intacto.
 *
 * Con esto, `getTeamContext()` (que llama a `getCurrentUser()`) resuelve la
 * membership y el rol del actor con la MISMA query que usa la app, así el
 * chequeo de capacidades de cada server action (`requireTeamAction`) sigue
 * siendo la única fuente de verdad — nunca se duplica en la capa de MCP.
 *
 * Nota sobre `React.cache()`: `getCurrentUser` y `getTeamContext` están
 * envueltos en `cache()` de `react`. Se verificó con la versión instalada acá
 * (react@19.2): fuera de un render de React —que es el caso de un Route
 * Handler de Next.js, incluido `/api/mcp`— `cache()` NO memoiza; cada llamada
 * ejecuta la función de nuevo. Por eso no hay riesgo de que el actor de un
 * request se filtre al siguiente request concurrente a través de ese caché:
 * simplemente no hay memoización activa afuera del árbol de React. El costo
 * es una query de más por lectura (ninguna deduplicación dentro del mismo
 * request), no una fuga de datos entre requests.
 */
export const actorStore = new AsyncLocalStorage<SessionUser>();
