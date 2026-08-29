```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:d4c92cfec5168b0dcb448658c80778f516be05b43b3a3fddcb2f34dded5c3fe0
verdict: pass
blockers: 0
critical_findings: 0
requirements: 16/16
scenarios: 28/28
test_command: npm run typecheck
test_exit_code: 0
test_output_hash: sha256:ff00ba817e9dffe9f2c9cb90acd1a2b635f1ef3be79d10607a5c4c5d2bd5b757
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:bca7af171cb987fc82ce720a127afec867838b1be44120e6e395b7bbfaf6f300
```

## Verification Report

**Change**: single-team (one team per instance, public read)
**Version**: delta specs at 521ba79 (7 commits: c0d774a, 5464199, 2c09f53, bf1b4b1, 2691278, 7f5051e, 521ba79)
**Mode**: Standard (strict_tdd false; no test runner in project)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 28 |
| Tasks complete | 28 |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Build**: ✅ Passed (twice: gate run + rebuild after dev-server run; both exit 0)
```text
npm run build  → prisma generate OK (v6.19.3), next build ✓ Compiled successfully in 12.7s,
16/16 static pages generated; 23 routes served at clean paths (/, /proyectos, /p/[projectId]/*,
/ideas, /recursos, /buscar, /gente/[userId], /ajustes, /api/files/[...path], /api/mcp);
ƒ Middleware present; no /w/ route, no /nuevo-equipo route.
```

**Tests**: ✅ No test runner (strict TDD false). Verification gates executed: `npm run typecheck` (exit 0), `npx prisma validate` (schema valid, exit 0), plus live HTTP evidence below against a dev server (port 3010) and production server (`next start`, ports 3011/3012), all on throwaway DB copies in /tmp — the real `prisma/dev.db` was never touched.

**Coverage**: ➖ Not available (no coverage tooling in project).

### Spec Compliance Matrix

#### team-access/spec.md (7 requirements, 14 scenarios)

| Requirement | Scenario | Test / Evidence | Result |
|-------------|----------|-----------------|--------|
| Singleton team identity | Fresh instance deploys one team | Fresh DB `migrate deploy` + seed → `TEAMS: 1` (id "hilo", slug "hilo"); storage dirs created under team id | ✅ PASS |
| Singleton team identity | Legacy identity is preserved | Copied dev.db: `Team.id = cmtdlqa0z0004yq4r1mgcjtmp` (legacy workspace id); 5 Attachment storageKeys `<teamId>/<hash>` untouched and resolvable; migration 0001 preserves id by design | ✅ PASS |
| Global membership | One membership per user | Schema `Membership @@unique([userId])`, no workspaceId; copied DB 4 users / 4 memberships (1:1); promotion updates the single global row | ✅ PASS |
| Global membership | Promotion is an admin action | Live: community `setMemberRole` → `{ok:false}` "Tu rol no permite esta acción."; admin `setMemberRole(alma, developer)` → `{ok:true}`; DB role changed on the global membership | ✅ PASS |
| Guest public read | Guest browses read-only | Live no-cookie GET: `/` 200, `/proyectos` 200, `/p/[projectId]` 200, `/ideas` 200, `/recursos` 200, `/buscar` 200; shell renders Ingresar/Registrarte CTAs (href /login, /signup) instead of write controls | ✅ PASS |
| Guest public read | All writes denied to guest | Live: guest POST `updateProfile` → `{ok:false}` + "Necesitás iniciar sesión para hacer esto."; guest POST `createProject` → `{ok:false}` same message (UNAUTHENTICATED mapped by `run()`) | ✅ PASS |
| Public files | Guest downloads an attachment | Live GET `/api/files/cmtdlqa0z.../b3447c460f5fd16d.png` → 200 image/png, `Cache-Control: public, max-age=31536000, immutable`, no cookie | ✅ PASS |
| Public files | Missing file | Live GET random key → 404; path-traversal attempt → 404 | ✅ PASS |
| Write-action capability guards | Community role is write-limited | Live: community `createProject` → `{ok:false}` "Tu rol no permite esta acción."; community `addComment` → `{ok:true}` (comment.write works); static: ROLE_CAPABILITIES community = [comment.write] only | ✅ PASS |
| Write-action capability guards | Admin passes the guard | Live: admin `createProject` → `{ok:true}` + created project id | ✅ PASS |
| Auto-join on signup | New signup joins the team | Live: POST signup action (fresh email) → 303 Location / + session cookie; user + membership role `community` created; signup HTML has no workspaceName field (static forms: name/email/password only) | ✅ PASS |
| Auto-join on signup | First user bootstraps as admin | Live: on empty migrated DB, first signup → membership role `admin` (count 1) | ✅ PASS |
| Flattened routes with legacy redirect | Legacy URL redirects | Live: `/w/hilo/proyectos` → 301 `Location: /proyectos`; `/w/hilo/p/<id>` → 301 `/p/<id>`; `/w/hilo` → 301 `/` | ✅ PASS |
| Flattened routes with legacy redirect | Foreign slug yields no content | Live: `/w/otro/x` → 404 | ✅ PASS |

