// Opciones de la extensión: URL de Hilo + token de API, guardados en
// chrome.storage.local. Al guardar se pide permiso de host para esa URL
// exacta (optional_host_permissions) — así una instancia propia (local o de
// otra LAN) también puede recibir requests de la extensión.

const DEFAULT_URL = "https://hilo.becode.com.ar";

document.addEventListener("DOMContentLoaded", async () => {
  const urlInput = document.getElementById("hilo-url");
  const tokenInput = document.getElementById("api-token");
  const tokensLink = document.getElementById("tokens-link");

  const stored = await getStored();
  urlInput.value = stored.hiloUrl || DEFAULT_URL;
  tokenInput.value = stored.apiToken || "";
  updateTokensLink();

  urlInput.addEventListener("input", updateTokensLink);
  function updateTokensLink() {
    const url = normalizeUrl(urlInput.value) || DEFAULT_URL;
    tokensLink.href = `${url}/ajustes`;
  }

  document.getElementById("save").addEventListener("click", () => save(urlInput, tokenInput));
  document.getElementById("test").addEventListener("click", () => test(urlInput, tokenInput));
});

function getStored() {
  return new Promise((resolve) => chrome.storage.local.get(["hiloUrl", "apiToken"], (data) => resolve(data || {})));
}

function normalizeUrl(raw) {
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

async function save(urlInput, tokenInput) {
  const status = document.getElementById("status");
  const url = normalizeUrl(urlInput.value);
  const token = tokenInput.value.trim();

  if (!url) return setStatus(status, "error", "Esa URL no es válida.");
  if (!token) return setStatus(status, "error", "Pegá el token de API.");

  // El permiso de host es opcional y por sitio: sin él, fetch() puede seguir
  // funcionando gracias al CORS que ya sirve /api/ext/**, pero pedirlo evita
  // sorpresas con instancias propias (local, LAN) donde el navegador es más
  // estricto. Si el usuario lo rechaza, igual se guarda la configuración.
  await new Promise((resolve) => {
    chrome.permissions.request({ origins: [`${url}/*`] }, () => resolve());
  });

  chrome.storage.local.set({ hiloUrl: url, apiToken: token }, () => {
    setStatus(status, "success", "Guardado.");
  });
}

async function test(urlInput, tokenInput) {
  const status = document.getElementById("status");
  const url = normalizeUrl(urlInput.value);
  const token = tokenInput.value.trim();
  if (!url || !token) return setStatus(status, "error", "Completá la URL y el token antes de probar.");

  setStatus(status, null, "Probando…");
  try {
    const response = await fetch(`${url}/api/ext/me`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        response.status === 401
          ? "Token de API inválido o vencido."
          : data?.error || `Hilo respondió ${response.status}.`;
      return setStatus(status, "error", message);
    }
    setStatus(status, "success", `Conectado como ${data.user.name} (${data.team.name}, rol ${data.role}).`);
  } catch {
    setStatus(status, "error", "No se pudo conectar. Revisá la URL (¿necesita estar prendido el server local?).");
  }
}

function setStatus(el, kind, text) {
  el.innerHTML = kind ? `<div class="status ${kind}">${text}</div>` : `<p class="hint">${text}</p>`;
}
