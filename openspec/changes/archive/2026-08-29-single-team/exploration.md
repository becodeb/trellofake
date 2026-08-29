# Exploration: `single-team` — Un solo equipo por instancia con lectura pública

> Artifact store: `openspec`. Investigation is evidence-based (read real code, not guesses).
> Scope: Hilo (`becodeb/trellofake`). Decisions already taken by the product owner are NOT reopened here — see "Decisions locked by PO".

## TL;DR recommendation

Adopt a **singleton `Team` row that reuses the existing workspace `id`** (currently `cardinal` in prod seed; in prod the only workspace id). This is the lowest-risk path because:

- Every `workspaceId` column already holds exactly one value, so dropping the columns is pure DDL with **zero row data rewrites**.
- Storage keys (`<workspaceId>/<hash>.png`) and `ApiToken.workspaceId` keep their current values → **no file moves, no MCP token reissue**.
- The migration becomes a single, well-scoped schema delta plus a `migrate resolve` bootstrap for the existing prod DB.

Keep a `Membership` table whose membership is **global** (`unique(userId)`), drop `Workspace`, drop all `workspaceId` columns + `Project.visibility` + `KnowledgeResource.visibility`, flatten `/w/[slug]` into clean routes, and redirect legacy `/w/hilo/*` URLs 301 → new paths.

---

## 1. Full inventory of workspace coupling

### Quantified
- `workspaceId` referenced: **175 occurrences across 25 files** (server actions + domain + MCP + storage + schema).
- `/w/[slug]` route strings: **79 occurrences across ~31 component/page files** (nav, links, redirects, `router.push`, `href`).
- `requireWorkspace(...)` call sites: **20 page files** (every page under `src/app/w/[slug]/...`) + 1 definition in `src/server/auth/context.ts`.
- `requireWorkspaceAction(slug, capability)` used by **~10 server actions** (`projects`, `items`, `comments`, `files`, `proposals`, `resources`, `tokens`, `workspace`).
- `defaultWorkspaceSlug(userId)` used in `src/app/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/nuevo-equipo/page.tsx`.
- `slug` token total: 588 (noise from `slugify`, `uniqueSlug`, param names). Genuine URL coupling = the 79 `/w/` strings + the `slug` props threaded through `shell.tsx`/`sidebar.tsx`/`command-palette.tsx`/`search-box.tsx`/etc.
- `Workspace` model + `Membership.workspaceId` + `ApiToken.workspaceId` in `prisma/schema.prisma`.

### Mechanical vs. tricky
- **Mechanical (replace string `/w/${slug}` → `/path`, drop `slug` arg):**
  `sidebar.tsx` (`base = /w/${slug}`), `shell.tsx`, `command-palette.tsx`, `search-box.tsx`, `activity.tsx`, `news-strip.tsx`, `project-card.tsx`, `project-header.tsx`, `item-panel.tsx`, `member-list.tsx`, `new-project.tsx`, `proposals-board.tsx`, `resource-library.tsx`, all `w/[slug]/**/page.tsx` and `layout.tsx`, `auth.ts`/`workspace.ts` redirects.
- **Tricky:**
  - **Auth flow** (`context.ts` `getWorkspaceContext`/`requireWorkspace`/`defaultWorkspaceSlug`, `auth.ts` signup/login, `nuevo-equipo`) — must be replaced with a team/no-slug context.
  - **MCP token binding** (`auth/token.ts` `getTokenContext`, `mcp/tools.ts` `c.workspace.id/slug`, `mcp/visibility.ts`) — token derives team identity; must keep working.
  - **Search URLs** (`domain/search.ts` builds `/w/${slug}/p/...` hrefs) — must emit clean URLs.
  - **Storage keys** (`server/storage.ts` `put(workspaceId, file)` → `${workspaceId}/${hash}`) — physical files live under `storage/<workspaceId>/`.
  - **Feed/Activity fan-out** (`domain/feed.ts`, `domain/activity.ts`) filter by `workspaceId` — become global.
  - **`revalidateWorkspace(slug)`** (`actions/shared.ts`) → `revalidateTeam()` (revalidate clean route layouts).
  - **`middleware.ts` absent** — legacy `/w/hilo/*` redirect must be added (catch-all under `w/[slug]/[...rest]` or `middleware.ts`).

