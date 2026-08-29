# Design: single-team (one team per instance, public read)

## Technical Approach

Approach A (locked): singleton `Team` row reusing the pre-existing workspace id — storage keys (`<teamId>/<hash>`) and `ApiToken` rows keep their values (zero file moves, zero reissue). `Workspace` + all `workspaceId` columns die; `Membership` becomes global (`@@unique([userId])`); both `visibility` columns die at all four sites in one commit (README "Decisiones de arquitectura": one public instance, capability-gated writes). Routes flatten under `(app)`; `middleware.ts` 301s `/w/hilo/*`; migrations `0000_baseline` + `0001_single_team` replace `db push` (specs: team-access, mcp-server, mcp-read-tools, api-tokens).

## Architecture Decisions

| Decision | Options (tradeoff) | Choice |
|---|---|---|
| Team identity | A: singleton `Team` — B: env constant — C: keep `Workspace` | **A** (locked) |
| Files public | Drop membership gate vs. keep | **Drop gate** (locked); keep storageKey→attachment lookup; `Cache-Control: public` |
| Visibility removal | All 4 sites one commit (projects.ts `projectAccess`, comments.ts, mcp `visibleProjectIds`, search `filterVisibleHits`) vs. staged (leaks) | **All together**; `projectAccess` → `teamScope()` marker (R5) |
| API token scoping | Keep `workspaceId` vs. drop | **Drop both `workspaceId`/`teamId`**: token + membership resolve the team |
| Legacy redirect | `middleware.ts` vs. catch-all page | **middleware.ts** 301; foreign slugs → 404 |
| Migrations | diff baseline + 0001 vs. `--force-reset` | **`0000_baseline` + `0001_single_team`**; entrypoint resolve-bootstrap (R1) |
| Storage signature | `put(file, teamId)` vs. `put(file)` reading DB | **`put(file: File, teamId)`**; key stays `` `${teamId}/${id}${ext}` `` |
| Guest shell | Public shell + Login/Registrate CTAs vs. login bounce | **Public shell**; guest `can() → false` |

Domain effects (config rule): `progress.ts` roll-up is keyed by project id — unchanged. Fan-out (`activity.ts`/`feed.ts`): `workspaceId` param/filter dropped; audience logic + `assigneeScope "team"` untouched (rows become instance-global). `dashboard.ts` drops the filter.

## Data Flow

