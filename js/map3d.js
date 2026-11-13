/* ═══════════ 方舆形胜 · 3D v2（GPU 全图层版） ═══════════
   v3.1：DOM 标记全部转 GL 图层（治卡顿）；maxPitch 80（v3.0 被默认 60
   悄悄压平）；新增 晓雾山影 / 被引文柱 / 江河流光 / 开场长镜头。 */

window.__m3ready = false;
window.__m3fail = "";
window.__m3counts = {};

function glOK(){
  try{
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  }catch(e){ return false; }
}
if (typeof maplibregl === "undefined" || !glOK()){
  window.__m3fail = "WebGL 不可用";
  const f = document.getElementById("glfail");
  if (f){ f.style.display = "flex"; }
  const mp = document.getElementById("map3d");
  if (mp) mp.style.display = "none";
} else {

const m3 = new maplibregl.Map({
  container: "map3d",
  attributionControl: false,
  center: [96.5, 40.5], zoom: 2.9, pitch: 6, bearing: -42,
  minZoom: 2.6, maxZoom: 13, maxPitch: 80,
  antialias: true, fadeDuration: 0, refreshExpiredTiles: false,
  maxParallelImageRequests: 16,
  style: {
    version: 8,
    sources: {
      img: { type: "raster", tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ], tileSize: 256, maxzoom: 12 },
      dem: { type: "raster-dem", tiles: [
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
      ], encoding: "terrarium", tileSize: 256, maxzoom: 12 },
      rivers: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      frontier: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      fus: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      passes: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      ment: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#e7dcbc" } },
      { id: "img", type: "raster", source: "img", paint: { "raster-opacity": 1 } },
      { id: "hill", type: "hillshade", source: "dem",
        paint: { "hillshade-exaggeration": .42, "hillshade-shadow-color": "#3a2a14",
                 "hillshade-highlight-color": "#f4e9cf",
                 "hillshade-accent-color": "#8a6a3a" } },
      { id: "rivers", type: "line", source: "rivers",
        paint: { "line-color": ["get", "color"], "line-width":
          ["interpolate", ["linear"], ["zoom"], 4, 1.2, 8, 3, 12, 6],
          "line-opacity": .82 } },
      { id: "riversFlow", type: "line", source: "rivers",
        paint: { "line-color": "#f2ead6", "line-width":
          ["interpolate", ["linear"], ["zoom"], 4, .8, 8, 1.8, 12, 3.4],
          "line-opacity": .85, "line-dasharray": [0, 4, 3] } },
      { id: "frontier", type: "line", source: "frontier",
        paint: { "line-color": "#b23a2e", "line-width":
          ["interpolate", ["linear"], ["zoom"], 4, 1.6, 9, 3.6],
          "line-dasharray": [3, 1.6], "line-opacity": .9 } },
    ],
    fog: { range: [1.2, 12], color: "#e8dcc0", "high-color": "#eed9ae",
           "space-color": "#d9cba6", "horizon-blend": .3, "star-intensity": 0 },
  }
});
window.__m3 = m3;
try{ m3.setSky && m3.setSky({
  "sky-color": "#b9c7d6", "horizon-color": "#e8cf9e",
  "fog-color": "#e8dcc0", "sky-horizon-blend": .6,
  "horizon-fog-blend": .6, "fog-ground-blend": .2 }); }catch(e){}

let demFailed = false;
m3.on("error", e => {
  const msg = String((e && e.error && e.error.message) || e.error || "");
  if (!demFailed && (msg.indexOf("dem") >= 0 || msg.indexOf("elevation") >= 0 ||
      msg.indexOf("terrarium") >= 0)){
    demFailed = true;
    const chip = document.getElementById("demnote");
    if (chip) chip.style.display = "block";
  }
});

