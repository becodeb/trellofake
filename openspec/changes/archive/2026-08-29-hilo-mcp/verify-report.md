```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:3f50ed406bd144406d335ec8e8c75a131efc20517971c4beac7e62ef6f466189
verdict: pass
blockers: 0
critical_findings: 0
requirements: 14/14
scenarios: 25/25
test_command: npm run typecheck
test_exit_code: 0
test_output_hash: sha256:ff00ba817e9dffe9f2c9cb90acd1a2b635f1ef3be79d10607a5c4c5d2bd5b757
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:05223fa22c0be02d1754a8d5a928a8adbc52cdc0326df9bcbc19b5a8151b8e06
```

## Verification Report

**Change**: hilo-mcp
**Version**: re-verify after CRITICAL-1 remediation (commit `02fccc2` `fix(mcp): scope hilo_list_items to visible projects for community role`)
**Mode**: Standard (strict_tdd: false; T5.3 vitest deferred post-merge by artifact design — pre-approved, not faulted)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (incl. T3.2-REMEDIATION) | 14 |
| Tasks complete | 13 |
| Tasks incomplete | 1 (T5.3 — POST-MERGE follow-up by design, pre-approved in preflight) |
| Requirements | 14/14 |
| Scenarios | 25/25 |

### Build & Tests Execution
**Build**: ✅ Passed (`npm run build` — exit 0; `/api/mcp` bundles as `ƒ` nodejs route: `├ ƒ /api/mcp 133 B 103 kB`; SDK kept out of edge bundle)
```text
npm run build: prisma generate && next build — exit 0
build_output_hash: sha256:05223fa22c0be02d1754a8d5a928a8adbc52cdc0326df9bcbc19b5a8151b8e06
```
**Tests**: ➖ No test runner configured (config `test_command: ""`). Static type gate used as command evidence; live protocol suite executed as runtime evidence (55/55 checks — see below).
```text
npm run typecheck: tsc --noEmit — exit 0
test_output_hash: sha256:ff00ba817e9dffe9f2c9cb90acd1a2b635f1ef3be79d10607a5c4c5d2bd5b757
```
**Coverage**: ➖ Not available (coverage_threshold 0, no runner)

**Live runtime evidence (this verify session)**: prod server `next start` on :3010 against the seeded dev.db with disposable tokens (7 + W2 + burst tokens; exercised, one revoked live, all deleted afterwards; DB restored to pristine seed — tokens 0, workspaces 1, users 4, projects 8, items 45, memberships 4). 55/55 automated checks passed; key results:

