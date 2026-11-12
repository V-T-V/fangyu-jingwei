/* ═══════════ 方舆经纬 · Service Worker ═══════════
   三级缓存：SHELL 外壳预存 · TEXTS 全文懒存（首查后整本书离线）
             TILES 瓦片限额存（stale-while-revalidate）
   VERSION 与 index.html 的 ?v= 同步递增（当前 v75）。 */

const VERSION = "v81";
const SHELL = `fy-${VERSION}-shell`;
const TEXTS = `fy-${VERSION}-texts`;
const TILES = `fy-${VERSION}-tiles`;
const TILE_CAP = 1200;          // 瓦片上限（约 40MB），超限整体重置
const SHELL_FILES = [
  "./", "./index.html", "./manifest.json",
  "./css/main.css?v=81",
  "./vendor/leaflet.js", "./vendor/leaflet.css",
  "./data/site_data.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png",
  "./js/config.js?v=81", "./js/map.js?v=81", "./js/panels.js?v=81",
  "./js/rail.js?v=81", "./js/search.js?v=81", "./js/reader.js?v=81",
  "./js/bookmarks.js?v=81", "./js/fulltext.js?v=81", "./js/app.js?v=81",
  "./js/modes.js?v=81", "./js/analytics.js?v=81",
  "./js/wenxin.js?v=81",
  "./js/bian.js?v=81",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![SHELL, TEXTS, TILES].includes(k))
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

let tilePuts = 0;
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* 页面导航：网络优先（保新鲜），离线回退缓存外壳 */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(r => {
        const cp = r.clone();
        caches.open(SHELL).then(c => c.put("./index.html", cp));
        return r;
      }).catch(() =>
        caches.match("./index.html", { ignoreSearch: true })
          .then(r => r || Response.error()))
    );
    return;
  }

  /* 瓦片：stale-while-revalidate + 限额 */
  if (url.hostname === "server.arcgisonline.com") {
    e.respondWith((async () => {
      const cache = await caches.open(TILES);
      const hit = await cache.match(req);
      const fresh = fetch(req).then(r => {
        if (r.ok) {
          tilePuts++;
          cache.put(req, r.clone()).then(async () => {
            if (tilePuts % 100 === 0) {          // 周期性限额检查
              const keys = await cache.keys();
              if (keys.length > TILE_CAP) await caches.delete(TILES);
            }
          });
        }
        return r;
      }).catch(() => null);
      return hit || (await fresh) || Response.error();
    })());
    return;
  }

  /* 同源资源：缓存优先（js/css/数据/全文/图标），未命中网络回填 */
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cacheName = url.pathname.includes("/data/text/") ? TEXTS : SHELL;
      const cache = await caches.open(cacheName);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok && (url.pathname.startsWith("/js/") || url.pathname.startsWith("/css/") ||
                     url.pathname.startsWith("/data/") || url.pathname.startsWith("/vendor/") ||
                     url.pathname.startsWith("/icons/"))) {
          cache.put(req, r.clone());
        }
        return r;
      } catch (err) {
        return Response.error();
      }
    })());
  }
  /* 其余跨源：直连 */
});
