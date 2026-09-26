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

- [ ] T1 Quick wins — favicon + app icons, center the unread badge number, "Crear"
      remembers the last used project (localStorage). Route: delegated (writer A).
- [ ] T2 Installable app (PWA) — web manifest, icons, minimal service worker, works on
      desktop and phone. Route: delegated (writer A).
- [ ] T3 People index — `/gente` page listing team members with role and open work;
      nav entry. Route: delegated (writer A).
- [ ] T4 Images everywhere — paste (Ctrl+V) and drag images when creating an item
      (quick-create), in the item panel and in comments; attach at creation time.
      Route: delegated (writer B).
- [ ] T5 Unify links — migrate `ResourceLink` rows into `KnowledgeResource`
      (data-preserving migration 0004), drop `ResourceLink`; kinds gain `site` and
      `local` (localhost / LAN IP); project tab "Integración" becomes "Recursos";
      MCP `get_project.links` stays backward compatible. Route: delegated (writer C).
- [ ] T6 Richer overview — project "Resumen" header with prominent site / repo /
      local links, progress + rollup counters, recently completed work.
      Route: delegated (writer C).
- [ ] T7 MCP write parity — actor context (AsyncLocalStorage) so existing server
      actions run as the token's user; `hilo_*` write tools for every app action
      except login/signup/logout/password change/token management; file upload via
      base64. Route: delegated (writer D).
- [ ] T8 Extension API — token-authenticated REST endpoints: resolve project by page
      origin, register an origin for a project, create an item with screenshots and
      the page URL. Route: delegated (writer E).
- [ ] T9 Browser extension — Chrome MV3 in `extension/`: options (Hilo URL + token),
      popup that detects the project by origin or lets you pick "this is X",
      type/title/notes, one-click tab screenshot(s), keyboard shortcut; install doc
      linked from Ajustes. Route: delegated (writer E).

## Acceptance criteria

- A member can open Hilo from the phone/desktop as an installed app.
- Pasting a screenshot while creating a task attaches it.
- Project overview shows the deployed site and repo at a glance.
- With the extension on `localhost:3001` or `hilo.becode.com.ar`, the member can
  create a task with a screenshot in the right project in under 10 seconds.
- Every non-auth app action is callable via MCP with a token, respecting role.

## Progress / evidence

(filled per task: commit, checks run and observed result)

## Next step

T1–T3 (writer A).