/* ── 悬浮信息卡 ── */
const card3 = document.getElementById("card3d");
function openCard3(kicker, html){
  document.getElementById("c3kick").textContent = kicker;
  document.getElementById("c3body").innerHTML = html;
  card3.classList.add("open");
}
document.getElementById("c3close").onclick = () => card3.classList.remove("open");

function openFu3(p, u){
  const zN = u.zhou.length, xN = u.xian.length + u.zx.reduce((s, z) => s + z.x.length, 0);
  const n = (window.FY_MENTIONS || {})[p.id + "|" + u.n];
  openCard3(p.name, `
    <div class="p-ju">${u.n}</div>
    ${u.now ? `<div class="p-now">治今 ${u.now}</div>` : ""}
    <div class="stat-strip" style="margin:8px 0">
      <div class="st"><b>${zN}</b><span>属州</span></div>
      <div class="st"><b>${xN}</b><span>领县</span></div>
      ${u.fg ? `<div class="st"><b>${u.fg}</b><span>附郭</span></div>` : ""}
      ${n ? `<div class="st"><b>${n}</b><span>全书被引</span></div>` : ""}
    </div>
    ${u.note ? `<div class="quote">${u.note}</div>` : ""}
    ${u.yan ? `<div class="p-cap">沿革</div><div class="quote">${u.yan}……</div>` : ""}
    <div class="readrow" style="margin-top:10px">
      <a class="readfull" style="text-decoration:none"
         href="index.html#mode=舆图&p=${p.id}&fu=${encodeURIComponent(u.n)}">⟨ 入 2D 详卷（四至·全文·县治）</a>
    </div>
    <div class="hint" style="margin-top:8px">2D 主场载有此府全部功能：原文全文、县治 Voronoi、书签、被引名次。</div>`);
}

/* ── 文本名签 → 运行时 sprite（楷体上 GPU，零 DOM） ── */
function textSprite(text){
  const pr = 2, pad = 4, h = 26 * pr;
  const c = document.createElement("canvas");
  const x = c.getContext("2d");
  x.font = `${21 * pr}px KaiTi, STKaiti, serif`;
  const w = Math.ceil(x.measureText(text).width) + pad * 2 * pr;
  c.width = w; c.height = h + 6 * pr;
  const x2 = c.getContext("2d");
  x2.font = `${21 * pr}px KaiTi, STKaiti, serif`;
  x2.shadowColor = "rgba(10,8,4,.95)"; x2.shadowBlur = 5 * pr;
  x2.fillStyle = "#f4ead2";
  x2.fillText(text, pad * pr, 20 * pr);
  const id = "lb_" + text;
  if (!m3.hasImage(id)) m3.addImage(id, x2.getImageData(0, 0, c.width, c.height), { pixelRatio: pr });
  return id;
}

function ring(lng, lat, rDeg, n = 10){
  const pts = [];
  for (let i = 0; i <= n; i++){
    const a = i / n * Math.PI * 2;
    pts.push([lng + Math.cos(a) * rDeg / Math.cos(lat * Math.PI / 180),
              lat + Math.sin(a) * rDeg]);
  }
  return [pts];
}

