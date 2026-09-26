// Popup de la extensión Hilo. Sin build ni dependencias: DOM llano.
//
// Flujo: leer configuración (storage.local) → si falta token, mostrar el
// estado vacío con link a Opciones → si hay token, pedir /api/ext/me y
// /api/ext/context de la pestaña activa, y armar las dos pestañas (Anotar /
// Guardar como recurso) con lo que devuelven.

const RESOURCE_KIND_OPTIONS = [
  ["", "Automático"],
  ["site", "Sitio"],
  ["local", "Entorno local"],
  ["repository", "Repositorio"],
  ["design", "Diseños"],
  ["document", "Documentación"],
  ["service", "Servicio"],
  ["database", "Base de datos"],
  ["api", "API / integración"],
  ["link", "Enlace"],
];

let settings = null;
let activeTab = null;
let contextData = { matches: [], projects: [] };

const noteState = { type: "task", projectId: null, remember: true, shots: [] };
const resourceState = { projectId: "", shots: [] };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  settings = await getSettings();
  if (!settings.hiloUrl || !settings.apiToken) {
    renderNoToken();
    return;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tabs[0] ?? null;

  const [me, ctx] = await Promise.all([
    fetchJson("/api/ext/me"),
    activeTab?.url ? fetchJson(`/api/ext/context?url=${encodeURIComponent(activeTab.url)}`) : Promise.resolve(null),
  ]);

  if (!me.ok) {
    renderConnectionError(me);
    return;
  }
  document.getElementById("team-name").textContent = me.data.team.name;
  document.getElementById("person-name").textContent = me.data.user.name;

  if (ctx && ctx.ok) contextData = ctx.data;

  setupTabs();
  await setupNotePanel();
  setupResourcePanel();
}

// ------------------------------------------------------------- storage

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["hiloUrl", "apiToken", "originPrefs"], (data) => resolve(data || {}));
  });
}

function originKey() {
  try {
    return activeTab?.url ? new URL(activeTab.url).origin : null;
  } catch {
    return null;
  }
}

async function rememberOriginPref(type, projectId) {
  const key = originKey();
  if (!key) return;
  const current = (await getSettings()).originPrefs || {};
  current[key] = { type, projectId };
  chrome.storage.local.set({ originPrefs: current });
}

// --------------------------------------------------------------- fetch

/** GET/POST contra la API de Hilo con el token guardado. Nunca tira: siempre
 * devuelve {ok, status, data} — la UI decide qué mostrar. */
