# Archive Report: hilo-mcp

**Change**: hilo-mcp
**Product**: Hilo (repo: trellofake)
**Archived to**: `openspec/changes/archive/2026-08-29-hilo-mcp/`
**Archive date**: 2026-08-29
**Artifact store mode**: openspec
**Status**: success — intentional-with-warnings (see T5.3 note below)

## Final-State Authority

This report is the TERMINAL record of the cycle. It reflects the state of the change AT CLOSE, not the state of intermediate snapshots.

- `apply-progress` (observation 983) PREDATES the final verify and is superseded. The `verify-report.md` against HEAD `02fccc2` is the authoritative final evidence.
- The first verify run reported a **CRITICAL-1** (community visibility leak in `hilo_list_items` unfiltered branch). That finding is STALE: it was fixed in commit `02fccc2` and re-proven fixed by the final verify. Per the Final-State Authority hierarchy, the final PASS verdict wins; the earlier FAIL claim is recorded as history, not current state.
- Final verification verdict (authoritative, `verify-report.md` evidence_revision `sha256:3f50ed4…`): **PASS** — 14/14 requirements, 25/25 scenarios, 55/55 live checks, `npm run typecheck` exit 0, `npm run build` exit 0, **0 CRITICAL / 0 WARNING / 0 blockers**.

## Native Review Receipt Gate

`reviewGate` key is structurally ABSENT from the launch status (no receipt-driven development ran for this candidate, kill switch off). Proceeded under ordinary repository policy. No review artifact was required or blocked on.

## Task Completion Gate

`tasks.md` (persisted artifact, source of truth) inspected:
- 13 of 14 tasks marked `[x]`, including `T3.2-REMEDIATION [x]` (commit `02fccc2`, CRITICAL-1 fix).
- `T5.3` is `[ ]` — explicitly documented in `tasks.md` as: *"POST-MERGE FOLLOW-UP (not this PR): minimal vitest + tests for filterVisibleHits/hashToken — deferred for budget."*

`T5.3` is an accurate, intentional representation of deferred work, NOT a stale checkbox for completed work. The `verify-report.md` explicitly pre-approves this deferral ("pre-approved, not faulted"; "Tasks incomplete: 1 (T5.3 — POST-MERGE follow-up by design, pre-approved in preflight)"). All 14 requirements are verified independently of T5.3 (a testing-infra follow-up). The orchestrator explicitly authorized archive with T5.3 deferred. Archive recorded as **intentional-with-warnings** (non-critical, testing-infra only). T5.3 is intentionally NOT marked complete.

## Specs Synced (Source of Truth)

Main specs directory was empty; each delta spec is a full spec (no `ADDED/MODIFIED/REMOVED/RENAMED` sections) and was mechanically copied (shell `cp` + `diff -r` readback, byte-identical) to:

| Domain | Action | Requirements | Path |
|--------|--------|--------------|------|
| mcp-server | Created | 4 (SM-1..SM-4) | `openspec/specs/mcp-server/spec.md` |
| api-tokens | Created | 5 (AT-1..AT-5) | `openspec/specs/api-tokens/spec.md` |
| mcp-read-tools | Created | 5 (RT-1..RT-5) | `openspec/specs/mcp-read-tools/spec.md` |

Total: 14 requirements, matching the verified 14/14.

## Destructive-Delta Check

Config rule `rules.archive: Warn before merging destructive deltas` evaluated. All three specs are NEW domains (additive); zero `REMOVED`/`RENAMED` sections; nothing in existing specs was deleted or modified. No destructive delta → no warning required. New capabilities only.

## Commits

6 commits on `main`, not yet pushed:
- `4bfd110` feat(mcp): add ApiToken model and api-token capabilities
- `429c33d` feat(mcp): add API token auth and create/revoke server actions
- `907a298` feat(mcp): add visibility adapter, hilo_* read tools and /api/mcp route
- `d0c9758` feat(mcp): add API token management section to workspace settings
- `2416875` fix(mcp): create one McpServer per session transport
- `02fccc2` fix(mcp): scope hilo_list_items to visible projects for community role (CRITICAL-1 remediation)

## Carried Suggestions (backlog)

- **S1** — Align mcp-server spec wording for unknown-tool errors: requirement says "method-not-found error"; SDK 1.30.0 returns JSON-RPC error *result* `-32602 "Tool … not found"` (`isError: true`), which satisfies the scenario's "JSON-RPC error" wording. Update requirement text to match observed SDK behavior. (Non-blocking; noted in verify-report.)
- **S2** — T5.3 post-merge vitest for `filterVisibleHits`/`hashToken`; a regression test over `hilo_list_items` community scoping would guard the CRITICAL-1 class. Pre-approved deferral.

## Mechanical Copy Contract Evidence

- Step 2 (spec sync): `diff -r` source-delta vs temp-copy for all three domains → **empty (IDENTICAL, exit 0)**.
- Step 3 (archive move): `diff -r` pre-move snapshot vs `openspec/changes/archive/2026-08-29-hilo-mcp/` → **empty (IDENTICAL, exit 0)**.
- `openspec/` is untracked in git, so `git mv` fell back to `mv`. Both copies verified by independent `diff -r`; no model Read→Write path used for artifact content.

## Archive Contents

- proposal.md ✅
- design.md ✅
- specs/ (mcp-server, api-tokens, mcp-read-tools) ✅
- tasks.md ✅ (13/14 `[x]`; T5.3 deferred by design)
- verify-report.md ✅

## SDD Cycle

Closed. The change is fully planned, implemented, verified, and archived. Ready for the next change.