#### mcp-server/spec.md (RENAMED 1 + MODIFIED 2, 4 scenarios)

| Requirement | Scenario | Test / Evidence | Result |
|-------------|----------|-----------------|--------|
| RENAMED: Token-derived workspace scoping → team scoping | (rename) | README/MCP docs reference the single team ("Una instancia = un equipo"); `src/server/mcp/tools.ts` comment: "no hay filtro de workspace"; schema has 0 workspaceId columns | ✅ PASS |
| Bearer token authentication | Valid token | Live Streamable HTTP session on `/api/mcp`: initialize 200, `tools/list` 200 (9 `hilo_*` tools) | ✅ PASS |
| Bearer token authentication | Expired or revoked token | Live: unknown → 401, revoked → 401, expired → 401, missing header → 401, all before any tool call | ✅ PASS |
| Bearer token authentication | Token user removed from the team | Live: token bound to a user WITHOUT membership → 403 (not 401) | ✅ PASS |
| Token-derived team scoping | Token resolves the singleton team | Live tool calls return the singleton team's data (project/item ids from the team); code: `getTokenContext` derives team from `db.team.findFirst`, no workspaceId filter | ✅ PASS |

#### mcp-read-tools/spec.md (MODIFIED 3 + REMOVED 1, 5 scenarios)

| Requirement | Scenario | Test / Evidence | Result |
|-------------|----------|-----------------|--------|
| Tool coverage | tools/list enumerates the read tools | Live `tools/list`: 9 tools — hilo_list_projects, hilo_get_project, hilo_list_items, hilo_get_item, hilo_list_proposals, hilo_list_resources, hilo_list_people, hilo_get_feed, hilo_search, with input schemas | ✅ PASS |
| Tool coverage | Tree includes subprojects | Live `hilo_get_project`(Lumen) → response contains children Frontend, Backend y API, Panel de administración (6339-byte tree) | ✅ PASS |
| Tool coverage | Item filters cover all six types | Live `hilo_list_items` with `type:"task"` → only task items; static: zod `z.enum(ITEM_TYPES)` with the six ItemType values | ✅ PASS |
| Team scoping | Identifiers resolve within the team | Live `hilo_get_project`/`hilo_get_item` with real ids → full data; no workspace filter applied | ✅ PASS |
| Input validation | Invalid item type filter | Live `type:"milestone"` → `-32602` invalid-params ("Input validation error... Invalid input at type"), no query executed | ✅ PASS |
| REMOVED: Visibility enforcement | (removed) | Commit 521ba79 removes `PROJECT_VISIBILITIES`; no `visibleProjectIds`/`projectAccess` post-filters; schema drops visibility columns; MCP identical results for all roles | ✅ PASS |

