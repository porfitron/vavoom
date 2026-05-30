const CACHE_VERSION = "svv-jukebox-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const AUDIO_CACHE = `${CACHE_VERSION}-audio`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./tracks/manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("svv-jukebox-") && key !== SHELL_CACHE && key !== AUDIO_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

function isAudioRequest(request) {
  const url = new URL(request.url);
  return url.pathname.includes("/tracks/") && /\.mp3$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !isSameOrigin(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (isAudioRequest(request)) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch (e) {
          if (cached) return cached;
          throw e;
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const pathname = new URL(request.url).pathname;
        if (response.ok && (pathname.includes("/icons/") || pathname.endsWith("/manifest.json"))) {
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      });
    })
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "CACHE_TRACK") return;
  const url = event.data.url;
  if (!url) return;
  event.waitUntil(
    caches.open(AUDIO_CACHE).then(async (cache) => {
      const existing = await cache.match(url);
      if (existing) return;
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch (e) {}
    })
  );
});