---

## 2. Auth flow today & new "register = auto-join community" flow

### Today
- `getWorkspaceContext(slug)` (`context.ts:25`): requires `getCurrentUser()`; loads `Membership` by `{userId, workspace:{slug}}`. Returns `role`, `membershipId`, `can()`. **No user → `null`; no membership → `null`.**
- `requireWorkspace(slug)` (`context.ts:56`): no user → `redirect(/login?next=/w/${slug})`; no membership → `notFound()`.
- `signup` (`auth.ts:40`): creates `User` + `Workspace` + admin `Membership` + session → `redirect(/w/${slug})`. Takes `workspaceName`.
- `login` (`auth.ts:90`): finds first membership slug → `/w/${slug}` or `/nuevo-equipo`.
- `nuevo-equipo/page.tsx` + `new-workspace-form.tsx`: create-a-workspace escape hatch for users with no membership.
- Roles checked via `roleCan(role, capability)` in `lib/domain.ts:56`; `can()` is built from the membership role. Roles: `admin | developer | community`. `community` currently only has `comment.write`.

### New flow (PO decision: any registered user = community)
- **Register** (`signup` rewrite): create `User` + global `Membership` with role `community` (admin only if this is the very first user / bootstrap) + session → `redirect("/")` (or `/proyectos`). Drop `workspaceName`.
- **Login**: after session → `redirect("/")` (single team, no slug).
- **Logout**: `redirect("/")` (or `/login`).
- **`nuevo-equipo`**: DELETE (obsolete in single-team).
- New `getTeamContext()` (server, no auth) + `requireTeamAction(capability)` (server action guard) replace `getWorkspaceContext`/`requireWorkspace`/`requireWorkspaceAction`. `roleCan`/`can()` unchanged.
- Role promotion (community → developer/admin) stays an admin action in the `Membership` table.

---

## 3. Guest / public-read feasibility

### Today
- **Every** `w/[slug]/**` page calls `requireWorkspace(slug)` → unauthenticated users are bounced to `/login`. The ONLY public surfaces are `(auth)/*` and the root `/` (which itself redirects to `/login` when no user). So **no content is public today**.
- `api/files/[...path]/route.ts` requires `getCurrentUser()` + workspace-membership check.

### What must change for public read
- Introduce an **unauthenticated team context** (`getTeamContext()` returns the singleton team + `role: "guest"` + `can: () => false` for write caps) so pages render read-only data.
- Pages to make public: `/` (dashboard), `/proyectos`, `/p/[id]`, `/ideas`, `/recursos`, `/gente/[userId]`, `/buscar`. Keep write-gated UI hidden for guests (no "Crear"/"Comentar" buttons; show **Login / Registrate** CTAs in the shell/user menu).
- **Server actions that need auth guards:** `addComment`, `editComment`, `deleteComment`, `addProposal`, `replyProposal`, `createProject`, `updateProject`, `setProjectStatus`, `restoreProject`, `setProjectMembers`, `addLink`, `removeLink`, `deleteProject`, `uploadFiles`, `uploadCover`, `deleteAttachment`, `createApiTokenAction`, `revokeApiToken`, `addMember`, `setMemberRole`, `removeMember`, `markRead`, `touchVisit`, `updateWorkspace`. All currently call `requireWorkspaceAction(slug, cap)` — switch to `requireTeamAction(cap)` which throws `UNAUTHENTICATED` for guests (handled by `shared.ts` → friendly message).
- **Files:** decide if attachments are public. Recommended: make `/api/files` public for files whose project is community-visible (or simply public for all, since the whole instance is public). This requires changing the membership check in `route.ts`.
- **Shell/navigation for guests:** `sidebar.tsx`/`shell.tsx` `UserMenu` becomes a Login/Register pair; `canWork` (role !== community) gates create/search; for guests these are hidden and replaced with CTAs.

