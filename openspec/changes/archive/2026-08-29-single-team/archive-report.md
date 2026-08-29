# Archive Report — single-team

- **Change**: single-team (one team per instance, public read)
- **Archived to**: `openspec/changes/archive/2026-08-29-single-team/`
- **Archive date**: 2026-08-29 (ISO)
- **Artifact store**: openspec
- **Delivery strategy**: single-pr (size:exception approved; ~2500–3000 changed lines / 55 files, 400-line budget exceeded → size-exception)

## Review Gate

No `reviews/` directory exists for this candidate. `reviewGate` is therefore structurally ABSENT (kill switch off / no review ever discovered). Archive proceeds under ordinary repository policy — no receipt to validate, no `reviewOffer` to decline.

## Task Completion Gate

`openspec/changes/single-team/tasks.md`: all 28 implementation tasks checked `- [x]` (28/28). The persisted tasks artifact reflects the final state. No stale unchecked tasks. Gate PASSED.

## Verification Gate (final state)

Per `verify-report.md` (sha256 802e601c…, verdict `pass`): 28/28 scenarios, 16/16 requirements. **CRITICAL findings: 0** → archive allowed. `blockers: 0`, `critical_findings: 0`.

Final-state facts from the orchestrator launch prompt (these OUTRANK the intermediate `apply-progress` / `verify-report` snapshots):

- 7 commits on local main, in order: `c0d774a` (Team singleton + migrations + scripts), `5464199` (flatten routes + 301 + public files), `2c09f53` (team context + global membership + visibility removal), `bf1b4b1` (guest shell + auth pages), `2691278` (MCP team scoping), `7f5051e` (middleware into src/ + docs), `521ba79` (post-apply cleanup: removed dead `PROJECT_VISIBILITIES` vocabulary from `src/lib/domain.ts`).
- Commit `521ba79` landed AFTER `apply-progress` was written. Per the Final-State Authority hierarchy, the visibility-removal work is therefore COMPLETE at close; the intermediate snapshot's notion of "pending" (if any) is stale and not echoed here.
- Live HTTP evidence (on throwaway DB copies — real `prisma/dev.db` never touched): guest read 200 + CTAs; guest write `{ok:false}` UNAUTHENTICATED; community write-limited, admin ok; promotion admin-only; signup auto-join community + first-user admin; `/w/hilo/*` → 301, other slugs → 404; public files 200 (`Cache-Control: public`) / 404; MCP 9 `hilo_*` tools with 401/403 matrix; seed → exactly 1 Team.
- `npm run typecheck` and `npm run build` both exit 0.

## Specs Synced (source of truth)

| Domain | Action | Details |
|--------|--------|---------|
| team-access | Created | New domain spec (full spec, byte-copied). 7 requirements, 14 scenarios. |
| mcp-server | Updated | RENAMED "Token-derived workspace scoping" → "Token-derived team scoping"; MODIFIED "Bearer token authentication" (403 now = user without global membership); Purpose updated. Preserved: Streamable HTTP endpoint, Read-only tool dispatch. |
| mcp-read-tools | Updated + DESTRUCTIVE | MODIFIED "Tool coverage" (workspace feed → team feed), MODIFIED "Workspace scoping" → "Team scoping" (renamed + content), MODIFIED "Input validation" (dropped `PROJECT_VISIBILITIES` from vocab). **REMOVED "Visibility enforcement" requirement** (see Destructive Delta below). Preserved: Read-only execution. |
| api-tokens | Updated | MODIFIED "ApiToken persistence model" (no `workspaceId`/`teamId`; resolves to singleton team by construction; added "Existing token stays valid through the migration" scenario), MODIFIED "Token management UI" (clean route `/ajustes`, was `w/[slug]/ajustes`). Preserved: Capability-gated token management, Token creation, Token revocation. |

## Destructive Delta Warning

`config.yaml` `rules.archive: Warn before merging destructive deltas` is triggered by the REMOVAL of the "Visibility enforcement" requirement in `mcp-read-tools`.

- **Why intentional**: `Project.visibility` and `KnowledgeResource.visibility` columns are dropped by migration `0001_single_team`; all content is public in the single-team instance. Commit `521ba79` removed the `PROJECT_VISIBILITIES` vocabulary and `visibility.ts`; `projectAccess` / `visibleProjectIds` / `filterVisibleHits` post-filters removed at all four sites together (commit `2c09f53` + `521ba79`).
- **Reason/Migration recorded in delta**: community/developer/admin tokens receive identical unfiltered results; MCP clients relying on visibility filtering must drop those assumptions. README architecture + MCP sections updated (commit `7f5051e`).
- This removal is fully verified by the passing `verify-report` (28/28) and is NOT a regression. Proceeding with the destructive merge as an intentional, documented change.

## Operational Note (NOT a defect)

Production deploy must confirm `TEAM_SLUG` matches the legacy prod workspace slug (default `"hilo"`; wired in `docker-compose.prod.yml`). Prod DB is SQLite in the Coolify `hilo-data` volume; the entrypoint migrates it with `resolve-bootstrap`. If a database was migrated in place whose legacy slug is not `"hilo"` (e.g. local `dev.db` keeps `"cardinal"`), set `TEAM_SLUG` to match or legacy `/w/<slug>` URLs 404 instead of 301. This is a deployment-config concern, not a code defect, and does not block archive.

## Audit Trail Contents

- proposal.md ✅
- exploration.md ✅
- design.md ✅
- specs/ (team-access, mcp-server, mcp-read-tools, api-tokens) ✅
- tasks.md ✅ (28/28 complete)
- verify-report.md ✅ (sha256 802e601c…)
- archive-report.md ✅ (this file)

## Risks

- **Low**: Deployment `TEAM_SLUG` must match legacy prod slug (operational, documented above).
- **Informational**: Project has no automated test runner; scenarios 9.2/9.6 remain manual verification (performed live in this cycle).

## SDD Cycle

Planned → implemented (7 commits) → verified (28/28) → archived. Cycle complete.
