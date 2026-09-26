# Capture extension, MCP write parity and usability pass

Locator: `odd/tasks/captura-y-paridad.md` · Engram mirror: `odd/captura-y-paridad/tasks` (project `trellofake`)
Branch: `feat/captura-y-paridad` (from `main` @ 57809ff)

## Objective

Make Hilo easier to use day to day and let the team capture tasks, ideas and
screenshots while testing any of their sites (production, localhost or a LAN IP),
without leaving the page. Give AI clients (MCP) the same abilities a user has in
the app.

## Problem / why

- The team barely uses Hilo: the project overview ("Resumen") is a set of lists
  and hides the deployed site / repo links in a small sidebar.
- "Links" live in three places backed by two overlapping models
  (`ResourceLink` vs `KnowledgeResource`).
- Images can only be attached after an item exists, from the item panel; no paste.
- Pending Hilo items (from the deployed instance, via MCP): favicon, centered
  unread badge, images everywhere, remember last project in "Crear", desktop +
  phone app, global capture shortcut.
- The MCP server is read-only; the owner wants full parity with the app.

## Scope (authorized 2026-09-26)

In: everything in the task list below.
Out: navigation reduction (no concrete proposal agreed yet), attachments on
community proposals (no `proposalId` on `Attachment`), push/PR/merge (owner decides;
pushing `main` auto-deploys to hilo.becode.com.ar via Coolify).

## Constraints

- Artifacts (code, comments, identifiers) in English; UI copy stays in the app's
  existing Spanish (Rioplatense, voseo) since we are extending it.
- Prod data must survive: any migration must be additive/data-preserving and run
  with `prisma migrate deploy` (entrypoint backs up the DB first).
- Security: token context derives only from the ApiToken row; client args never
  widen scope. Capability checks stay in the existing actions (`requireTeamAction`).
- Per-task size heuristic ~400 authored lines is advisory only.

## TDD / checks

