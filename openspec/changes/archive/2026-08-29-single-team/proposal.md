# Proposal: single-team (one team per instance, public read)

## Intent

Multi-workspace today: `/w/[slug]` pages, `workspaceId`-scoped queries, login-gated content. Demanded by the community proposal "Hacer que hilo.becode sea solo nuestro": one team per instance, unregistered public read, register-to-participate. Removes multi-tenancy, makes content public, ships real Prisma migrations (prod runs `db push`).

## Scope

### In Scope
- Singleton `Team` reusing the workspace id; drop `Workspace`, all `workspaceId` + both `visibility` columns
- Global `Membership @@unique([userId])`; signup auto-joins `community`; delete `nuevo-equipo`
- `getTeamContext()` (guest) + `requireTeamAction(capability)`; public pages with Login/Registrate CTAs; public files
- Migrations `0000_baseline` + `0001_single_team`; entrypoint `migrate resolve` bootstrap; never `--force-reset`; flatten routes
- `middleware.ts` 301 `/w/hilo/*`; MCP tokens keep working

### Out of Scope
Multi-team support (removed), new test runner, role-promotion UX, assignee-scope semantics

## Capabilities

### New Capabilities
- `team-access`: singleton team identity, global membership, guest public read, write-action guards

### Modified Capabilities
- `mcp-server`: token context resolves the team; membership check global
- `mcp-read-tools`: drop workspace scoping + visibility enforcement
- `api-tokens`: drop `workspaceId`; settings UI on clean route

## Approach

Approach A (exploration): `Team.id` = existing workspace id; storage keys + `ApiToken` values unchanged, zero file moves, no token reissue (R2/R3). Baseline via `migrate diff`; entrypoint: `migrate resolve --applied 0000_baseline` on db-push DBs, then `migrate deploy` (R1). SQLite-safe DDL. Legacy 301 via `middleware.ts` (R4).

## Affected Areas

- Modified: `prisma/schema.prisma`, `seed.ts` (Workspace→Team, 11 `workspaceId` + 2 visibility columns dropped, upsert Team)
- New: `prisma/migrations/` (`0000_baseline`, `0001_single_team`); Modified: `docker-entrypoint.sh` (resolve bootstrap, remove `db push`)
- Modified: `src/server/auth/*`, `actions/*` (team context, auto-join signup, `requireTeamAction`, ~10 actions)
- Removed: `src/app/w/[slug]/**`, `nuevo-equipo` (flattened clean routes)
- New/Modified: `src/server/{storage,mcp}/`, `domain/*`, `middleware.ts` (public files, team scope, 301)

## Risks

- R1 (Med): prod migration bootstrap fails (resolve-before-deploy; test on `prod.db` copy; never `--force-reset`)
- R2 (Low): attachment 404s if team id changes (reused id: zero moves)
- R3 (Low): MCP tokens invalidated (id preserved; post-deploy MCP smoke test)
- R5 (Med): visibility dropped inconsistently, 4 sites (one commit removes all)
- R6 (Med): files become public (deliberate per PO; documented in design)
- R8 (High): ~55 files > 800 lines (sdd-tasks foresees chained PRs)

## Rollback Plan

- Pre-deploy: Coolify snapshot (`prod.db` + `storage/`); migration tested on a copy; Prisma CLI only
- R1: revert entrypoint + migrations; restore snapshot; no destructive DDL ran
- R2/R3: keys/tokens untouched by design; revert `mcp/` + `storage.ts` alone if broken
- General: single-PR revert

## Success Criteria

- Fresh DB deploys one team, no workspace-creation path; typecheck + build
- Guests read all public routes + files; writes → UNAUTHENTICATED
- Signup → `community`; admin promotion unchanged
- `prod.db` copy: zero data loss; `/w/hilo/*` → 301; ApiToken + storage URLs unchanged