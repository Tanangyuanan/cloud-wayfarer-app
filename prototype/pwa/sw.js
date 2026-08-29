const CACHE_NAME = "cloud_wayfarer-pwa-v21";
const APP_SHELL = [
  "/app/",
  "/app/index.html",
  "/app/platform-entry.js?v=17",
  "/app/data-client.js?v=18",
  "/app/letter-archive.js?v=19",
  "/app/styles.css?v=21",
  "/app/app.js?v=21",
  "/prototype/ajing-chat.css?v=17",
  "/prototype/ajing-chat.js?v=18",
  "/prototype/assets/ajing-avatar-v1.png",
  "/prototype/assets/user-journal-cover-guizhou-light-v3.png",
  "/app/manifest.webmanifest",
  "/app/assets/app-icon-180.png",
  "/app/assets/app-icon-192.png",
  "/app/assets/app-icon-512.png",
  "/app/assets/brand-logo-horizontal.png",
  "/app/assets/icons.svg",
  "/app/assets/guizhou-road.jpg",
  "/app/assets/hailongtun-past.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isAppAsset = url.pathname.startsWith("/app");
  const isAjingChatAsset = [
    "/prototype/ajing-chat.css",
    "/prototype/ajing-chat.js",
    "/prototype/assets/ajing-avatar-v1.png",
    "/prototype/assets/user-journal-cover-guizhou-light-v3.png"
  ].includes(url.pathname);
  if (!isAppAsset && !isAjingChatAsset) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && url.pathname.startsWith("/app")) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/app/index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("/app/index.html"))
    );
    return;
  }

  const shouldRefreshFirst = ["/app/styles.css", "/app/app.js", "/app/data-client.js", "/app/letter-archive.js", "/app/platform-entry.js"].includes(url.pathname);
  if (shouldRefreshFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok && (url.pathname.startsWith("/app/") || isAjingChatAsset)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
