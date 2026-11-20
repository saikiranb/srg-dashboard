// Minimal service worker: makes the app installable and shows an offline page.
// It deliberately NEVER caches pages or API/data responses, so staff sessions and live queues are always fresh.
const CACHE = "srg-shell-v3";
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

// Phone notifications for new service requests (staff only subscribe)
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data.json(); } catch {}
  e.waitUntil(self.registration.showNotification(d.title || "SRG Society", {
    body: d.body || "", icon: "/icon-192.png", badge: "/icon-192.png",
    tag: d.tag || "srg", renotify: true, vibrate: [250, 120, 250, 120, 250], data: { url: "/staff" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ("focus" in c) { if (c.navigate) c.navigate("/staff"); return c.focus(); }
    return self.clients.openWindow("/staff");
  }));
});