async function fetchJson(path, options = {}) {
  try {
    const response = await fetch(`${settings.hiloUrl}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${settings.apiToken}`, ...(options.headers || {}) },
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      // Respuesta sin cuerpo JSON (ej. 204): no es un error de por sí.
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function errorMessage(result) {
  if (result.status === 0) return "No se pudo conectar con Hilo. ¿La URL es correcta?";
  if (result.status === 401) return "Token de API inválido o vencido. Revisalo en Opciones.";
  return result.data?.error || "Algo salió mal.";
}

function renderNoToken() {
  document.getElementById("app").innerHTML = `
    <div class="header">
      <div class="mark" aria-hidden="true"></div>
      <div class="who"><div class="team">Hilo</div></div>
    </div>
    <div class="empty-state">
      <p>Todavía no configuraste la extensión con la URL de Hilo y un token de API.</p>
      <button class="btn btn-primary" id="open-options">Configurar</button>
    </div>`;
  document.getElementById("open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());
}

function renderConnectionError(result) {
  document.getElementById("app").innerHTML = `
    <div class="header">
      <div class="mark" aria-hidden="true"></div>
      <div class="who"><div class="team">Hilo</div></div>
    </div>
    <div class="empty-state">
      <p>${escapeHtml(errorMessage(result))}</p>
      <button class="btn btn-primary" id="open-options">Revisar configuración</button>
    </div>`;
  document.getElementById("open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());
}

// ---------------------------------------------------------------- tabs

function setupTabs() {
  const tabNote = document.getElementById("tab-note");
  const tabResource = document.getElementById("tab-resource");
  const panelNote = document.getElementById("panel-note");
  const panelResource = document.getElementById("panel-resource");
  let resourceInitialized = false;

  tabNote.addEventListener("click", () => {
    tabNote.setAttribute("aria-selected", "true");
    tabResource.setAttribute("aria-selected", "false");
    panelNote.hidden = false;
    panelResource.hidden = true;
  });

  tabResource.addEventListener("click", async () => {
    tabNote.setAttribute("aria-selected", "false");
    tabResource.setAttribute("aria-selected", "true");
    panelNote.hidden = true;
    panelResource.hidden = false;
    // La captura por defecto se toma recién la primera vez que se entra a
    // esta pestaña, no al abrir el popup: si el usuario solo quiere anotar,
    // no tiene sentido gastar una captura que nunca va a ver.
    if (!resourceInitialized) {
      resourceInitialized = true;
      await captureForResource();
    }
  });
}

// ----------------------------------------------------------- panel Anotar

async function setupNotePanel() {
  const prefs = (settings.originPrefs || {})[originKey()] || null;

  // Tipo: se recuerda por origen (última vez que se anotó algo acá).
  noteState.type = prefs?.type || "task";
  document.querySelectorAll("#type-picker button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.type === noteState.type));
    button.addEventListener("click", () => {
      noteState.type = button.dataset.type;
      document
        .querySelectorAll("#type-picker button")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    });
  });

  const banner = document.getElementById("note-project-banner");
  const match = contextData.matches[0];

  if (match) {
    noteState.projectId = match.id;
    banner.innerHTML = `
      <div class="banner">
        <span class="dot" aria-hidden="true"></span>
        <span>Este sitio es <strong>${escapeHtml(match.name)}</strong></span>
        <button type="button" class="link" id="note-change-project">Cambiar</button>
      </div>`;
    document.getElementById("note-change-project").addEventListener("click", () => {
      noteState.projectId = null;
      renderProjectPicker(banner, prefs?.projectId);
    });
  } else {
    renderProjectPicker(banner, prefs?.projectId);
  }

  document.getElementById("note-capture").addEventListener("click", async () => {
    const blob = await captureVisibleTab();
    if (blob) addShot(noteState.shots, document.getElementById("note-shots"), blob);
  });

  // Pegar una captura (Ctrl+V) mientras el popup de Anotar está a la vista.
  document.addEventListener("paste", (event) => {
    if (document.getElementById("panel-note").hidden) return;
    const file = imageFromClipboard(event);
    if (file) addShot(noteState.shots, document.getElementById("note-shots"), file);
  });

  document.getElementById("note-submit").addEventListener("click", submitNote);
}

function renderProjectPicker(banner, preferredProjectId) {
  const isHttp = /^https?:\/\//i.test(activeTab?.url || "");
  const options = contextData.projects
    .map((p) => `<option value="${p.id}">${"  ".repeat(p.depth)}${escapeHtml(p.name)}</option>`)
    .join("");
  banner.innerHTML = `
    <div class="field">
      <label for="note-project-select">Proyecto</label>
      <select id="note-project-select"><option value="">Elegí un proyecto…</option>${options}</select>
    </div>
    ${
      isHttp
        ? `<label class="checkbox-row">
             <input type="checkbox" id="note-remember" checked />
             Recordar este sitio para este proyecto
           </label>`
        : ""
    }`;
  const select = document.getElementById("note-project-select");
  if (preferredProjectId && contextData.projects.some((p) => p.id === preferredProjectId)) {
    select.value = preferredProjectId;
    noteState.projectId = preferredProjectId;
  }
  select.addEventListener("change", () => {
    noteState.projectId = select.value || null;
  });
  const remember = document.getElementById("note-remember");
  noteState.remember = isHttp && (remember ? remember.checked : false);
  remember?.addEventListener("change", () => {
    noteState.remember = remember.checked;
  });
}

async function submitNote() {
  const title = document.getElementById("note-title").value.trim();
  const body = document.getElementById("note-body").value.trim();
  const status = document.getElementById("note-status");
  status.innerHTML = "";

  if (!title) return setStatus(status, "error", "Escribí un título.");
  if (!noteState.projectId) return setStatus(status, "error", "Elegí un proyecto.");

  const submitButton = document.getElementById("note-submit");
  submitButton.disabled = true;
  submitButton.textContent = "Guardando…";

  try {
    const isNewOrigin = !contextData.matches.some((m) => m.id === noteState.projectId);
    if (noteState.remember && isNewOrigin && activeTab?.url) {
      await fetchJson("/api/ext/origins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: noteState.projectId, url: activeTab.url }),
      });
    }

    const formData = new FormData();
    formData.set("type", noteState.type);
    formData.set("title", title);
    if (body) formData.set("body", body);
    formData.set("projectId", noteState.projectId);
    if (activeTab?.url) formData.set("pageUrl", activeTab.url);
    noteState.shots.forEach((blob, i) => formData.append("files", blob, `captura-${i + 1}.png`));

    const result = await fetchJson("/api/ext/items", { method: "POST", body: formData });
    if (!result.ok) {
      setStatus(status, "error", errorMessage(result));
      return;
    }

    await rememberOriginPref(noteState.type, noteState.projectId);
    setStatus(
      status,
      "success",
      `Listo. <a href="${result.data.appUrl}" target="_blank" rel="noreferrer">Ver en Hilo</a>`,
    );
    setTimeout(() => window.close(), 1400);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Guardar en Hilo";
  }
}

// ------------------------------------------------------ panel Recurso

function setupResourcePanel() {
  document.getElementById("res-name").value = activeTab?.title || "";
  document.getElementById("res-url").value = activeTab?.url || "";

  const kindSelect = document.getElementById("res-kind");
  kindSelect.innerHTML = RESOURCE_KIND_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join(
    "",
  );
  // Elección automática liviana, solo para default del selector: el server
  // vuelve a decidir el tipo final si no se manda `kind` explícito.
  kindSelect.value = guessKind(activeTab?.url || "");

  const destinationSelect = document.getElementById("res-destination");
  const options = contextData.projects
    .map((p) => `<option value="${p.id}">${"  ".repeat(p.depth)}${escapeHtml(p.name)}</option>`)
    .join("");
  destinationSelect.innerHTML = `<option value="">Biblioteca del equipo</option>${options}`;

  document.getElementById("res-recapture").addEventListener("click", captureForResource);
  document.getElementById("res-submit").addEventListener("click", submitResource);
}

function guessKind(url) {
  try {
    const { hostname } = new URL(url);
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return "local";
    if (/(github\.com|gitlab\.com|bitbucket\.org)/.test(hostname)) return "repository";
    if (/(figma\.com|dribbble\.com|behance\.net|framer\.com)/.test(hostname)) return "design";
    return "site";
  } catch {
    return "";
  }
}

async function captureForResource() {
  const blob = await captureVisibleTab();
  if (!blob) return;
  resourceState.shots = [blob];
  renderShots(document.getElementById("res-shots"), resourceState.shots, (index) => {
    resourceState.shots.splice(index, 1);
  });
}

async function submitResource() {
  const name = document.getElementById("res-name").value.trim();
  const url = document.getElementById("res-url").value.trim();
  const summary = document.getElementById("res-summary").value.trim();
  const kind = document.getElementById("res-kind").value;
  const projectId = document.getElementById("res-destination").value;
  const status = document.getElementById("res-status");
  status.innerHTML = "";

  if (!name || !url) return setStatus(status, "error", "Completá nombre y URL.");

  const submitButton = document.getElementById("res-submit");
  submitButton.disabled = true;
  submitButton.textContent = "Guardando…";

  try {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("url", url);
    if (summary) formData.set("summary", summary);
    if (kind) formData.set("kind", kind);
    if (projectId) formData.set("projectId", projectId);
    resourceState.shots.forEach((blob, i) => formData.append("files", blob, `captura-${i + 1}.png`));

    const result = await fetchJson("/api/ext/resources", { method: "POST", body: formData });
    if (!result.ok) {
      setStatus(status, "error", errorMessage(result));
      return;
    }
    setStatus(
      status,
      "success",
      `Guardado. <a href="${result.data.appUrl}" target="_blank" rel="noreferrer">Ver en Hilo</a>`,
    );
    setTimeout(() => window.close(), 1400);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Guardar recurso";
  }
}

// ------------------------------------------------------------ capturas

async function captureVisibleTab() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: "png" });
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch {
    return null;
  }
}

function imageFromClipboard(event) {
  const items = event.clipboardData?.items || [];
  for (const item of items) {
    if (item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

function addShot(list, container, blob) {
  list.push(blob);
  renderShots(container, list, (index) => list.splice(index, 1));
}

function renderShots(container, list, onRemove) {
  container.innerHTML = "";
  list.forEach((blob, index) => {
    const url = URL.createObjectURL(blob);
    const div = document.createElement("div");
    div.className = "shot";
    div.innerHTML = `<img src="${url}" alt="" /><button type="button" aria-label="Quitar">×</button>`;
    div.querySelector("button").addEventListener("click", () => {
      onRemove(index);
      renderShots(container, list, onRemove);
    });
    container.appendChild(div);
  });
}

// -------------------------------------------------------------- varios

function setStatus(el, kind, html) {
  el.innerHTML = `<div class="status ${kind}">${html}</div>`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
