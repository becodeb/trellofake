# Design: Hilo MCP Server — read-only AI access per team

## Technical Approach

In-process Next.js Route Handler at `/api/mcp` (`runtime = "nodejs"`) implementing MCP Streamable HTTP on the existing stack: bearer token → sha256 lookup (`ApiToken`, `Session` pattern) → token-derived workspace context → existing `src/server/domain/*` reads with the token role passed into viewer params. Read-only slice: no domain mutations, no FeedEntry/progress impact (README "Decisiones de arquitectura": fan-out on write, progress persisted — both untouched).

## Architecture Decisions

| # | Choice | Alternatives | Rationale |
|---|--------|--------------|-----------|
| D1 | Search/feed visibility via adapter composition; NO domain signature change | Add `viewer` param to `search()`/`workspaceFeed()` | `listProjects(ws, {viewer})` already returns visible projects + `subtreeIds` via `projectAccess()` (projects.ts:59). Adapter computes `visibleIds` once, passes `projectIds` (`workspaceFeed`, `listItems`) or post-filters (`search`, `getItem`) — the pattern pages already use. Domain untouched → zero progress/feed risk; one extra query per non-team call. |
| D2 | Add only `api-tokens.create` + `api-tokens.revoke` (admin) to `CAPABILITIES` | Also `mcp-server.*`/`mcp-read-tools` | Those are spec namespaces, not runtime checks: MCP auth is token-derived; read scope is uniform across valid tokens this slice. Per-token tool scoping is a future slice. Admin inherits via `ROLE_CAPABILITIES.admin = CAPABILITIES`. |
| D3 | Revoke = soft flag `revoked: true` | Hard delete | Spec mandates `revoked Boolean`; keeps lifecycle audit; `findUnique` on PK with `revoked: false` satisfies "revoked → 401". |
| D4 | Pin `@modelcontextprotocol/sdk@1.30.0` (exact), v1 line | SDK v2 split packages | v1.30.0 is current latest; v2 is a different package set (2026-07-28 spec). v1 `McpServer` + `StreamableHTTPServerTransport` is the stable Next.js pattern. SDK owns the JSON-RPC 2.0 envelope: initialize negotiation, `-32601`, `-32602` (Zod `inputSchema`), `-32000` pre-initialize, `-32603`. Route owns HTTP only: auth, session registry, error mapping. |
| D5 | `src/server/auth/token.ts` — `getTokenContext(raw)` parallel to cookie path | Duplicate membership logic in route | Same `WorkspaceContext` shape (workspaceId, role, user, membershipId, `can()`); every query hard-scoped by token `workspaceId`. |

## Data Flow

```
AI client ──POST /api/mcp (Bearer hilo_…)──▶ route.ts
   │ 401 unknown/expired/revoked · 403 membership gone
   ▼
session registry (Mcp-Session-Id) → SDK transport/server
   ▼
tool handler (tools.ts) ─▶ visibleProjectIds(ws, viewer) ─▶ domain read
   (projectIds-scoped / post-filtered) → toWire sanitize → JSON text content
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | `ApiToken` (id = sha256 hash, workspaceId, userId, expiresAt, revoked, createdAt) + relations |
| `src/lib/domain.ts` | Modify | `api-tokens.create`, `api-tokens.revoke` in `CAPABILITIES` |
| `src/server/auth/token.ts` | Create | `hashToken`, `createApiToken` (`hilo_`+32B base64url, returned once), `getTokenContext` |
| `src/server/actions/tokens.ts` | Create | create/revoke Server Actions (Zod, `run()`, `ActionResult`, capability-gated) |
| `src/app/api/mcp/route.ts` | Create | Auth gate, session registry, POST/DELETE, error mapping |
| `src/server/mcp/tools.ts` | Create | 9 `hilo_*` registrations: Zod schemas + handlers over domain reads |
| `src/server/mcp/visibility.ts` | Create | `visibleProjectIds`, `filterVisibleHits` (pure, vitest-ready), `toWire` |
| `src/components/app/api-tokens.tsx` | Create | Create form; once-only raw-token copy box + endpoint URL; revoke rows |
| `src/app/w/[slug]/ajustes/page.tsx` | Modify | "Acceso por API" section (page gated by `workspace.manage`) |
| `package.json` | Modify | `"@modelcontextprotocol/sdk": "1.30.0"` exact |

## Interfaces / Contracts

| Tool | Args (Zod) | Domain call / wiring |
|------|-----------|----------------------|
| `hilo_list_projects` | statuses? (PROJECT_STATUSES), archived? | `listProjects(ws, {statuses, archived, viewer})` |
| `hilo_get_project` | projectId | `getProject(ws, id, viewer)` |
| `hilo_list_items` | type? (ITEM_TYPES), statuses?, projectId?, take? ≤100 | `listItems(ws, {projectIds: ∩visibleIds, types, statuses})`; foreign projectId → `[]` |
| `hilo_get_item` | itemId | `getItem(ws, id)`; post-check `projectId ∈ visibleIds` else null |
| `hilo_list_proposals` | status? (PROPOSAL_STATUSES), take? | direct `db.proposal.findMany` (no domain fn exists); `targetProject` only when `roleCan(role,"content.write")` or community-visible (mirrors ideas/page.tsx) |
| `hilo_list_resources` | projectId? | `listKnowledgeResources(ws, viewer, pid?)`; pid must be ∈ visibleIds else `[]` |
| `hilo_list_people` | take? | `workspaceMembers(ws)` |
| `hilo_get_feed` | take? ≤100, before? ISO | `workspaceFeed(ws, {take, before, projectIds: team ? undefined : visibleIds})`; community skips workspace-level events (people tool covers members) |
| `hilo_search` | query ≥2, kinds? (SearchKind), limit? | `search(ws, slug, q, opts)`; post-filter: project id / item·comment·file projectId ∈ visibleIds; person hits kept |

`TokenContext`: `{ tokenId, workspaceId, user, role, membershipId, can() }`. Result payloads = domain return types (ProjectCard/ItemRow/SearchHit/ActivityEvent); `toWire` strips `storageKey`, Dates → ISO. UI endpoint: `location.origin + "/api/mcp"`.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `filterVisibleHits`, `hashToken` | vitest (config rule: prefer runner for pure modules) |
| Integration | 401/403/400 mapping; scoping | manual curl / MCP Inspector (no runner installed) |
| Build | typecheck + build | `npm run typecheck`, `npm run build`; nodejs runtime keeps SDK out of edge bundle |

## Error Mapping

| Case | Response |
|------|----------|
| Missing/unknown/expired/revoked token | HTTP 401 |
| Token valid, membership removed | HTTP 403 |
| Malformed body | HTTP 400 |
| Rate limit (in-memory 120 req/min/token, SHOULD — admin-granted tokens) | HTTP 429 |
| Unknown tool / bad args / pre-initialize / internal | SDK `-32601` / `-32602` / `-32000` (verified against SDK 1.30.0; unknown tool returns `-32602` "Tool not found", pre-init returns `-32000`) / `-32603` |

## Threat Matrix

N/A — all five rows: this adds an inbound HTTP route with bearer auth, not shell/subprocess/VCS/PR automation or executable-file classification. Routing defense covered by the error mapping and spec scenarios; no RED tests manufactured.

## Migration / Rollout

`npx prisma db push` + `prisma generate` (new table only). Rollback: drop ApiToken, remove route/actions/UI. Route bundles as nodejs runtime; typecheck against SDK types.

## Open Questions

- [ ] None blocking (D1 post-check confirmed).