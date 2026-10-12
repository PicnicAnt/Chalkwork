// A small service worker: it lets browsers treat the site as an installable app. Every request still goes to the
// network, so what you see is always the current board; nothing is kept for use offline.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