- **CRITICAL-1 contract (FIXED, commit 02fccc2)**: community token `hilo_list_items {}` → **41 items** (all 6 community-visible projects, **0 non-visible leaks**, the 4 team-only titles absent) vs admin control → **45 items** incl. the 4 team-only; `list_items(team-only projectId)` → `[]`; `get_project(team-only)` → `null`; `get_item(team item)` → `null`; `type:"task"` honored WITH scoped ids (28 items = 30 − 2 team-only tasks); `statuses:["done"]` honored (13, all visible); search "Migrar datos"/"casos de estudio" (team-only titles) → **0 hits** for community vs ≥1 for admin (leak-proof pair)
- Auth: no header / unknown / expired / revoked-pre → HTTP 401; ghost (non-member) → HTTP 403; **soft revoke live**: token worked → `revoked: true` flip → next request 401
- Protocol: pre-init `tools/call` → HTTP 400 + JSON-RPC `-32000 "Server not initialized"`; unknown tool → error result `-32602` "Tool hilo_nonexistent_tool not found" (`isError`); `type:"milestone"` → `-32602` invalid params; unknown method → `-32601`
- Read tools: 9 `hilo_*` with schemas; 8 projects with `subtreeIds`; 2 proposals with 1 reply included; feed 60 events (community: 60/60 events on visible projects); search visible content → hits; resources team-pid → `[]`, unfiltered community-scoped
- Cross-workspace (W2 token): 1 project of its own; W1 project → `null`; W1 item → `null`; W1 projectId list_items → `[]`; own item visible (control)
- Sessions: DELETE → 200; POST after DELETE → 404; DELETE unknown → 404; per-session McpServer (2 distinct sessions served concurrently)
- Rate limit: fresh-token burst → **120×200 then 10×429** (sliding window, dedicated token)
- Wire hygiene: no `storageKey` in any payload; all dates ISO 8601; ApiToken ids all 64-hex sha256 (hash-only storage, no raw persisted)
- Read-only: tools.ts/route.ts contain zero create/update/delete paths; W1 counts unchanged by the suite (items 45, proposals 2); suites did not record activity

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| SM-1 Streamable HTTP endpoint | Client connects via Streamable HTTP | live: initialize → 200 SSE + Mcp-Session-Id + protocolVersion 2025-03-26 + tools capability; tools/list; tools/call | ✅ COMPLIANT |
| SM-1 Streamable HTTP endpoint | Tool call before initialization | live: pre-init tools/call → HTTP 400 + JSON-RPC -32000 "Server not initialized" | ✅ COMPLIANT |
| SM-2 Bearer token authentication | Valid token | live: admin + community initialize → 200, session served | ✅ COMPLIANT |
| SM-2 Bearer token authentication | Expired or revoked token | live: expired → 401; revoked-pre → 401; soft revoke live flip → 401 (E2) | ✅ COMPLIANT |
| SM-2 Bearer token authentication | Token user left the workspace | live: ghost user token → HTTP 403 (token.ts:96-105) | ✅ COMPLIANT |
| SM-3 Token-derived workspace scoping | Token scopes all reads | live: W2 token vs W1 ids → null/[]; proposals pinned to ctx workspace; ctx() via AsyncLocalStorage | ✅ COMPLIANT |
| SM-4 Read-only tool dispatch | Unknown tool name | live: error result -32602 "Tool hilo_nonexistent_tool not found" (SDK 1.30; see SUGGESTION-1) | ✅ COMPLIANT |
| SM-4 Read-only tool dispatch | Tool call is read-only | inspection: handlers use domain reads only; zero write paths in tools.ts/route.ts; W1 row counts unchanged | ✅ COMPLIANT |
| AT-1 ApiToken persistence model | Only the hash is stored | live: 10 in-suite ApiToken ids all 64-hex sha256; no raw prefix in DB (schema.prisma:69-82) | ✅ COMPLIANT |
| AT-1 ApiToken persistence model | Expired token fails authentication | live: expired token → 401 | ✅ COMPLIANT |
| AT-2 Capability-gated token management | Role without capability is rejected | inspection: domain.ts:37-38 admin-granted; requireWorkspaceAction gates both actions → {ok:false} (actions/tokens.ts) | ✅ COMPLIANT |
| AT-3 Token creation | Create token | inspection + live: raw returned once in payload; hash persisted; expiresAt always set | ✅ COMPLIANT |
| AT-3 Token creation | Invalid expiry rejected | inspection: z.coerce.date + future refine (actions/tokens.ts:20-24) → error result, no create | ✅ COMPLIANT |
| AT-4 Token revocation | Revoke token | live: revoked flag → subsequent MCP request 401 | ✅ COMPLIANT |
| AT-4 Token revocation | Revoke unknown token | inspection: unknown/other-workspace id → error result (actions/tokens.ts:58-61) | ✅ COMPLIANT |
| AT-5 Token management UI | Raw token shown exactly once | inspection: api-tokens.tsx once-only copy box w/ MCP URL; masked hash rows only | ✅ COMPLIANT |
| AT-5 Token management UI | Revoked token row | inspection: revoked badge, revoke control disabled (api-tokens.tsx:168-182) | ✅ COMPLIANT |
| RT-1 Tool coverage | tools/list enumerates the read tools | live: 9 hilo_* tools with input schemas | ✅ COMPLIANT |
| RT-1 Tool coverage | Tree includes subprojects | live: 8 projects all with subtreeIds (incl. Lumen→3 subs, Ronda→1 sub) | ✅ COMPLIANT |
| RT-1 Tool coverage | Item filters cover all six types | live: type:"task" 30 admin / 28 community; statuses:["done"] 14/13; live "milestone" rejected -32602 | ✅ COMPLIANT |
| RT-2 Visibility enforcement | Community role sees only community content | live FIXED: 41 items / 6 projects / 0 leaks; search team-only titles → 0 hits; feed 60/60 visible; resources scoped | ✅ COMPLIANT |
| RT-2 Visibility enforcement | Team role sees team content | live: admin 45 items incl. 4 team-only; search team titles → hits; 8 projects (control) | ✅ COMPLIANT |
| RT-3 Workspace scoping | Foreign identifiers yield no data | live: W2 token over W1 project/item → null/[]; own W2 item visible (control) | ✅ COMPLIANT |
| RT-4 Input validation | Invalid item type filter | live: type:"milestone" → -32602, no query executed | ✅ COMPLIANT |
| RT-5 Read-only execution | Read path only | inspection: zero write paths; live: no rows changed (W1 counts intact) | ✅ COMPLIANT |