---

## 4. DB simplification design surface

### Columns / tables that DIE (all carry a single repeated value today)
- `Workspace` model — **delete** (replaced by singleton `Team` or constants).
- `workspaceId` columns on: `Project`, `Item`, `Comment`, `Mention`, `Attachment`, `Proposal`, `ProposalReply`, `KnowledgeResource`, `Activity`, `FeedEntry`, `ApiToken`, `Membership`.
- `Membership.workspaceId` + `@@unique([userId, workspaceId])` → `@@unique([userId])` (global membership).
- `ApiToken.workspaceId` + relation to `Workspace` → `ApiToken.teamId?` reusing same id, or drop and resolve singleton team.
- `Project.visibility` (`community|team`) — PO says evaluate dropping; **recommend DROP** (all public) and remove `projectAccess()` visibility branch in `domain/projects.ts:59` + `comments.ts:46` + MCP `visibleProjectIds` post-filters.
- `KnowledgeResource.visibility` — **recommend DROP** (all public).
- `assigneeScope "team"` — **KEEP** (unrelated to visibility; controls task assignment fan-out in `domain/activity.ts:123`).
- All `where: { workspaceId }` / `workspace: { members: { some } }` filters become no-ops → **remove** (they are pure overhead post-change and would silently filter nothing, but must be deleted for clarity).

### Team identity — DESIGN DECISION for the design phase
- **Option A — Singleton `Team` table reusing the existing workspace id (RECOMMENDED).**
  `model Team { id, name, slug, mission }` with exactly one row whose `id` = the current workspace id. `Membership.teamId?` not even needed because all queries drop the filter. Storage keys and `ApiToken` keep their values verbatim. Seed upserts the one row. UI still shows name/mission/slug (editable via `/ajustes`). **Lowest risk.**
- **Option B — Team identity in env/constants (no DB row).**
  Simpler schema but admins can't edit name/mission without redeploy; seed + UI must read env. More disruptive to `/ajustes` and the dashboard header.
- **Option C — Keep `Workspace` as-is.**
  Smallest code change but violates the explicit "simplify the data model" goal; not recommended.

### Where the removed concept is referenced (must be updated)
`prisma/schema.prisma` (all models above), `context.ts`, `auth/token.ts`, `actions/{auth,workspace,projects,items,comments,files,proposals,resources,tokens}.ts`, `domain/{projects,feed,activity,dashboard,items,resources,search}.ts`, `mcp/{tools,visibility}.ts`, `storage.ts`, `seed.ts`, every `w/[slug]/**` page, and `shell/sidebar/command-palette/search-box/activity/news-strip/project-card/project-header/item-panel/member-list/new-project/proposals-board/resource-library`.

---

## 5. Migration strategy

### Database provider (VERIFIED)
- `prisma/schema.prisma:21` → `provider = "sqlite"`.
- `docker-compose.prod.yml:8` → `DATABASE_URL=${DATABASE_URL:-file:/app/data/prod.db}` (SQLite file in a Coolify volume `hilo-data`).
- `.env` → `DATABASE_URL="file:./dev.db"`.
- **Conclusion: prod is SQLite, NOT Postgres.** (The schema header comment mentions Postgres portability aspiration, but the datasource is SQLite.) All migration DDL must be SQLite-safe.