function buildOverlays(){
  const rf = RIVERS.map(r => ({ type: "Feature", properties: { color: r.color },
    geometry: { type: "LineString", coordinates: r.pts.map(p => [p[1], p[0]]) } }));
  m3.getSource("rivers").setData({ type: "FeatureCollection", features: rf });

  const line = PASSES.filter(q => q.type.indexOf("九边") >= 0 || q.type === "内三关")
    .sort((a, b) => a.c[1] - b.c[1]);
  m3.getSource("frontier").setData({ type: "FeatureCollection", features: [{
    type: "Feature", properties: {},
    geometry: { type: "LineString", coordinates: line.map(q => [q.c[1], q.c[0]]) } }] });

  /* 府治 → GPU 圆点（省色） */
  const ff = [];
  FY.provinces.forEach(p => p.fu.forEach(u => {
    if (!u.c) return;
    ff.push({ type: "Feature",
      properties: { pid: p.id, fu: u.n, color: PCOLORS[p.id] || "#2f5d70" },
      geometry: { type: "Point", coordinates: [u.c[1], u.c[0]] } });
  }));
  m3.getSource("fus").setData({ type: "FeatureCollection", features: ff });
  __m3counts.fu = ff.length;

  /* 关隘 → 朱点 + 楷体名签 sprite */
  const pf = PASSES.map(q => {
    const img = textSprite(q.n.replace(/关$|口$/, ""));
    return { type: "Feature",
      properties: { name: q.n, img, type: q.type, fu: q.fu, now: q.now,
                    lng: q.c[1], lat: q.c[0] },
      geometry: { type: "Point", coordinates: [q.c[1], q.c[0]] } };
  });
  m3.getSource("passes").setData({ type: "FeatureCollection", features: pf });
  __m3counts.pass = pf.length;
  __m3counts.labels = pf.length;

  m3.addLayer({ id: "ment", type: "fill-extrusion", source: "ment",
    paint: {
      "fill-extrusion-height": ["get", "h"],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": .52,
      "fill-extrusion-color": ["interpolate", ["linear"], ["get", "h"],
        0, "#d9a05a", 3000, "#c0603a", 7000, "#8f1f14"],
    }}, "frontier");
  m3.addLayer({ id: "fu", type: "circle", source: "fus",
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 2.6, 7, 5.5, 11, 10],
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4, .8, 8, 2],
      "circle-stroke-color": "rgba(246,239,220,.9)",
      "circle-opacity": .92,
    }});
  m3.addLayer({ id: "passDot", type: "circle", source: "passes",
    paint: {
      "circle-color": "#b23a2e",
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3.4, 10, 7],
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4, 1.2, 10, 2.4],
      "circle-stroke-color": "#f6efdc",
    }});
  m3.addLayer({ id: "passLab", type: "symbol", source: "passes", minzoom: 5,
    layout: {
      "icon-image": ["get", "img"],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 4, .72, 10, 1.05],
      "icon-allow-overlap": true, "icon-ignore-placement": true,
      "icon-anchor": "bottom", "icon-offset": [0, -5],
    }});

  /* 交互：点击/悬停 */
  m3.on("click", "fu", e => {
    const f = e.features && e.features[0]; if (!f) return;
    const p = FY.provinces.find(x => x.id === f.properties.pid);
    const u = p && p.fu.find(x => x.n === f.properties.fu);
    if (p && u) openFu3(p, u);
  });
  m3.on("click", "ment", e => {
    const f = e.features && e.features[0]; if (!f) return;
    const p = FY.provinces.find(x => x.id === f.properties.pid);
    const u = p && p.fu.find(x => x.n === f.properties.fu);
    if (p && u){ openFu3(p, u); return; }
  });
  m3.on("click", "passDot", e => {
    const f = e.features && e.features[0]; if (!f) return;
    const pr = f.properties;
    m3.flyTo({ center: [pr.lng, pr.lat - .06], zoom: 10.8, pitch: 74,
      bearing: m3.getBearing(), duration: 1800, essential: true });
    openCard3("关隘", `
      <div class="p-ju">${pr.name}</div>
      <div class="stat-strip" style="margin:8px 0">
        <div class="st"><b>${pr.type}</b><span>类型</span></div>
        <div class="st"><b>${pr.fu}</b><span>隶</span></div>
        <div class="st"><b>${pr.now}</b><span>今地</span></div>
      </div>
      <div class="readrow"><a class="readfull" style="text-decoration:none"
        href="index.html#mode=舆图&p=bian">⟨ 入 2D 九边专题</a></div>`);
  });
  ["fu", "passDot", "ment"].forEach(lid => {
    m3.on("mouseenter", lid, () => m3.getCanvas().style.cursor = "pointer");
    m3.on("mouseleave", lid, () => m3.getCanvas().style.cursor = "");
  });

  /* 被引文柱（示意尺度：log 被引 → 最高 9km） */
  const M = window.FY_MENTIONS || {};
  const ns = Object.values(M);
  const lo = Math.log(Math.max(1, Math.min(...ns))), hi = Math.log(Math.max(...ns));
  const mf = [];
  FY.provinces.forEach(p => p.fu.forEach(u => {
    const n = M[p.id + "|" + u.n];
    if (!n || !u.c) return;
    const h = Math.round(500 + 8500 * (hi > lo ? (Math.log(n) - lo) / (hi - lo) : .5));
    mf.push({ type: "Feature", properties: { h, pid: p.id, fu: u.n },
      geometry: { type: "Polygon", coordinates: ring(u.c[1], u.c[0], .13) } });
  }));
  m3.getSource("ment").setData({ type: "FeatureCollection", features: mf });
  __m3counts.ment = mf.length;
}

