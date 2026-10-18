/* IronLog service worker: makes the app shell available offline.
 * Data offline is handled by Firestore's IndexedDB cache, not here.
 *  - HTML / RSC navigations: network-first, fall back to cache.
 *  - /_next/static (content-hashed): cache-first.
 *  - /api/* and cross-origin requests (Firestore, Google): never cached.
 */
const VERSION = "v1";
const PAGES = `ironlog-pages-${VERSION}`;
const STATIC = `ironlog-static-${VERSION}`;
const ROUTES = ["/", "/entrenar", "/progreso", "/coach", "/mas", "/medidas", "/actividad", "/nutricion", "/ejercicios", "/planes", "/marcas", "/historial", "/ajustes", "/login"];
const MAX_STATIC = 400;

async function precache() {
  const pages = await caches.open(PAGES);
  const stat = await caches.open(STATIC);
  const assets = new Set();
  await Promise.all(
    ROUTES.map(async (route) => {
      try {
        const res = await fetch(route, { credentials: "same-origin" });
        if (!res.ok) return;
        const html = await res.clone().text();
        await pages.put(route, res);
        for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(m[0]);
      } catch {
        /* offline during install: cache lazily later */
      }
    }),
  );
  await Promise.all([...assets].map((a) => stat.add(a).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ironlog-") && ![PAGES, STATIC].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === "basic") cache.put(cacheKey, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(cacheKey)) || (request.mode === "navigate" ? await cache.match("/") : undefined);
    if (hit) return hit;
    return new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    cache.put(request, res.clone());
    trim(STATIC, MAX_STATIC);
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, url.pathname));
    return;
  }
  if (isRsc) {
    // The _rsc query param already varies per route/router state, so the full URL is the key.
    event.respondWith(networkFirst(request, request.url));
  }
});