### Bootstrapping migrations (none exist today)
- `prisma/migrations/` does **not exist**; `docker-entrypoint.sh` runs `prisma db push --skip-generate` (no `_prisma_migrations` table on prod).
- **Plan:** `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` → commit as `migrations/0000_baseline/`. Then author `migrations/0001_single_team/` (the actual change).
- **CRITICAL prod bootstrap:** because prod's DB was built with `db push` (no migration history), the first `migrate deploy` will try to *execute* the baseline (tables already exist) and **fail**. Fix: after deploy, `prisma migrate resolve --applied 0000_baseline` to mark it, OR detect "no `_prisma_migrations` table" in the entrypoint and run resolve first. The single-team migration then applies normally with zero data loss (single row value per `workspaceId`).
- **Entrypoint rewrite (`docker-entrypoint.sh`):**
  ```
  if [ ! -f "$DB_PATH" ]; then
    npx prisma migrate deploy        # fresh: applies baseline + single_team
    npm run db:seed
  else
    # existing db-push DB: mark baseline applied, then apply new migrations
    npx prisma migrate deploy || true
    npx prisma migrate resolve --applied 0000_baseline 2>/dev/null || true
    npx prisma migrate deploy
  fi
  ```
  Replace both `prisma db push --skip-generate` lines. Keep `prisma generate` (already in Dockerfile). `db:reset`/`setup` scripts in `package.json` should move to `migrate deploy` + seed for local parity.
- **SQLite DDL note:** dropping columns / altering tables forces table rebuilds (Prisma handles via temp tables + `foreign_keys=OFF`). Single transaction is fine. No `--accept-data-loss` needed because data is preserved (uniform `workspaceId`).

---

## 6. Seed data (`prisma/seed.ts`)

- Creates `Workspace` "Red Educativa Cardinal" (slug `cardinal`) + 4 `Membership` rows (admin/developer/developer/community).
- Uses `const ws = workspace.id` as `workspaceId` in **~100 places** (projects, items, comments, attachments, knowledge, proposals, activity, feed).
- **Required changes:**
  - Remove `db.workspace.create`/`deleteMany`; upsert the singleton `Team` row (or no-op if Option B).
  - Replace all `workspaceId: ws` with removal of the field (or `teamId: TEAM_ID` if kept).
  - `Membership.create` drops `workspaceId`; `unique([userId])`.
  - `ApiToken`: none in seed today; if added, use `teamId`.
  - Storage key `put(ws, ...)` → `put(file)` (constant prefix = team id; see §4/§7).
  - `Activity`/`FeedEntry` lose `workspaceId`.
  - Login hint in seed output should point to `/` not `/login` → workspace.

---

## 7. Risks

