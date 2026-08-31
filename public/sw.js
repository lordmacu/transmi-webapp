const SHELL_CACHE = "transmi-shell-v1";
const TILES_CACHE = "transmi-tiles-v1";
const API_CACHE  = "transmi-api-v1";

const TILES_MAX   = 600;   // máximo de tiles OSM guardados
const API_TTL_MS  = 10 * 60 * 1000; // 10 min para estaciones

// Recursos del shell de la app
const SHELL_URLS = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

// ─── Install: precachear shell ────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ─── Activate: limpiar cachés viejos ─────────────────────────────────────────
self.addEventListener("activate", (e) => {
  const keep = [SHELL_CACHE, TILES_CACHE, API_CACHE];
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { url } = e.request;

  // 1. Llegadas → siempre red (datos en tiempo real, nunca cachear)
  if (url.includes("/api/llegadas/")) return;

  // 2. Tiles de OpenStreetMap → cache-first con límite de entradas
  if (url.includes("tile.openstreetmap.org")) {
    e.respondWith(tileStrategy(e.request));
    return;
  }

  // 3. Endpoints de estaciones → stale-while-revalidate con TTL de 10 min
  if (url.includes("/api/stations")) {
    e.respondWith(stationsStrategy(e.request));
    return;
  }

  // 4. Assets del shell (JS, CSS, imágenes) → cache-first
  if (
    url.includes("/_next/static/") ||
    url.endsWith(".png") ||
    url.endsWith(".ico") ||
    url.endsWith(".json") ||
    url === self.location.origin + "/"
  ) {
    e.respondWith(cacheFirst(SHELL_CACHE, e.request));
    return;
  }

  // 5. Todo lo demás → network con fallback al cache
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// ─── Estrategias ─────────────────────────────────────────────────────────────

async function cacheFirst(cacheName, request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const c = await caches.open(cacheName);
    c.put(request, response.clone());
  }
  return response;
}

async function tileStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const c = await caches.open(TILES_CACHE);
      // Evitar que el caché de tiles crezca sin límite
      const keys = await c.keys();
      if (keys.length >= TILES_MAX) await c.delete(keys[0]);
      c.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

async function stationsStrategy(request) {
  const c = await caches.open(API_CACHE);
  const cached = await c.match(request);

  if (cached) {
    const date = cached.headers.get("sw-cached-at");
    const age = date ? Date.now() - Number(date) : Infinity;
    if (age < API_TTL_MS) return cached; // fresco → devolver directo
    // Vencido → devolver viejo mientras se actualiza en background
    fetchAndCache(c, request);
    return cached;
  }

  return fetchAndCache(c, request);
}

async function fetchAndCache(cache, request) {
  const response = await fetch(request);
  if (response.ok) {
    // Agregar header con timestamp para calcular TTL
    const headers = new Headers(response.headers);
    headers.set("sw-cached-at", String(Date.now()));
    const body = await response.arrayBuffer();
    cache.put(request, new Response(body, { status: response.status, headers }));
    return new Response(body, { status: response.status, headers: response.headers });
  }
  return response;
}
