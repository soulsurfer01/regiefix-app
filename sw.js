const CACHE = "regiefix-1.0.1";
const FILES = ["./", "./index.html", "./manifest.json", "./regiefix-180.png", "./regiefix-167.png", "./regiefix-152.png", "./regiefix-120.png", "./regiefix-192.png", "./regiefix-512.png", "./regiefix-1024.png", "./jspdf.umd.min.js", "./nacl-fast.min.js", "./jsQR.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Netzwerk zuerst, offline aus dem Cache
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
