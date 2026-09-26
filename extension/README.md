# Hilo browser extension

Chromium MV3 extension (Chrome, Edge, Brave) that lets a team member capture
work without leaving the page they're testing:

- **Anotar**: create a task, idea, problem or note in a project, with one or
  more screenshots and the page URL, in a couple of seconds. It detects "this
  site is project X" from a `KnowledgeResource` whose URL origin matches the
  active tab (see `GET /api/ext/context`), or lets you pick a project and
  remember the origin for next time.
- **Guardar como recurso**: save any page (title, URL, notes, an optional
  screenshot) as a knowledge resource — the team library, or a specific
  project — so it turns up later in Hilo's search.

No build step, no external libraries: plain HTML/CSS/JS, loaded straight from
this folder.

## Install (development)

1. Open `chrome://extensions` (or the Edge/Brave equivalent).
2. Turn on "Developer mode".
3. Click "Load unpacked" and select this `extension/` folder.
4. Open the extension's Options page (right-click the toolbar icon → Options,
   or `chrome://extensions/shortcuts` → the puzzle icon → Options) and set:
   - **Hilo URL**: the instance to talk to (defaults to
     `https://hilo.becode.com.ar`; use `http://localhost:3001` or a LAN IP for
     a local instance).
   - **Token de API**: created from Hilo → Ajustes → "Acceso por API".
5. Click "Guardar". The browser will ask for permission to access that exact
   origin (`optional_host_permissions`) — accept it so requests to a
   self-hosted or local instance aren't blocked.

Users installing from the packaged zip (built by `GET /api/ext/download` and
linked from Hilo's Ajustes page) follow the same steps starting from step 3,
after unzipping.

## Keyboard shortcut

`Alt+Shift+H` opens the popup (`commands._execute_action` in
`manifest.json`). It can be remapped at `chrome://extensions/shortcuts`.

## Files

- `manifest.json` — MV3 manifest: `activeTab` (tab URL + screenshot) +
  `storage` (settings) as base permissions, `optional_host_permissions` for
  the configured Hilo origin.
- `popup.html` / `popup.js` — the "Anotar" and "Guardar como recurso" tabs.
- `options.html` / `options.js` — Hilo URL + token, "Probar conexión".
- `styles.css` — shared styling, colors/radii copied from
  `src/app/globals.css` (light + `prefers-color-scheme: dark`); the extension
  runs in its own process and can't import that file directly, so keep them
  in sync by hand if Hilo's palette changes.
- `icons/` — generated from `public/icons/icon-512.png` via
  `npm run ext:icons` (`scripts/make-extension-icons.mjs`, uses `sharp`).

## API surface it talks to

All under `Authorization: Bearer <token>`, documented in
`src/app/api/ext/**`:

- `GET /api/ext/me` — identity, team, role, capability flags.
- `GET /api/ext/context?url=<page url>` — project matches by resource origin
  + the full active project list for the picker.
- `POST /api/ext/origins` — register the page origin as a project resource.
- `POST /api/ext/items` (multipart) — create an item with screenshots.
- `POST /api/ext/resources` (multipart) — save a page as a resource.

## Known limitations

- `chrome.tabs.captureVisibleTab` captures the visible viewport only, not the
  full scrollable page.
- Opening the popup as a regular browser tab (e.g. for manual testing outside
  the toolbar) does not grant `activeTab`, so screenshot capture won't work
  there — pasting an image (Ctrl+V) still does, since that's a normal DOM
  event.
