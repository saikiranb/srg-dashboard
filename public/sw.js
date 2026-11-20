// Minimal service worker: makes the app installable and shows an offline page.
// It deliberately NEVER caches pages or API/data responses, so staff sessions and live queues are always fresh.
const CACHE = "srg-shell-v2";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/offline.html", "/logo.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method === "GET" && r.mode === "navigate") {
    e.respondWith(fetch(r).catch(() => caches.match("/offline.html")));
  }
});
