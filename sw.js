const CACHE = "dbt-9960d2b85c";
const FILES = ["./", "app.js", "d/0.bin", "d/1.bin", "d/10.bin", "d/11.bin", "d/12.bin", "d/13.bin", "d/14.bin", "d/15.bin", "d/16.bin", "d/17.bin", "d/18.bin", "d/19.bin", "d/2.bin", "d/20.bin", "d/21.bin", "d/22.bin", "d/23.bin", "d/24.bin", "d/25.bin", "d/26.bin", "d/27.bin", "d/28.bin", "d/29.bin", "d/3.bin", "d/30.bin", "d/31.bin", "d/32.bin", "d/33.bin", "d/34.bin", "d/35.bin", "d/36.bin", "d/37.bin", "d/38.bin", "d/39.bin", "d/4.bin", "d/40.bin", "d/41.bin", "d/42.bin", "d/43.bin", "d/44.bin", "d/45.bin", "d/46.bin", "d/47.bin", "d/48.bin", "d/49.bin", "d/5.bin", "d/50.bin", "d/51.bin", "d/52.bin", "d/53.bin", "d/54.bin", "d/55.bin", "d/56.bin", "d/57.bin", "d/58.bin", "d/59.bin", "d/6.bin", "d/60.bin", "d/61.bin", "d/62.bin", "d/63.bin", "d/64.bin", "d/65.bin", "d/66.bin", "d/67.bin", "d/68.bin", "d/69.bin", "d/7.bin", "d/70.bin", "d/71.bin", "d/72.bin", "d/73.bin", "d/8.bin", "d/9.bin", "d/data.bin", "icon-180.png", "icon-192.png", "icon-512.png", "index.html", "lock.json", "manifest.json", "styles.css"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.pathname.endsWith("/lock.json")) { e.respondWith(fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true }))); return; }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
