// The service worker makes the site installable, and keeps the boards you have opened so they open without a connection.
//
// Pages (a board, the Boards list, the editor for a new board) are fetched from the network first, so what you see is
// always the current board; when there is no network the copy kept from the last visit is shown instead. The site's own
// scripts and styles are kept once fetched. Nothing is kept for anything else (editing, history, sign-in, the writing
// helper, saving), and signing out forgets every kept page.
const PAGES = "chalkwork-pages-v1";
const STATIC = "chalkwork-static-v1";
const MAX_PAGES = 60;
// What is worth keeping: a board, the list of boards, a new board, and a board kept on this device.
const KEEP = [/^\/c\/[^/]+\/?$/, /^\/boards\/?$/, /^\/new\/?$/, /^\/local\/[^/]+\/?$/];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      // Older versions of the kept copies are dropped.
      for (const name of await caches.keys()) if (name.startsWith("chalkwork-") && name !== PAGES && name !== STATIC) await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("message", (event) => {
  if (event.data === "forget-pages") event.waitUntil(caches.delete(PAGES));
});

const offlinePage = () =>
  new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Chalkwork</title>' +
      '<body style="font-family:sans-serif;background:#18211c;color:#eef0e6;max-width:32rem;margin:4rem auto;padding:0 1rem">' +
      "<h1>You are offline</h1><p>This page hasn't been opened on this device before, so there is no kept copy of it. Boards you have opened can be opened without a connection.</p>" +
      '<p><a style="color:#f5e58c" href="/boards">Boards</a></p>',
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

async function keep(request, response) {
  const cache = await caches.open(PAGES);
  await cache.put(request, response);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await cache.delete(key);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && KEEP.some((p) => p.test(url.pathname))) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          // Only a plain page is kept: not a redirect (to the access code or the sign-in page), not an error.
          if (response.status === 200 && !response.redirected && response.type === "basic") event.waitUntil(keep(request, response.clone()));
          return response;
        } catch {
          const cache = await caches.open(PAGES);
          return (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true })) || offlinePage();
        }
      })(),
    );
    return;
  }

  // The site's scripts, styles and fonts have names that change with their content, so a kept one is always right.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const kept = await cache.match(request);
        if (kept) return kept;
        const response = await fetch(request);
        if (response.status === 200) event.waitUntil(cache.put(request, response.clone()));
        return response;
      })(),
    );
  }
});
