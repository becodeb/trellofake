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
- [x] T5 Unify links — migrate `ResourceLink` rows into `KnowledgeResource`
      (data-preserving migration 0004), drop `ResourceLink`; kinds gain `site` and
      `local` (localhost / LAN IP); project tab "Integración" becomes "Recursos";
      MCP `get_project.links` stays backward compatible. Resources can carry a
      screenshot (`Attachment.resourceId`) shown as thumbnail in the library, and
      global search (⌘K + `hilo_search`) covers resources (name, summary, URL).
      Route: delegated (writer C).
- [x] T6 Richer overview — project "Resumen" header with prominent site / repo /
      local links, progress + rollup counters, recently completed work.
      Route: delegated (writer C).
- [x] T7 MCP write parity — actor context (AsyncLocalStorage) so existing server
      actions run as the token's user; `hilo_*` write tools for every app action
      except login/signup/logout/password change/token management; file upload via
      base64. Route: delegated (writer D).
- [x] T8 Extension API — token-authenticated REST endpoints: resolve project by page
      origin, register an origin for a project, create an item with screenshots and
      the page URL, and save the current page as a resource (team library or a
      project) with notes, kind and an optional screenshot. Route: delegated (writer E).
- [x] T9 Browser extension — Chrome MV3 in `extension/`: options (Hilo URL + token),
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

- T7 (writer D, worktree `feat/captura-mcp-parity`): `3bacbc5` actor AsyncLocalStorage feeding
  `getCurrentUser()`; `c6e72df` 39 `hilo_*` write tools calling the existing actions; `22ff142`
  docs; `49badcc` zod schemas moved to `src/server/actions/schemas.ts` ("use server" files may
  only export async functions); `701e83e` date double-parse fix. Excluded: signup, login, logout,
  changePassword, token create/revoke, touchVisit. Live (port 3612): no token → 401; 48 tools
  listed; create item → comment → status → base64 PNG upload → read back OK; community token
  rejected on create item/project/update team, allowed to comment.
- T5 `48a7d5b` / T6 `204c618` (writer C, same worktree): migration `0004_unify_links` moves
  ResourceLink → KnowledgeResource and drops it; kinds `site`/`local`; `Attachment.resourceId`
  thumbnails; search covers resources (⌘K, /buscar, `hilo_search`); tab "Recursos" with
  `/integracion` → 307. Migration proof on a DB copy: 7 ResourceLink rows → 7 new resources,
  row-by-row match. Live (port 3614): overview band (site/repo/local chips, counters,
  "Hecho hace poco") screenshot checked; `hilo_get_project.links` still present.
- Integration: merged into `feat/captura-y-paridad` at `45e8b2e` (clean). Parent spot check:
  `npm run typecheck` → pass after `prisma generate`.
- T8 `0a46b17` (writer E, delegated). `/api/ext/{me,context,origins,items,resources}`,
  auth+rate-limit extracted from `/api/mcp` into `@/server/http/token-gate` (both routes
  now share it — `/api/mcp` refactored, behavior unchanged), CORS in `@/server/http/cors`
  scoped to `chrome-extension://`/`moz-extension://` origins. `origins` and `resources`
  both call `createResource` (not `addLink`, which doesn't return an id — needed for the
  idempotency check and the response); `items` calls `createItem` + `uploadFiles`, page
  URL folded into the body as "Visto en: <url>". `statusForActionError` maps the one
  known role-capability message to 403, everything else to 400. typecheck: pass.
  Live (scratch DB, port 3615, `DEV_TOKEN`/`COMMUNITY_TOKEN` minted via a throwaway script
  since `server-only` blocks importing the real action from a plain `tsx` script): no
  token → 401; `me` returns user/team/role/can; `context` for `http://localhost:3001/...`
  empty → `origins` registers it on a project → `context` shows the match, calling
  `origins` again returns the same id (idempotent); `items` multipart with a PNG → item
  + `Attachment` row confirmed via Prisma, body has both notes and "Visto en: ..."; PNG
  resource with no `projectId` → team resource, found via `hilo_search` (kind resource)
  over a real MCP session; community token → 403 on `items`
  ("Tu rol no permite esta acción."); OPTIONS from `Origin: chrome-extension://...` →
  204 with `access-control-allow-origin` echoed + allow-headers/methods.
- T9 `aa94d22` (writer E, delegated). `extension/` (MV3, no build, no external libs):
  `manifest.json` (`activeTab`+`storage`, `optional_host_permissions` for the configured
  Hilo origin, `_execute_action` → Alt+Shift+H), `popup.html/js` (Anotar + Guardar como
  recurso tabs), `options.html/js`, `styles.css` (colors/radii hand-copied from
  `globals.css`, `prefers-color-scheme` for dark — the extension can't import that file).
  Icons via `npm run ext:icons` (`scripts/make-extension-icons.mjs`, `sharp` — present in
  node_modules as a transitive dep, not declared in package.json). `GET /api/ext/download`
  zips `extension/` on the fly with a dependency-free writer
  (`src/server/ext/zip.ts` — stored entries, hand-rolled CRC32; hit and fixed one bug,
  `0o100644 << 16` overflowing int32 in `writeUInt32LE`, needs `>>> 0`); linked from a new
  "Extensión del navegador" section in Ajustes. Dockerfile now copies `extension/` into
  the runner stage (the app isn't built with `output: "standalone"`, so this is a plain
  `COPY`, same as `src/`). typecheck: pass; `npm run build`: pass (once, at the end).
  Live: `python3 -m zipfile -l` lists `manifest.json`, `popup.js`, etc. under a
  `hilo-extension/` prefix; unzipped and manifest parses. Headless Chromium
  (`/usr/bin/chromium` via the `/tmp/pw` Playwright install, `--load-extension` +
  `--headless=new`) loaded the unpacked extension with zero console/page errors on
  `popup.html` and `options.html`. Options: filled URL+token, "Probar conexión" → real
  fetch from the extension origin succeeded ("Conectado como Juan Ibarra..."), proving
  the CORS headers work against a real browser, not just curl. Popup: header shows
  team/person (real `/api/ext/me` fetch); submitted "Guardar como recurso" through the
  actual UI (no tab data needed for that mode) → resource confirmed in the DB. Screenshots
  of Ajustes, options (empty + filled + tested) and popup (empty, after-paste,
  resource-filled, resource-submitted) all read back correctly.
  Not verified, and why: `chrome.tabs.captureVisibleTab` and the tab-URL-driven "this
  site is X" detection both need `activeTab`, which Chrome only grants on a real toolbar
  click or the `_execute_action` shortcut — opening `popup.html` as a plain tab (the only
  way to drive it headlessly here) never grants it, so `chrome.tabs.query` came back
  without `url`/`title`. Per the task's own anticipated fallback, verified the paste path
  instead: a synthetic `paste` `ClipboardEvent` with an image `File`, dispatched on
  `document`, produced a thumbnail in `#note-shots` exactly like a real Ctrl+V would.
  `chrome.permissions.request` (asked on saving Options) also has no prompt surface in
  this headless harness and never resolves — seeded `chrome.storage.local` directly for
  the rest of the test instead of relying on the permission grant. The full "Anotar" →
  `/api/ext/items` submission was exercised end-to-end already, but via curl (see T8
  evidence above), not through the popup UI, for the same `activeTab`/project-list reason.

## Next step

Both tasks done. Owner decides push / PR slicing per the delivery strategy above; T8/T9
were not run through native review (RDD is off, global, per the user's 2026-09-23
decision).