/* ── 江河流光（8fps 推移虚线相位） ── */
const dashSeq = [[0,4,3],[.5,4,2.5],[1,4,2],[1.5,4,1.5],[2,4,1],[2.5,4,.5],
                 [3,4,0],[2.5,4,.5],[2,4,1],[1.5,4,1.5],[1,4,2],[.5,4,2.5]];
let dashI = 0;
setInterval(() => {
  if (document.hidden || !window.__m3ready) return;
  try{ m3.setPaintProperty("riversFlow", "line-dasharray", dashSeq[dashI++ % dashSeq.length]); }catch(e){}
}, 125);

/* ── 文柱开关 ── */
const mentBtn = document.getElementById("mentbtn");
let mentOn = true;
if (mentBtn) mentBtn.onclick = () => {
  mentOn = !mentOn;
  m3.setLayoutProperty("ment", "visibility", mentOn ? "visible" : "none");
  mentBtn.textContent = mentOn ? "◧ 文柱 ✓" : "◧ 文柱";
};

m3.on("load", () => {
  buildOverlays();
  initEraLayers();
  showEra3(-1, false);
  window.__m3ready = true;
  const hadHash = applyDeepLink3(location.hash);
  window.__m3deeplinked = hadHash;
  /* 开场长镜头：自西域疾掠而至晋陕黄河大峡谷（用户一动即断；深链时让路） */
  if (!hadHash){
    m3.flyTo({ center: [110.4, 37.4], zoom: 5.5, pitch: 64, bearing: -16,
      duration: 5200, curve: 1.45, essential: true });
    m3.once("dragstart", () => { if (m3.isMoving()) m3.stop(); });   /* 空闲时 stop() 会毒化后续缓动 */
  }
  /* 高程懒探测：可达才挂地形（4s 超时降平面 + 提示） */
  fetch("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/6/32/15.png",
        { method: "GET", signal: AbortSignal.timeout(4000) })
    .then(r => { if (r.ok){ m3.setTerrain({ source: "dem", exaggeration: 1.4 }); window.__m3terrain = true; } })
    .catch(() => { const chip = document.getElementById("demnote"); if (chip) chip.style.display = "block"; });
});



