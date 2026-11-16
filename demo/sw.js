/* Service worker della demo: rende l'app installabile e veloce (cache dei file statici, avvio offline). */
const CACHE = "aurea-demo-v1";
const scope = new URL(self.registration.scope).pathname;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add(scope)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scope)) return;

  // Pagine: sempre dalla rete (così la demo si aggiorna), dalla cache solo offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.pathname === scope) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(scope, copy));
          }
          return res;
        })
        .catch(() => caches.match(scope).then((hit) => hit || Response.error())),
    );
    return;
  }

  // File con hash nel nome (JS, CSS, database WebAssembly): non cambiano mai, prima la cache.
  if (url.pathname.startsWith(scope + "assets/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
