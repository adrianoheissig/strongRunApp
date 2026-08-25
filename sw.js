const CACHE = "strongrun-v4";

/* ⚠️ Arquivo novo em css/ ou js/ TEM de entrar aqui, senão o app quebra offline.
   O `addAll` é tudo-ou-nada: um caminho errado nesta lista e a instalação do
   service worker falha inteira, em silêncio. */
const ASSETS = [
  "./",
  "index.html",
  "workouts.json",
  "manifest.json",

  "css/tokens.css",
  "css/base.css",
  "css/buttons.css",
  "css/pick.css",
  "css/run.css",
  "css/form.css",
  "css/summary.css",

  "js/main.js",
  "js/state.js",
  "js/session.js",
  "js/render.js",
  "js/events.js",
  "js/dom.js",
  "js/audio.js",
  "js/format.js",
  "js/workouts.js",
  "js/storage.js",

  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// workouts.json: rede primeiro, para o treino editado no repo aparecer sem
// precisar bumpar a versão do cache. Resto: cache primeiro.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (new URL(req.url).pathname.endsWith("workouts.json")) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match("index.html")))
  );
});