```
Browser → middleware (301 /w/hilo/<rest>; other slug → 404) → (app)/layout getTeamContext()
        → pages: domain/* (no workspaceId/visibility filter)
        → actions: requireTeamAction(cap) → {ok:false} for guests
MCP → /api/mcp → getTokenContext(hash) → global membership → team-scoped tools
GET /api/files/<teamId>/<hash> → storageKey lookup (no membership) → storage.get(key)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | Modify | `Team` {id,name,slug,mission}; delete `Workspace`, 10 `workspaceId` columns, both `visibility` columns; `Membership @@unique([userId])`; `ApiToken` unbinds ws |
| `prisma/migrations/0000_baseline/`, `0001_single_team/` | Create | Baseline = current schema (`migrate diff --from-empty`); 0001 = `Workspace`→`Team` rename (id preserved) + drops (verified on prod.db copy) |
| `prisma/seed.ts` | Modify | Upsert Team (`TEAM_ID = "hilo"`), drop `workspaceId` (~100 sites), global memberships, `put(file, TEAM_ID)`, hint → `/` |
| `docker-entrypoint.sh`, `package.json` | Modify | Fresh: `migrate deploy`+seed; existing: `deploy \|\| true` → `resolve --applied 0000_baseline` → `deploy`; remove `db push`; `setup`/`db:reset` migrate-based |
| `middleware.ts` | Create | Matcher `"/w/:slug/:path*"`; slug === `TEAM_SLUG` (env, default `"hilo"`) → 301 `/<rest>` (`/w/hilo` → `/`); else 404 |
| `src/server/auth/context.ts` | Modify | `getTeamContext()` (guest-safe), `requireTeamAction(cap)` (throws `UNAUTHENTICATED`); delete `defaultWorkspaceSlug`, `requireWorkspace*` |
| `src/server/auth/token.ts` | Modify | `team` replaces `workspace`; membership `findUnique({userId})`; `createApiToken({userId, expiresAt})` |
| `src/server/actions/*` | Modify | `requireTeamAction(cap)`, `revalidateTeam()` → `revalidatePath("/","layout")`; signup auto-joins (admin if first member) → `/`; delete `createWorkspace`, workspaceName |
| `src/server/domain/*` (projects, search, feed, activity, dashboard, resources) | Modify | Drop `workspaceId` args/filters; `teamScope()` marker; clean search URLs |
| `src/server/mcp/{tools,visibility}.ts` | Modify/Delete | `c.workspace`→`c.team`; drop `visibleProjectIds`/`filterVisibleHits`, proposal visibility branch, `PROJECT_VISIBILITIES`; delete `visibility.ts` |
| `src/server/storage.ts` | Modify | `put(file, teamId)`; `get`/`urlFor` unchanged |
| `src/app/api/files/[...path]/route.ts` | Modify | Remove user/membership check; `Cache-Control: public` |
| `src/app/w/[slug]/**` (18) | Move | → `(app)/`: `/`, `/proyectos`, `/archivo`, `/ideas`, `/recursos`, `/buscar`, `/novedades`, `/mi-trabajo`, `/perfil`, `/ajustes`, `/gente/[userId]`, `/p/[projectId]/{page,tareas,espacio,historial,archivos,integracion,layout}` |
| `src/app/nuevo-equipo/**` | Delete | Obsolete |
| `src/components/app/*` (shell, sidebar, command-palette, search-box, activity, news-strip, project-card, project-header, item-panel, member-list, new-project, proposals-board, resource-library, project-tabs, quick-create, api-tokens) | Modify | Drop `slug` prop; clean hrefs; shell: `user` nullable, guest Login/Registrate, hide write/search for guest |
| `(auth)/signup`, `(auth)/login` | Modify | Drop workspaceName field; redirect `/` |

## Interfaces / Contracts

```ts
type TeamContext = { user: SessionUser | null; team: { id; name; slug; mission };
  role: string; membershipId: string | null; lastSeenAt: Date | null; can: (c: Capability) => boolean };
const getTeamContext = cache(async (): Promise<TeamContext>);            // guest-safe
async function requireTeamAction(cap?: Capability): Promise<TeamContext>; // throws "UNAUTHENTICATED"
```
Guest = `user: null`, `role "guest"`, `can() → false`.

## Testing Strategy

No runner (typecheck + build). Checklist: guest loads `/`, `/proyectos`, `/p/[id]`, `/ideas`, `/recursos`, `/buscar`; guest action → `{ok:false}`; `curl -I` `/w/hilo/proyectos` → 301, `/w/otro/x` → 404; seed → one Team; file 200 / missing 404; MCP token valid on prod.db copy pre/post migration; signup → community, first user → admin.

## Threat Matrix

| Boundary | Applicability | Design response | Verification |
|---|---|---|---|
| Documentation-like paths; Git/Commit/Push/PR rows | N/A — no VCS automation, no executable files | — | — |
| Routing (middleware) | Applicable | team slug → 301 `/<rest>`; other slugs → 404; never render under `/w/` | `curl -I` per case |
| Process integration (entrypoint) | Applicable | `set -e`; resolve-bootstrap before deploy; never `--force-reset`; failure = container won't start (loud, no data loss) | Fresh volume + prod.db copy boot |

## Migration / Rollout

`migrate diff --from-empty` → `0000_baseline`; edit schema; author `0001_single_team`; verify both on a `prod.db` copy; snapshot Coolify volume. Deploy: fresh → `migrate deploy`+seed; db-push DB → resolve + deploy (R1). Smoke: MCP token, storage URL, `/w/hilo/*` 301. Rollback: single-PR revert + snapshot; no destructive DDL. Archive: merge `mcp-server`/`mcp-read-tools`/`api-tokens` deltas into `openspec/specs/*`; add `specs/team-access/`.

## Open Questions

- [ ] Prod team slug for `TEAM_SLUG` (default `"hilo"`; verify at deploy).
- [ ] Seed `TEAM_ID` literal `"hilo"` vs. prod migrated cuid — format parity only; confirm acceptable.