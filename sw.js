// Service worker mínimo: cachea el shell para que la app abra offline.
// Los datos (Firebase) y las imágenes (ddragon/storage) siempre van a la red.
const CACHE = "lol-squad-v1";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Solo cacheamos el shell propio; todo lo demás (Firebase, APIs, CDNs) va directo a la red.
  if (e.request.method === "GET" && url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
    );
  }
});