#### api-tokens/spec.md (MODIFIED 2, 5 scenarios)

| Requirement | Scenario | Test / Evidence | Result |
|-------------|----------|-----------------|--------|
| ApiToken persistence model | Only the hash is stored | Schema: `ApiToken.id` = sha256 hex (Session pattern), no raw column, no workspaceId/teamId; inserted test rows stored as opaque sha256 | ✅ PASS |
| ApiToken persistence model | Expired token fails authentication | Live: expired token → 401 at /api/mcp | ✅ PASS |
| ApiToken persistence model | Existing token stays valid through the migration | Migration 0001 rebuilds ApiToken preserving id/userId/expiresAt/revoked (hash ids intact, no reissue); apply phase verified pre/post on prod.db copy | ✅ PASS |
| Token management UI | Raw token shown exactly once | Static: `api-tokens.tsx` keeps raw only in client create-result state (`created.raw`, copyable box with endpoint URL, `navigator.clipboard`); list always renders masked hash `id.slice(0,10)…`; `/ajustes` route at clean path with "Acceso por API" section | ✅ PASS |
| Token management UI | Revoked token row | Static: revoked rows render "Revocado" badge and no revoke control (button only for non-revoked); live 401 behavior of revoked tokens proven | ✅ PASS |

**Compliance summary**: 28/28 scenarios compliant (21 verified live via HTTP; 7 verified via code contract + schema/migration inspection where browser/UI automation was out of scope — noted per row).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| All mutating actions guarded | ✅ Implemented | 49 `requireTeamAction(cap)` call sites across comments/resources/proposals/item-detail/search/tokens/items/team/projects/files; auth.ts handles signup/login without guard by design |
| Guest context is write-safe | ✅ Implemented | `getTeamContext` guest-safe (role "guest", `can()` → false); `requireTeamAction` throws UNAUTHENTICATED pre-capability |
| run() maps UNAUTHENTICATED → {ok:false} | ✅ Implemented | `shared.ts` `run()` catch → `{ ok: false, error: "Necesitás iniciar sesión para hacer esto." }` |
| API tokens: sha256-only storage | ✅ Implemented | `hashToken()`; raw prefixed `hilo_`, returned once by `createApiToken` |
| MCP route contract | ✅ Implemented | POST/DELETE handlers: Bearer parse → `getTokenContext` → 401/403 → 429 rate limit (120 rpm) → session transport |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Singleton Team reusing workspace identity | ✅ Yes | id preserved in migration + verified on copy |
| Routes flattened with middleware 301/404 | ✅ Yes | `src/middleware.ts`, TEAM_SLUG env (default "hilo") |
| Public files with immutable cache | ✅ Yes | Cache-Control public + CSP sandbox + nosniff |
| Global membership @@unique([userId]) | ✅ Yes | schema + runtime behavior |
| Signup auto-join community/first-admin | ✅ Yes | memberCount === 0 → admin, else community |
| MCP team scoping without visibility | ✅ Yes | vocab/domain clean; no ws filters |

### Issues Found
**CRITICAL**: None
**WARNING**: None
**SUGGESTION**:
1. Operational: on a database migrated in place whose legacy slug is not "hilo" (e.g., local dev.db keeps "cardinal"), the deploy must set `TEAM_SLUG` to match, otherwise legacy `/w/<slug>` URLs 404 instead of 301. Already wired via docker-compose.prod.yml + documented by apply; runtime reads only the env value.
2. The project has no automated test runner; regression coverage for scenarios 9.2/9.6 remains manual (this verification performed the full live checklist).
3. `package.json#prisma` config deprecation warning (Prisma 7 migration) — cosmetic.

### Verdict
PASS — 28/28 spec scenarios verified (21 live HTTP, 7 static+DB evidence), gates green, no blockers, no critical findings.