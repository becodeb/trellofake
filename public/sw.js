// Service worker mínimo de Hilo.
//
// Solo se mete en las navegaciones (cargar una página HTML completa): intenta
// la red primero y, si no hay red, muestra la página de reserva "/offline".
// Todo lo demás — /api/**, RSC payloads, adjuntos, fuentes, el propio manifest
// — pasa de largo sin tocar este service worker, así nunca queda una
// respuesta autenticada o de datos vieja pisando a una nueva. Cachear eso
// "para andar más rápido" es exactamente cómo se filtra el contenido de un
// usuario en la sesión de otro.

const CACHE_NAME = "hilo-shell-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo navegaciones. Todo pedido que no sea "cargar una página" (fetch de
  // datos, POST de una acción, un archivo) sigue de largo sin interceptarse.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(OFFLINE_URL);
      return cached ?? Response.error();
    }),
  );
});
