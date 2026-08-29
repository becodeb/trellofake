# Tasks: Hilo MCP Server — read-only AI access per team

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750–900 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Foundations (schema→actions) | PR 1 | `typecheck && db:push` | N/A — no UI yet; db:studio hash check | Revert schema/domain.ts; delete 2 files |
| 2 | MCP: visibility, tools, route | PR 2 | `typecheck && build` | curl /api/mcp (tsx-made token) | Delete mcp/ + api/mcp/ |
| 3 | Settings UI section | PR 3 | `build` | Browser create/revoke | Remove component + section |

## Phase 1: Foundation — schema & deps

- [x] T1.1 `prisma/schema.prisma`: add ApiToken (sha256-hex id, workspaceId, userId, expiresAt, revoked @default(false), createdAt, relations+indexes) ✓ `npx prisma db push` + generate pass (repo convention: db push).
- [x] T1.2 `src/lib/domain.ts`: add `api-tokens.create` + `api-tokens.revoke` to CAPABILITIES ✓ admin auto-granted, community lacks them, typecheck.
- [x] T1.3 `package.json`: add `@modelcontextprotocol/sdk@1.30.0` exact ✓ `npm ls`; typecheck.

## Phase 2: Token auth & server actions

- [x] T2.1 Create `src/server/auth/token.ts`: hashToken (sha256 hex, Session pattern), createApiToken (`hilo_`+32B base64url, raw returned once), getTokenContext(raw) → TokenContext (workspaceId, role, can()) ✓ lookup by hash only; unknown/expired/revoked → 401; membership gone → 403.
- [x] T2.2 Create `src/server/actions/tokens.ts`: create (Zod expiresAt; missing/past rejected) + revoke (unknown id rejected) via run()/ActionResult, gated by requireWorkspaceAction(..., "api-tokens.create"|"api-tokens.revoke") ✓ incapable role blocked.

## Phase 3: MCP server

- [x] T3.1 Create `src/server/mcp/visibility.ts`: visibleProjectIds(ws, viewer) via viewer-aware listProjects, filterVisibleHits, toWire (strip storageKey; Dates → ISO).
- [x] T3.2 Create `src/server/mcp/tools.ts`: 9 hilo_* tools, Zod from domain vocab (take ≤100): list_projects, get_project, get_item (post-check visibleIds), list_items (projectIds ∩ visibleIds; foreign projectId → []), list_proposals, list_resources (pid ∈ visibleIds), list_people, get_feed (visibleIds for community), search (post-filter) ✓ list_proposals pins workspaceId from ctx ONLY; includes replies; targetProject when roleCan("content.write") or community-visible.
  - [x] T3.2-REMEDIATION (verify CRITICAL-1, commit 02fccc2): `hilo_list_items` unfiltered branch now scopes non-team tokens: no `projectId` + non-team role → `projectIds = Array.from(await visibleProjectIds(...))` (same pattern as `hilo_get_feed`). Live re-check (fresh seed, port 3010): community token `hilo_list_items {}` → 41 items (6/8 projects, 0 non-visible leaks, team-only items absent) vs admin 45 incl. 4 team-only (control); `type:"task"` + scoped projectIds still honored; 401/403 checks unchanged; sessions DELETE 200 / unknown 404. DB restored pristine (tokens 0, workspaces 1, users 4, projects 8, items 45).
- [x] T3.3 Create `src/app/api/mcp/route.ts`: runtime="nodejs"; Bearer → getTokenContext; Mcp-Session-Id registry; StreamableHTTPServerTransport + McpServer; POST + DELETE; in-process 120 req/min/token → 429 (per-process); 401/403/400; SDK -32601/-32602/-32002/-32603.

## Phase 4: Settings UI

- [x] T4.1 Create `src/components/app/api-tokens.tsx`: create form (expiry); once-only raw-token + MCP URL box (location.origin+"/api/mcp"); rows: masked hash, expiry, revoked; revoke disabled when revoked.
- [x] T4.2 `src/app/w/[slug]/ajustes/page.tsx`: render "Acceso por API" section (page already gated).

## Phase 5: Verification

- [x] T5.1 `npm run typecheck` + `npm run build` green.
- [x] T5.2 curl /api/mcp: initialize → 200 + tools; expired/revoked/unknown → 401; non-member → 403; pre-init call → -32000 ("Server not initialized"); unknown tool → -32602 error result ("Tool not found"); `type:"milestone"` → -32602; W2 identifiers yield no data; community excludes team content; proposals → replies; rapid calls → 429; hash-only stored.
- [ ] T5.3 POST-MERGE FOLLOW-UP (not this PR): minimal vitest + tests for filterVisibleHits/hashToken — deferred for budget.