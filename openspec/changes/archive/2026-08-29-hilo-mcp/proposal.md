# Proposal: Hilo MCP Server — read-only AI access per team

## Intent

Any AI (Claude, Cursor, opencode, ...) can connect to a Hilo instance scoped to ONE team and read everything the team uploaded — proposals, ideas, notes, decisions, problems, knowledge resources, integration guides, project/task state — so the AI can tell what improvements are missing per app. First slice is read-only; write tools come in a later phase.

## Scope

### In Scope
- MCP server: `src/app/api/mcp/route.ts` (Streamable HTTP via `@modelcontextprotocol/sdk`, `runtime = "nodejs"`)
- `ApiToken` Prisma model: sha256 hash, workspaceId, userId, expiresAt, revocable, read scope (hash pattern from `Session`)
- Token UI: "Acceso por API" section on `src/app/w/[slug]/ajustes/page.tsx`; create shows raw token once + MCP endpoint URL for the AI developer; revoke deletes
- Bearer auth + token-derived workspace context (parallel to cookie `getWorkspaceContext`); every query hard-scoped by token `workspaceId` — never client-supplied
- Read tools (`hilo_*`): projects + tree, items (6 types), proposals + replies, knowledge resources + integration guides, people, feed/activity, search
- Visibility (`community`/`team`) honored by passing token role into `projectAccess()` / `listKnowledgeResources` viewer params (`roleCan`)

### Out of Scope
- Write tools (later phase: call domain write cores, not `src/server/actions/*`)
- stdio bridge / local transport (future)
- MCP resources/prompts/notifications

## Capabilities

> Contract for sdd-spec. `openspec/specs/` is empty — all capabilities are NEW.

### New Capabilities
- `mcp-server`: Streamable HTTP route, bearer auth, per-token workspace scoping, tool dispatch
- `api-tokens`: ApiToken model, hashed storage, create/revoke Server Actions + settings UI, expiry
- `mcp-read-tools`: read tools over projects, items, proposals, resources, people, feed, search

### Modified Capabilities
None — no existing spec changes; domain read functions unchanged.

## Approach

In-process Route Handler reusing the existing server stack: shared Prisma client (single process → no SQLite WAL contention), `src/server/domain/*` read functions as-is, `roleCan` guards. Auth: `Authorization: Bearer <token>` → sha256 lookup → verify expiry + live membership → role. Standalone Node server is BLOCKED (`server-only` in every domain module throws outside Next).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | + ApiToken model; existing tables untouched |
| `src/lib/domain.ts` | Modified | + `api-tokens.create`/`api-tokens.revoke` capabilities (admin) |
| `src/app/api/mcp/route.ts` | New | MCP Streamable HTTP endpoint |
| `src/server/auth/token.ts` | New | hash/create/verify + token workspace context |
| `src/server/actions/tokens.ts` | New | create/revoke Server Actions (ActionResult + Zod) |
| `src/app/w/[slug]/ajustes/page.tsx` | Modified | token management section |
| `package.json` | Modified | + `@modelcontextprotocol/sdk` (pinned) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cross-team data leak | High | workspaceId comes ONLY from token row; never from client params |
| Visibility leak (team/community) | High | pass token role into existing viewer params |
| SDK/build instability | Med | pin SDK version; nodejs runtime; verify `next build` |
| Token theft | Med | sha256-only storage, expiry, revoke; raw token shown once |

## Rollback Plan

Revoke all tokens (delete ApiToken rows) → remove route, actions, and UI section → revert schema (drop ApiToken). No domain mutations in this slice → NO FeedEntry fan-out impact (config rule).

## Dependencies

- `@modelcontextprotocol/sdk` (new, pinned)
- Existing: shared Prisma client, `src/server/domain/*` reads, `roleCan` (src/lib/domain.ts)

## Success Criteria

- [ ] AI client connects to `https://<hilo>/api/mcp` with a team token and lists projects, items, resources, feed
- [ ] Every tool result scoped to the token's team; visibility honored by role
- [ ] Expired/revoked tokens rejected (401); reads never mutate data
- [ ] `npm run typecheck` and `npm run build` pass