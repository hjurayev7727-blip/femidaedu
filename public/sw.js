// A+ Huquq service worker.
// Faqat statik resurslar keshlanadi. Sahifalar (HTML) va API hech qachon keshlanmaydi — ular foydalanuvchiga
// xos (kabinet, natijalar); umumiy qurilmada boshqa odamning ma'lumoti ko'rinib qolmasin.
// Internet yo'q bo'lsa — /offline sahifasi.

const VERSION = "aplus-v1";
const STATIC = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Next.js statik fayllari (nomida xesh bor — o'zgarmaydi) va ikonkalar: avval kesh
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Sahifalar: faqat tarmoq; tarmoq bo'lmasa — offline sahifa (foydalanuvchi ma'lumoti keshlanmaydi)
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
