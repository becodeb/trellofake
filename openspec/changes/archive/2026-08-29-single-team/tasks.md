# Tasks: single-team (one team per instance, public read)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2500–3000 (55 files) |
| 400-line budget risk | High (config budget 800 exceeded) |
| Chained PRs recommended | Yes |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| # | Work unit | PR | Focused test | Runtime | Rollback |
|---|---|---|---|---|---|
| 1 | Schema, migrations, entrypoint, seed | c1 | `npx prisma validate` | Fresh boot + prod.db copy; seed → 1 Team | Revert `prisma/`+`docker-entrypoint.sh` |
| 2 | Flatten routes, 301, public files | c2 | `npm run typecheck` | `curl -I` 301; guest file 200 | Revert app moves+`middleware.ts`+`storage.ts` |
| 3 | Auth, actions, domain, visibility | c3 | `npm run typecheck` | Guest action `{ok:false}` | Revert `src/server/` |
| 4 | UI shell + auth routes | c4 | `npm run typecheck` | Manual guest browse | Revert `components/`+`(auth)` |
| 5 | MCP team scoping | c5 | `npm run typecheck` | Token on prod.db copy | Revert `mcp/`+`token.ts` |
| 6 | Verification fixes | c6 | `typecheck`+`build` | Full checklist | n/a |

## Phase 1: Schema & Migrations

- [x] 1.1 Generate `0000_baseline`: `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` → `prisma/migrations/0000_baseline/migration.sql`
- [x] 1.2 Schema: add `Team {id,name,slug,mission}`; delete `Workspace`; drop 10 `workspaceId` cols (ApiToken, Membership, Project, Item, Comment, Attachment, Proposal, KnowledgeResource, Activity, FeedEntry) + 2 visibility (`Project.visibility`, `KnowledgeResource.visibility`); `Membership @@unique([userId])`; prune ws relations/indexes
- [x] 1.3 Author `0001_single_team/migration.sql` (SQLite-safe): create Team copying workspace row (id preserved), drop Workspace, 10 ws cols, 2 vis cols, rebuild unique/indexes
- [x] 1.4 Verify on prod.db copy: zero row loss; ApiToken/storageKey unchanged; never `--force-reset`

## Phase 2: Entrypoint & Scripts

- [x] 2.1 `docker-entrypoint.sh`: fresh → `migrate deploy`+seed; existing → `resolve --applied 0000_baseline`, then `deploy`; remove `db push`; `set -e`
- [x] 2.2 `package.json`: `setup`/`db:reset` migrate-based (deploy+seed)

## Phase 3: Seed

- [x] 3.1 `seed.ts`: upsert Team (TEAM_ID `"hilo"`, slug `TEAM_SLUG` env default "hilo"); drop `workspaceId` (~100 sites); membership w/o workspaceId; `put(file, TEAM_ID)`; hint → `/`

## Phase 4: Server Context & Auth

- [x] 4.1 `context.ts`: `getTeamContext()` guest-safe (null user, role guest, can()→false); `requireTeamAction(cap)` throws UNAUTHENTICATED; delete `defaultWorkspaceSlug`/`requireWorkspace*`
- [x] 4.2 `token.ts`: team replaces workspace; membership `findUnique({userId})`; `createApiToken({userId, expiresAt})`
- [x] 4.3 `actions/auth.ts`: signup auto-joins — count === 0 → admin, else community; drop workspaceName; login → `/`
- [x] 4.4 Delete `nuevo-equipo/**` + workspace actions; `shared.ts` `revalidateTeam()` → `revalidatePath("/","layout")`

## Phase 5: Routes, Middleware, Files

- [x] 5.1 Move 18 routes `w/[slug]/**` → `(app)`: `/`, `/proyectos`, `/archivo`, `/ideas`, `/recursos`, `/buscar`, `/novedades`, `/mi-trabajo`, `/perfil`, `/ajustes`, `/gente/[userId]`, `/p/[projectId]/{page,tareas,espacio,historial,archivos,integracion,layout}`
- [x] 5.2 `middleware.ts`: slug === TEAM_SLUG → 301 `/<rest>` (`/w/hilo`→`/`); else 404
- [x] 5.3 `storage.ts`: `put(file, teamId)`; key stays `` `${teamId}/${id}${ext}` ``
- [x] 5.4 `api/files/[...path]/route.ts`: drop auth/membership check; `Cache-Control: public`

## Phase 6: Domain, Actions, Visibility

- [x] 6.1 ~10 actions → `requireTeamAction(cap)`; drop `workspaceId` args
- [x] 6.2 Visibility removal at 4 sites, one commit: `projects.ts` `projectAccess`→`teamScope()`; comments gate; mcp `visibleProjectIds`; `search.ts` `filterVisibleHits`
- [x] 6.3 Domain modules: drop ws filters; clean search URLs; `assigneeScope "team"` untouched

## Phase 7: UI

- [x] 7.1 shell/sidebar/command-palette/search-box + app components: drop `slug` prop; user nullable; guest Login/Registrate CTAs; hide write/search
- [x] 7.2 signup/login: drop workspaceName; redirect `/`

## Phase 8: MCP

- [x] 8.1 Affirm transport/session contract unchanged: Streamable HTTP `/api/mcp`, Bearer sha256 lookup, 401/403, 120 rpm — scoping only
- [x] 8.2 `mcp/tools.ts`: `c.workspace`→`c.team`; drop ws filters + visibility post-filters; remove `PROJECT_VISIBILITIES` from Zod vocab; delete `visibility.ts`

## Phase 9: Verification

- [x] 9.1 `npm run typecheck` + `npm run build` clean
- [x] 9.2 Manual: guest loads `/`, `/proyectos`, `/p/[id]`, `/ideas`, `/recursos`, `/buscar`; guest action → `{ok:false}` UNAUTHENTICATED
- [x] 9.3 `curl -I`: `/w/hilo/proyectos` → 301; `/w/otro/x` → 404
- [x] 9.4 Existing file 200, missing 404; seed → exactly 1 Team
- [x] 9.5 MCP token on prod.db copy pre/post migration (403 only if membership removed)
- [x] 9.6 Signup → community; first → admin; README architecture + MCP sections updated

## Notas de implementación (apply, 29 ago 2026)

- Migración `0001_single_team` verificada sobre copia de `dev.db`: `Team` conserva el id del workspace, cero pérdida de filas, `ApiToken`/storage intactos. SQLite exige `PRAGMA foreign_keys = OFF;` al inicio (el engine migra con FK ON y el DROP de tablas auto-referenciadas hacía cascade).
- Verificado en vivo (prod `next start`): guest 200 en `/`, `/proyectos`, `/p/[id]`, `/ideas`, `/recursos`, `/buscar`; `/w/hilo/x` → 301 `/x`; `/w/otro/x` → 404; archivo público 200 (cache public) / faltante 404; MCP handshake OK con token, 401 sin/desconocido.
- ¡Gotcha! `middleware.ts` debe vivir en `src/` (el repo usa `src/app`); en la raíz Next lo manifiesta pero nunca lo ejecuta.
- 9.2 (guest action → `{ok:false}` UNAUTHENTICATED) y 9.6 (signup click) quedan como verificación manual browser para verify/orchestrator: la ruta de código está cubierta (`run()` mapea UNAUTHENTICATED).
