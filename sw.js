const CACHE = "strongrun-v8";

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
  "icons/apple-touch-icon.png",

  /* Demonstracao dos exercicios (~2.2 MB no total). Baixados de appbefit.com;
     a origem de cada arquivo esta em videos/fontes.txt.
     Video novo aqui TEM de entrar nesta lista, igual a css/ e js/ — e o campo
     `video` do workouts.json tem de apontar para o mesmo caminho. */
  "videos/adduction-machine.mp4",
  "videos/alternate-single-leg-raise-plank.mp4",
  "videos/ativacao-agachamento-band.mp4",
  "videos/ativacao-aducao-em-pe-band.mp4",
  "videos/ativacao-coice-band.mp4",
  "videos/ativacao-extensao-com-rotacao.mp4",
  "videos/ativacao-marcha-band.mp4",
  "videos/ativacao-passada-lateral.mp4",
  "videos/ativacao-polichinelo-alternado.mp4",
  "videos/barbell-bent-over-row.mp4",
  "videos/barbell-single-leg-deadlift.mp4",
  "videos/barbell-stiff-leg-deadlift.mp4",
  "videos/bulgarian-split-squat.mp4",
  "videos/calf-raise-with-wall-support.mp4",
  "videos/dumbbell-bench-press.mp4",
  "videos/dumbbell-goblet-squat.mp4",
  "videos/dumbbell-hip-thrust.mp4",
  "videos/dumbbell-seated-shoulder-press.mp4",
  "videos/dumbbell-standing-calf-raise.mp4",
  "videos/front-plank.mp4",
  "videos/kettlebell-step-up.mp4",
  "videos/lying-leg-curl-machine.mp4",
  "videos/pallof-press.mp4",
  "videos/perna-abducao-quadril-em-pe.mp4",
  "videos/perna-bulgaro-kb-swing.mp4",
  "videos/perna-lunge-curtsy.mp4",
  "videos/perna-rdl-kettlebell.mp4",
  "videos/perna-rdl-unilateral.mp4",
  "videos/perna-salto-lateral-com-bola.mp4",
  "videos/perna-step-up-ponderado.mp4",
  "videos/perna-thruster-halteres.mp4",
  "videos/plio-bulgaro-bate-sobe-pe-step.mp4",
  "videos/plio-bulgaro-salto-unilateral.mp4",
  "videos/plio-coordenacao-unilateral-step.mp4",
  "videos/plio-salto-bilateral-step.mp4",
  "videos/plio-salto-dois-pes-step.mp4",
  "videos/plio-salto-frontal-uma-perna.mp4",
  "videos/plio-salto-frontal-unilateral-step.mp4",
  "videos/plio-salto-unilateral-step.mp4",
  "videos/plio-sobe-desce-step-frontal.mp4",
  "videos/plio-sobe-desce-step-lateral.mp4",
  "videos/pull-up-normal-grip.mp4",
  "videos/resistance-band-clam.mp4",
  "videos/side-plank.mp4",
  "videos/single-leg-romanian-deadlift-dumbbell.mp4",
  "videos/smith-machine-calf-raise.mp4",
  "videos/smith-squat.mp4",
  "videos/v-ups.mp4"
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

  /* Outro dominio (as fontes do Google): nao intercepta. Este handler nao sabe
     responder requisicao por faixa (Range) nem guardar resposta opaca, e o
     fallback para index.html devolveria HTML no lugar do arquivo pedido.
     Deixar o navegador cuidar sozinho. */
  if (new URL(req.url).origin !== location.origin) return;

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
