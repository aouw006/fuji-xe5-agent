// Cache version — bump this on every deploy (or automate via build)
const CACHE_VERSION = Date.now(); // changes every deploy when sw.js is re-served
const CACHE_NAME = `xe5-agent-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  // Don't pre-cache anything — let requests populate the cache naturally
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Delete ALL old caches whenever a new SW activates
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls: always network, never cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: "Offline — please reconnect" }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Next.js static chunks (_next/static): these are content-hashed so safe to cache
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached || fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Everything else (HTML pages, manifests): NETWORK FIRST
  // This ensures deployments are always picked up
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