/* ── 形胜书签：存视角 · 重飞 · 分享链接 ────────────────── */
const CAMKEY = "fy3dcams";
function camLoad(){ try{ return JSON.parse(localStorage.getItem(CAMKEY) || "[]"); }catch(e){ return []; } }
function camStore(a){ try{ localStorage.setItem(CAMKEY, JSON.stringify(a.slice(0, 12))); }catch(e){} }
function camHash(){
  const c = m3.getCenter();
  return "cam=" + [c.lng.toFixed(4), c.lat.toFixed(4), m3.getZoom().toFixed(2),
                  m3.getPitch().toFixed(1), m3.getBearing().toFixed(1)].join(",");
}
const camBtn = document.getElementById("cambmk");
const camBox = document.getElementById("camlist");
function renderCams(){
  if (!camBox) return;
  const a = camLoad();
  camBox.innerHTML = `<div class="cam-head">形胜书签<a id="camlnk" title="把当前视角写入地址栏，复制网址即可分享">⧉ 链接</a></div>` +
    (a.length ? a.map((x, i) =>
      `<div class="cam-item" data-i="${i}">
         <span class="ci-nm">${x.n}</span>
         <span class="ci-meta">z${x.z} · ${Math.round(x.p)}°</span>
         <i class="ci-del" data-d="${i}">✕</i></div>`).join("")
    : `<div class="cam-none">尚无书签——调好一眼山河，点 🔖 存之</div>`);
  camBox.querySelectorAll(".cam-item").forEach(it => it.onclick = e => {
    if (e.target.classList.contains("ci-del")){
      const a2 = camLoad(); a2.splice(+e.target.dataset.d, 1);
      camStore(a2); renderCams(); return;
    }
    const x = camLoad()[+it.dataset.i];
    if (x) m3.easeTo({ center: x.c, zoom: x.z, pitch: x.p, bearing: x.b,
      duration: 2200, easing: t => t * t * (3 - 2 * t) });   /* smoothstep 缓动 */
  });
  const lnk = camBox.querySelector("#camlnk");
  if (lnk) lnk.onclick = () => {
    history.replaceState(null, "", location.pathname + "#" + camHash());
    lnk.textContent = "✓ 已写入";
    setTimeout(() => { lnk.textContent = "⧉ 链接"; }, 1600);
  };
}
if (camBtn){
  camBtn.onclick = () => {
    const box = document.getElementById("camlist");
    const open = box.classList.toggle("open");
    if (open) renderCams();
  };
  /* 长按式主操作：直接存当前视角（在按钮上，与列表开合分离） */
  const saveNow = document.getElementById("camsave");
  if (saveNow) saveNow.onclick = () => {
    const a = camLoad();
    const names = ["一","二","三","四","五","六","七","八","九","十","十一","十二"];
    a.unshift({ n: "视角" + (names[a.length] || a.length + 1), c: m3.getCenter().toArray(),
      z: +m3.getZoom().toFixed(2), p: +m3.getPitch().toFixed(1), b: +m3.getBearing().toFixed(1) });
    camStore(a); renderCams();
    document.getElementById("camlist").classList.add("open");
  };
}

