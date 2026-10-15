/* Trip Planning Map: keeps the app and the map tiles you have viewed available without a signal. */
const SHELL = 'tpm-shell-v13', TILES = 'tpm-tiles-v1', MAX_TILES = 6000;
const FILES = ['./', 'index.html', 'leaflet.js', 'manifest.webmanifest', 'icon-192.png'];
const TILE_HOSTS = ['tile.openstreetmap.org', 'server.arcgisonline.com', 'basemap.nationalmap.gov', 'basemaps.cartocdn.com'];
const isTile = h => TILE_HOSTS.some(t => h === t || h.endsWith('.' + t));
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('tpm-') && k !== SHELL && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function trim() {
  const c = await caches.open(TILES), ks = await c.keys();
  for (let i = 0; i < ks.length - MAX_TILES; i++) await c.delete(ks[i]);
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (isTile(url.hostname)) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req.url); if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { c.put(req.url, res.clone()); if (Math.random() < 0.02) trim(); }
      return res;
    }));
  } else if (url.origin === self.location.origin) {
    // newest app when online (gives up after 4 s on a weak signal), saved copy when not
    e.respondWith(caches.open(SHELL).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
      if (!hit) return net;
      return Promise.race([net.catch(() => hit), new Promise(r => setTimeout(() => r(hit), 4000))]);
    }));
  }
});