| # | Severity | Risk | Mitigation |
|---|----------|------|------------|
| R1 | CRITICAL | **Prod migration bootstrap fails**: first `migrate deploy` on existing `db-push` DB errors because baseline tables already exist. A wrong "fix" could be `db push --force-reset` → full data loss. | Mark baseline applied via `prisma migrate resolve --applied 0000_baseline` in entrypoint; never `--force-reset` on prod. Verify on a copied `prod.db` before merge. |
| R2 | CRITICAL | **Storage files 404 after change**: physical files live at `storage/<workspaceId>/...` and `Attachment.storageKey = "<workspaceId>/<hash>"`. If team id ≠ old workspace id, every attachment link breaks. | Reuse the existing workspace id as the singleton `Team.id` (Option A). `put()` prefix stays identical → zero moves. If a new id is chosen, add a filesystem move + `UPDATE attachment SET storageKey=...` in the migration. |
| R3 | WARNING | **MCP clients break**: `ApiToken.workspaceId` binds tokens to a workspace; `getTokenContext` validates `userId_workspaceId` membership. Claude/Cursor/opencode users lose access. | Keep `ApiToken` resolving to the singleton team (Option A reuses id; or drop the column and resolve the single team). Tokens remain valid without reissue. Add a post-deploy MCP smoke test. |
| R4 | WARNING | **Dead legacy links**: third parties (and the community post "hilo.becode") link to `/w/hilo/...`. Removing routes 404s bookmarks. | Add 301 redirect: a catch-all `app/w/[slug]/[...rest]/route.ts` or `middleware.ts` mapping `/w/hilo/<x>` → `/<x>` (slug is fixed `hilo`). Verify with `curl -I`. |
| R5 | WARNING | **Inconsistent visibility after dropping `Project.visibility`/`KnowledgeResource.visibility`**: `projectAccess()` is applied in 4 places (`projects.ts`, `comments.ts`, MCP `visibleProjectIds`, search post-filter). Partial removal leaks or hides data inconsistently. | Remove the visibility branch in ALL four sites together; add a single `teamScope()` no-op marker so future divergence is obvious. |
| R6 | WARNING | **Files public exposure**: making `/api/files` public (to match public read) could expose attachments the team considered internal. | Gate file access by project visibility OR make all files public deliberately (whole instance is public per PO). Decide explicitly in design; don't inherit the old membership check silently. |
| R7 | INFO | **Obsolete flows**: `nuevo-equipo`, `signup` workspace creation, `defaultWorkspaceSlug`, `requireWorkspace` become dead. Leftover code causes confusion/bugs. | Delete `nuevo-equipo` route + `new-workspace-form`; rewrite `signup`/`login`; remove `defaultWorkspaceSlug`. |
| R8 | INFO | **Review budget**: this change touches ~55 files (schema + seed + entrypoint + ~25 server + ~30 UI). Authored diff will **exceed 800 lines** → chained PRs recommended. | `sdd-tasks` must forecast `budget risk: High` and recommend chained PRs (e.g. PR1 schema+migration+seed+entrypoint; PR2 routes/redirects; PR3 server context/actions; PR4 UI/shell; PR5 MCP/visibility). |
| R9 | INFO | **No test runner / no tests** (`npm run typecheck` + `npm run build` only). Regressions in visibility/redirects won't be caught automatically. | Add manual verification checklist (public page loads without cookie, MCP token still works, `/w/hilo/...` → 301) to the design/verify phase. |

---

## 8. Approaches compared

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| **A. Singleton `Team` row reusing existing workspace id** | Zero data rewrite; storage + MCP tokens keep working; editable team name/mission; clean migration | One extra tiny table; seed/UI read team row | **Low** (recommended) |
| B. Team identity in env/constants | Simplest schema (no Team table) | No in-app editing of name/mission; env plumbing in seed/UI; more disruptive | Medium |
| C. Keep `Workspace` model as-is | Smallest code change | Violates explicit simplification goal; leaves dead multi-tenancy concept | Low but rejected by PO intent |

Route-redirect sub-decision: **`middleware.ts` 301 redirect** (clean, central, testable with `curl`) is preferred over a catch-all page for `/w/hilo/*`.

---

## 9. Recommendation

Proceed with **Approach A** (singleton `Team` reusing the existing workspace id) + **middleware 301 redirect** for legacy `/w/hilo/*` + **drop `Project.visibility`/`KnowledgeResource.visibility`** (all public) + **global `Membership`** + **real Prisma migrations** bootstrapped via `migrate resolve`. This satisfies the PO's locked decisions, minimizes prod risk (no file moves, no MCP reissue, no data loss), and yields the simplest verifiable migration.

## 10. Ready for Proposal

**Yes.** Investigation is complete and evidence-backed. The orchestrator should tell the user / design phase:
- Confirm **Approach A** (singleton Team reusing old id) — or record if they prefer B.
- Confirm **all projects/resources become public** (drop visibility) — PO leaning is yes.
- Confirm **file attachments become public** (R6) or stay gated.
- Note the **chained-PR** plan is mandatory (R8) and there is **no automated test harness** (R9).
- The existing OpenSpec specs (`specs/mcp-server`, `specs/mcp-read-tools`, `specs/api-tokens`) will need delta updates because MCP token context + tool scopes change.