- TDD: **off** — source: Engram testing capabilities for trellofake (#974), no test
  runner installed. Runner: none.
- Checks per task: `npm run typecheck`, `npm run lint`, and a live check (dev server
  on a scratch copy of the DB + headless Chromium / curl) where behavior is visible.
  `npm run build` once before closing.
- RDD: off (global, decided by the user 2026-09-23) → no native review.

## Delivery

Forecast: well above 400 authored lines (≈2500–3500). Strategy: `ask-on-risk`;
commits stay local on the feature branch; PR slicing / push decided by the owner at
delivery.

## Tasks

- [x] T1 Quick wins — favicon + app icons, center the unread badge number, "Crear"
      remembers the last used project (localStorage). Route: delegated (writer A).
- [x] T2 Installable app (PWA) — web manifest, icons, minimal service worker, works on
      desktop and phone. Route: delegated (writer A).
- [x] T3 People index — `/gente` page listing team members with role and open work;
      nav entry. Route: delegated (writer A).
- [x] T4 Images everywhere — paste (Ctrl+V) and drag images when creating an item
      (quick-create), in the item panel and in comments; attach at creation time.
      Route: delegated (writer B).
- [ ] T5 Unify links — migrate `ResourceLink` rows into `KnowledgeResource`
      (data-preserving migration 0004), drop `ResourceLink`; kinds gain `site` and
      `local` (localhost / LAN IP); project tab "Integración" becomes "Recursos";
      MCP `get_project.links` stays backward compatible. Resources can carry a
      screenshot (`Attachment.resourceId`) shown as thumbnail in the library, and
      global search (⌘K + `hilo_search`) covers resources (name, summary, URL).
      Route: delegated (writer C).
- [ ] T6 Richer overview — project "Resumen" header with prominent site / repo /
      local links, progress + rollup counters, recently completed work.
      Route: delegated (writer C).
- [ ] T7 MCP write parity — actor context (AsyncLocalStorage) so existing server
      actions run as the token's user; `hilo_*` write tools for every app action
      except login/signup/logout/password change/token management; file upload via
      base64. Route: delegated (writer D).
- [ ] T8 Extension API — token-authenticated REST endpoints: resolve project by page
      origin, register an origin for a project, create an item with screenshots and
      the page URL, and save the current page as a resource (team library or a
      project) with notes, kind and an optional screenshot. Route: delegated (writer E).
- [ ] T9 Browser extension — Chrome MV3 in `extension/`: options (Hilo URL + token),
      popup that detects the project by origin or lets you pick "this is X",
      type/title/notes, one-click tab screenshot(s), keyboard shortcut; works on ANY
      page with a "Guardar como recurso" mode (e.g. a site whose design you like),
      prefilled with the page title and URL; install doc linked from Ajustes.
      Route: delegated (writer E).

## Acceptance criteria

- A member can open Hilo from the phone/desktop as an installed app.
- Pasting a screenshot while creating a task attaches it.
- Project overview shows the deployed site and repo at a glance.
- With the extension on `localhost:3001` or `hilo.becode.com.ar`, the member can
  create a task with a screenshot in the right project in under 10 seconds.
- From any website, the extension saves the page (title, URL, notes, screenshot)
  as a resource, and it is later found by searching Hilo.
- Every non-auth app action is callable via MCP with a token, respecting role.

## Progress / evidence

(filled per task: commit, checks run and observed result)

- T1 `9f1a0b0`, T2 `cb9b9a0`, T3 `264cfde` (writer A, delegated). typecheck: pass;
  build: pass; lint: not configured (`next lint` has no eslint config, prompts) — skipped.
  Live on scratch DB copy (port 3611): manifest 200 valid JSON, /icon.svg 200, /sw.js 200,
  /gente 200 with member names; headless Chromium screenshots checked: badge centered,
  Crear preselects last-used project. Assumed: /gente excludes community role (matches
  assignee filter); nav "Gente" after "Proyectos"; icon reuses existing HiloMark.
  Incident: shared `git stash` across worktrees swapped files between writers; recovered
  byte-for-byte from dangling commits. Rule: no `git stash` while worktrees are active.
- T4 `f456365` (writer B, delegated). New shared hook/component
  `src/components/app/use-paste-files.tsx` (usePasteFiles, usePendingAttachments,
  PendingAttachmentsTray, uploadPendingFiles, filterUploadableFiles) reused by
  quick-create, item-panel and comments; no changes to `src/server/actions/*.ts`
  (avoided per merge-conflict guidance for writer working on MCP schemas in the
  linked worktree). typecheck: pass; build: not re-run (only ran once per task
  as planned, deferred to closing pass); lint: not configured — skipped.
  Live on scratch DB copy (port 3613) with headless Chromium (system `/usr/bin/chromium`
  driven via the `/tmp/pw` global Playwright install, no browsers bundled in-repo):
  dispatched synthetic `paste` ClipboardEvents with an in-memory PNG File. Quick-create:
  pending thumbnail rendered, item created, then `Attachment` row created with the new
  `itemId` and kind `image`, served 200 by `/api/files/...` — verified via Prisma query
  against the scratch DB. Item panel: pasted while the title textarea had focus (not the
  comment box); second `Attachment` row appended with the same `itemId`, both images
  visible in "Archivos". Comments: pasted into the comment composer; on submit, files
  uploaded first and the `Comment` row shows the attachment with both `commentId` and
  `itemId` set. Sanity: a synthetic text-only paste dispatched at the comment textarea
  did not get intercepted (hook only acts when `clipboardData.files` is non-empty).
  Assumed: mobile camera access relies on leaving the file input's `accept` unset (matches
  the existing `FileDrop` convention) rather than restricting to `accept="image/*"`, since
  an unrestricted file input already offers camera + gallery + files on iOS/Android.
  "Archivos" discoverability addressed by rewording the drop-zone label from "Soltá un
  archivo o imagen" to "Agregar imagen o archivo" (the control was already clickable).
  Noted, not fixed (pre-existing, unrelated to this task): a React hydration-mismatch
  warning on project pages tied to `style={{}}` on several inputs (ProjectHeader,
  DatePicker, InlineComposer, "Pegá un link…") that predates this change.

## Next step

T5/T6 (writer C) and T7 (writer D) continue in their worktrees; T4 is done.