**Compliance summary**: 25/25 scenarios compliant (14/14 requirements). The previously FAILING scenario (RT-2 community visibility for unfiltered `hilo_list_items`) is now COMPLIANT, live-proven.

### Correctness (Static Evidence, re-checked on HEAD = 02fccc2)
| Requirement | Status | Notes |
|------------|--------|-------|
| Streamable HTTP endpoint | ✅ Implemented | route.ts runtime="nodejs"; POST/DELETE; session registry; SDK owns JSON-RPC lifecycle |
| Bearer token authentication | ✅ Implemented | token.ts hash lookup; 401/403/429 mappings; soft revoke honored |
| Token-derived workspace scoping | ✅ Implemented | workspaceId/role from ApiToken row only; tools read ctx() via AsyncLocalStorage |
| Read-only tool dispatch | ✅ Implemented | 9 registerTool registrations; unknown tool -32602; invalid args -32602 |
| ApiToken persistence model | ✅ Implemented | schema matches spec exactly; hash-only lookup |
| Capability-gated token management | ✅ Implemented | api-tokens.create/revoke admin-only; no other new runtime capabilities |
| Token creation | ✅ Implemented | Zod + future expiry refine; raw returned once |
| Token revocation | ✅ Implemented | soft revoke; unknown id rejected |
| Token management UI | ✅ Implemented | section in ajustes; masked hash rows; once-only raw + endpoint URL |
| Tool coverage | ✅ Implemented | projects/subtree, items 6 types, proposals+replies, resources, people, feed, search |
| Visibility enforcement | ✅ Implemented | FIXED: unfiltered list_items scoped via visibleProjectIds for non-team roles (tools.ts:134-138, mirrors hilo_get_feed) |
| Workspace scoping | ✅ Implemented | hard-scoped everywhere; W2 live checks |
| Input validation | ✅ Implemented | Zod from domain vocabulary; take ≤ 100; search limit 50 |
| Read-only execution | ✅ Implemented | domain reads only; no Server Actions |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 Visibility via adapter composition, no domain signature change | ✅ Yes | Now fully followed: the unfiltered `hilo_list_items` branch applies `visibleProjectIds` intersection (same pattern as `hilo_get_feed`); domain untouched; commit 02fccc2 (7 lines, tools.ts only) |
| D2 Only api-tokens.create/revoke capabilities (admin) | ✅ Yes | domain.ts:37-38; ROLE_CAPABILITIES admin = CAPABILITIES |
| D3 Revoke = soft flag | ✅ Yes | revoked: true; live 401 after flip |
| D4 Pin @modelcontextprotocol/sdk 1.30.0 exact, v1 line | ✅ Yes | package.json exact pin; error codes re-verified live (-32000 pre-init, -32602 unknown tool) |
| D5 token.ts getTokenContext parallel to cookie path | ✅ Yes | TokenContext{workspaceId, role, user, membershipId, can()}; route + tools consume it |

### Issues Found
**CRITICAL**
- None. CRITICAL-1 (community visibility leak in `hilo_list_items` unfiltered branch) is resolved in commit `02fccc2` and re-proven live: 41 items, 0 leaks, 0 hits on team-only search terms for community; admin control unchanged (45 items).

**WARNING**
- None.

**SUGGESTION**
- S1 — Align mcp-server spec wording for unknown-tool errors: requirement says "method-not-found error"; SDK 1.30.0 returns JSON-RPC error *result* `-32602 "Tool ... not found"` (`isError: true`), which satisfies the scenario's "JSON-RPC error" wording. Update the requirement text to match observed SDK behavior (same as prior report; not a blocker).
- S2 — T5.3 (post-merge vitest for `filterVisibleHits`/`hashToken`) remains the standing follow-up; a regression test over `hilo_list_items` community scoping would guard the CRITICAL-1 class (pre-approved deferral, not faulted).

### Verdict
PASS — all gates green (typecheck 0, build 0), 14/14 requirements and 25/25 scenarios compliant, 0 CRITICAL / 0 WARNING, 55/55 live checks. CRITICAL-1 remediated and proven fixed; full regression holds.