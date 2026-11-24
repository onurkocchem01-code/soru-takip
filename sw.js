/* Soru ve Ödev Takip · service worker (tools/pages.py üretir, sadece GitHub Pages sürümünde)
   - Ağ önce: yeni sürüm hemen gelir; internet yoksa son açılan sürüm önbellekten açılır.
   - Bildirimler: sunucu (Kod.gs → FCM) veri mesajı gönderir, burada gösterilir.
   Apps Script ve Firebase isteklerine dokunmaz. */
const SURUM = "01a2fcce46";
const ONBELLEK = "soru-takip-" + SURUM;
const DOSYALAR = ["./", "manifest.webmanifest", "ikon-192.png", "favicon.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(ONBELLEK).then(c => c.addAll(DOSYALAR)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(l => Promise.all(l.filter(k => k.startsWith("soru-takip-") && k !== ONBELLEK).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || u.pathname.endsWith("surum.json") || u.pathname.endsWith("sw.js")) return;
  const ag = r.mode === "navigate" ? fetch(u.href, { cache: "no-cache", credentials: "same-origin" }) : fetch(r, { cache: "no-cache" });
  e.respondWith(ag.then(c => {
    if (c.ok) { const k = c.clone(); caches.open(ONBELLEK).then(x => x.put(r.mode === "navigate" ? "./" : r, k)); }
    return c;
  }).catch(() => caches.match(r.mode === "navigate" ? "./" : r).then(m => m || caches.match("./"))));
});

/* Bildirim: FCM veri mesajı { data: { baslik, metin, tur } } */
self.addEventListener("push", e => {
  let j = {};
  try { j = e.data ? e.data.json() : {}; } catch (_) { j = { metin: e.data ? e.data.text() : "" }; }
  const d = j.data || j.notification || j;
  const tur = d.tur || "";
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.baslik || d.title || "Soru ve Ödev Takip", {
      body: d.metin || d.body || "", icon: "ikon-192.png", tag: tur || "soru", renotify: true, data: { tur: tur }
    }),
    self.clients.matchAll({ type: "window" }).then(l => l.forEach(c => c.postMessage({ tip: "bildirim", tur: tur })))
  ]));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const tur = (e.notification.data || {}).tur || "";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => {
    const c = l.find(x => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ tip: "bildirim", tur: tur, tikla: true }); return c.focus(); }
    return self.clients.openWindow("./" + (tur ? "#" + tur : ""));
  }));
});