/* ── 深链：#era=N | #p=pid&fu=府名（2D ⛰ 形胜 带上下文进入） ── */
function applyDeepLink3(h){
  const q = new URLSearchParams(String(h || "").replace(/^#/, ""));
  if (![...q.keys()].length) return false;
  if (q.get("era") !== null){
    const i = Math.min(Math.max(+q.get("era") || 0, 0), ERAS.length - 1);
    if (eraRange){ eraRange.value = i; }
    showEra3(i, true);
    return true;
  }
  const camv = q.get("cam");
  if (camv){
    const v = camv.split(",").map(Number);
    if (v.length === 5 && v.every(x => isFinite(x))){
      stopTour(); stopEraPlay();
      m3.jumpTo({ center: [v[0], v[1]], zoom: v[2], pitch: v[3], bearing: v[4] });
      return true;
    }
  }
  const pid = q.get("p"), fuN = q.get("fu");
  if (pid){
    const p = FY.provinces.find(x => x.id === pid);
    const u = p && (fuN ? p.fu.find(x => x.n === fuN) : p.fu.find(x => x.c));
    if (u && u.c){
      stopTour(); stopEraPlay();
      m3.flyTo({ center: [u.c[1], u.c[0] - .12], zoom: 9.4, pitch: 68,
        bearing: -14, duration: 2600, essential: true });
      setTimeout(() => openFu3(p, u), 1400);
      return true;
    }
  }
  return false;
}
window.applyDeepLink3 = applyDeepLink3;

/* ── 形胜视角 ── */
const SCENES = [
  { n: "九边全景",   c: [111.5, 40.2],  z: 4.4, p: 48, b: 0 },
  { n: "居庸望京师", c: [116.15, 40.22], z: 10.8, p: 76, b: 168 },
  { n: "潼关望河曲", c: [110.32, 34.62], z: 10.8, p: 74, b: 40 },
  { n: "剑门窥蜀",   c: [105.5, 32.28],  z: 10.8, p: 76, b: 205 },
  { n: "山海关观海", c: [119.82, 40.08], z: 11,   p: 72, b: 118 },
  { n: "夔门峡口",   c: [109.55, 31.02], z: 11,   p: 74, b: 105 },
  { n: "井陉出太行", c: [114.05, 38.06], z: 11,   p: 76, b: 100 },
  { n: "河套阴山",   c: [109.6, 40.85],  z: 8.6,  p: 64, b: 8 },
];
const sel = document.getElementById("scenes");
SCENES.forEach((s, i) => {
  const o = document.createElement("option");
  o.value = i; o.textContent = s.n;
  sel.appendChild(o);
});
sel.onchange = () => {
  const s = SCENES[+sel.value];
  if (!s) return;
  stopTour();
  m3.flyTo({ center: s.c, zoom: s.z, pitch: s.p, bearing: s.b,
    duration: 3200, curve: 1.5, essential: true });
};



/* ── 九朝旁白（TTS）：推演时读朝代与首二大事 ──────────── */
let eraVoice = null, narrOn = true;
function pickVoice3(){
  const vs = speechSynthesis.getVoices();
  eraVoice = vs.find(v => /zh[-_]CN/i.test(v.lang) && /female|Huihui|Yaoyao/i.test(v.name))
          || vs.find(v => /^zh/i.test(v.lang)) || null;
}
if ("speechSynthesis" in window){
  pickVoice3();
  speechSynthesis.onvoiceschanged = pickVoice3;
}
function narrateEra(e){
  if (!narrOn || !("speechSynthesis" in window) || !e) return;
  try{ speechSynthesis.cancel(); }catch(_){}
  const txt = e.label + "。" + e.time.replace("—", "至") + "。" +
    e.evs.slice(0, 2).map(v => v[1]).join("。");
  const u = new SpeechSynthesisUtterance(txt);
  if (eraVoice) u.voice = eraVoice;
  u.lang = "zh-CN"; u.rate = 0.95;
  speechSynthesis.speak(u);
}
const narrBtn = document.getElementById("narrbtn");
if (narrBtn) narrBtn.onclick = () => {
  narrOn = !narrOn;
  narrBtn.textContent = narrOn ? "🔊" : "🔇";
  if (!narrOn){ try{ speechSynthesis.cancel(); }catch(_){} }
};

/* ── 山河九朝：疆域低墙 + 王都擎柱 + 时间轴推演 ─────────── */
function hullLngLat(points, pad){
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts){ while (lo.length > 1 && cross(lo[lo.length-2], lo[lo.length-1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--){ const p = pts[i];
    while (up.length > 1 && cross(up[up.length-2], up[up.length-1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop();
  const hull = lo.concat(up);
  if (hull.length < 3) return null;
  const n = hull.length;
  const cLat = hull.reduce((s, p) => s + p[1], 0) / n, cLng = hull.reduce((s, p) => s + p[0], 0) / n;
  return hull.map(p => [cLng + (p[0] - cLng) * pad, cLat + (p[1] - cLat) * pad]);
}
function initEraLayers(){
  m3.addSource("era", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  m3.addLayer({ id: "eraWall", type: "fill-extrusion", source: "era", filter: ["==", ["get", "k"], "wall"],
    paint: { "fill-extrusion-height": 22000, "fill-extrusion-base": 0,
      "fill-extrusion-color": "#b23a2e", "fill-extrusion-opacity": .22 } });
  m3.addLayer({ id: "eraPlc", type: "fill-extrusion", source: "era", filter: ["==", ["get", "k"], "plc"],
    paint: { "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0,
      "fill-extrusion-color": "#4a4034", "fill-extrusion-opacity": .8 } });
  m3.addLayer({ id: "eraCap", type: "fill-extrusion", source: "era", filter: ["==", ["get", "k"], "cap"],
    paint: { "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0,
      "fill-extrusion-color": "#c0392b", "fill-extrusion-opacity": .88 } });
}

function eraRingPts(lng, lat, rDeg){ return eraRingPoly(lng, lat, rDeg)[0]; }
function eraRingPoly(lng, lat, rDeg){
  const pts = [];
  for (let i = 0; i <= 10; i++){
    const a = i / 10 * Math.PI * 2;
    pts.push([lng + Math.cos(a) * rDeg / Math.cos(lat * Math.PI / 180), lat + Math.sin(a) * rDeg]);
  }
  return [pts];
}
let curEra3 = -1;
const eraLab = document.getElementById("eralab");
const eraRange = document.getElementById("erarange");
function showEra3(i, fly){
  curEra3 = i;
  const e = ERAS[i];
  const feats = [];
  if (e){
    const pts = [...e.caps, ...e.plcs].map(c => [c[2], c[1]]);
    const hull = hullLngLat(pts, 1.35);
    if (hull) feats.push({ type: "Feature", properties: { k: "wall" },
      geometry: { type: "Polygon", coordinates: [[...hull, hull[0]]] } });
    e.caps.forEach(c => feats.push({ type: "Feature", properties: { k: "cap", h: 90000 },
      geometry: { type: "Polygon", coordinates: eraRingPoly(c[2], c[1], .5) } }));
    e.plcs.forEach(c => feats.push({ type: "Feature", properties: { k: "plc", h: 30000 },
      geometry: { type: "Polygon", coordinates: eraRingPoly(c[2], c[1], .32) } }));
    if (fly){
      const b = [[Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1]))],
                 [Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]];
      m3.fitBounds(b, { padding: 120, pitch: 52, bearing: 0, duration: 2100, maxZoom: 5.4 });
    }
    if (eraLab) eraLab.innerHTML = `<b>${e.label}</b><i>${e.time}</i>`;
    if (fly && eraPlaying) narrateEra(e);
    if (eraLab) eraLab.onclick = () => {
      if (curEra3 < 0) return;
      const ev = ERAS[curEra3].evs.map(v =>
        `<div class="ev"><span class="y">${v[0]}</span><span class="t">${v[1]}</span></div>`).join("");
      openCard3(ERAS[curEra3].label + "纪", `
        <div class="p-ju">${e.label}<span style="font-size:12px;color:var(--ink-faint)"> ${e.time}</span></div>
        <div class="p-cap">都城</div>
        <div class="chips">${e.caps.map(c => `<span class="chip fg">${c[0]}</span>`).join("")}</div>
        <div class="p-cap">要地</div>
        <div class="chips">${e.plcs.map(c => `<span class="chip">${c[0]}</span>`).join("")}</div>
        <div class="p-cap">大事</div>${ev}
        <div class="readrow" style="margin-top:8px">
          <a class="readfull" style="text-decoration:none"
             href="index.html#mode=形势&era=${curEra3}">⟨ 入 2D 形势卷（原文全文）</a>
        </div>`);
    };
  } else if (eraLab){
    eraLab.innerHTML = "<b>山河九朝</b><i>拖动推演历朝疆域</i>";
    eraLab.onclick = null;
  }
  const es = m3.getSource("era");
  if (es) es.setData({ type: "FeatureCollection", features: feats });
  /* 疆域自地而起：墙与柱高度 0 → 定值，9 步升起（约 1.1s） */
  if (e && es){
    let st = 0;
    const steps = 9;
    const grow = () => {
      st++;
      const t = st / steps;
      try{
        m3.setPaintProperty("eraWall", "fill-extrusion-height", Math.round(22000 * t));
        m3.setPaintProperty("eraCap", "fill-extrusion-height",
          ["interpolate", ["linear"], ["get", "h"], 0, 0, 90000, Math.round(90000 * t)]);
        m3.setPaintProperty("eraPlc", "fill-extrusion-height",
          ["interpolate", ["linear"], ["get", "h"], 0, 0, 30000, Math.round(30000 * t)]);
      }catch(_){}
      if (st < steps) setTimeout(grow, 120);
    };
    grow();
  }
  else window.__m3era = i;
  window.__m3era = i;
}
if (eraRange){
  eraRange.min = -1;
  eraRange.max = ERAS.length - 1;
  eraRange.value = -1;
  eraRange.oninput = () => { stopEraPlay(); stopTour(); showEra3(+eraRange.value, true); };
}
/* 九朝自动推演 */
let eraPlaying = false, eraTimer = null;
const eraPlayBtn = document.getElementById("eraplay");
function stopEraPlay(){
  if (!eraPlaying) return;
  eraPlaying = false;
  clearTimeout(eraTimer);
  if (eraPlayBtn) eraPlayBtn.textContent = "▶";
}
if (eraPlayBtn) eraPlayBtn.onclick = () => {
  if (eraPlaying){ stopEraPlay(); return; }
  stopTour();
  eraPlaying = true;
  eraPlayBtn.textContent = "⏸";
  const step = () => {
    if (!eraPlaying) return;
    const nx = (curEra3 + 1) % ERAS.length;
    eraRange.value = nx;
    showEra3(nx, true);
    eraTimer = setTimeout(step, 4300);
  };
  step();
};
/* ── 九边飞览 ── */
const TOUR_NAMES = ["嘉峪关","凉州堡","宁夏镇","花马池","榆林镇","偏头关",
                    "雁门关","大同镇","宣府镇","古北口","山海关"];
const TOUR = TOUR_NAMES.map(n => PASSES.find(q => q.n === n)).filter(Boolean);
let touring = false, tourIdx = 0, tourTimer = null;
const tourBtn = document.getElementById("tourbtn");
const tourLab = document.getElementById("tourlab");
const tourBig = document.getElementById("tourbig");
function bearingTo(a, b){
  const dy = (b[0] - a[0]), dx = (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180);
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}
function tourStep(){
  if (!touring) return;
  const q = TOUR[tourIdx], nx = TOUR[(tourIdx + 1) % TOUR.length];
  const br = bearingTo([q.c[1], q.c[0]], [nx.c[1], nx.c[0]]);
  m3.flyTo({ center: [q.c[1], q.c[0] - .1], zoom: 10.4, pitch: 74,
    bearing: br, duration: 3600, curve: 1.3, essential: true });
  tourLab.textContent = `${q.n}（${tourIdx + 1}/${TOUR.length}）`;
  tourBig.textContent = q.n;
  tourBig.classList.remove("pop");
  void tourBig.offsetWidth;              // 重触发动画
  tourBig.classList.add("pop");
  tourIdx = (tourIdx + 1) % TOUR.length;
  tourTimer = setTimeout(tourStep, 4400);
}
function stopTour(){
  if (!touring) return;
  touring = false;
  clearTimeout(tourTimer);
  tourBtn.textContent = "▶ 飞览九边";
  tourLab.textContent = "";
  tourBig.classList.remove("pop");
  tourBig.textContent = "";
}
tourBtn.onclick = () => {
  if (touring){ stopTour(); return; }
  stopEraPlay();
  touring = true;
  tourBtn.textContent = "⏸ 停止";
  tourStep();
};
m3.on("click", stopTour);

m3.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");

} /* WebGL guard end */
