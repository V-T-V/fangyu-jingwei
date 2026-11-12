/* ═══════════ 方舆形胜 · 3D 版（与 2D 平行：MapLibre + 真地形） ═══════════
   与 2D 共享 site_data/config/美学；本页只做 2D 原理上做不到的事：
   真山川、九边飞览、形胜视角。全量功能仍以 2D 为主场，双向深链互跳。 */

window.__m3ready = false;
window.__m3fail = "";

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
  center: [110.5, 36.5], zoom: 3.7, pitch: 50, bearing: 0,
  minZoom: 3, maxZoom: 13,
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
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#e7dcbc" } },
      { id: "img", type: "raster", source: "img", paint: { "raster-opacity": 1 } },
      { id: "rivers", type: "line", source: "rivers",
        paint: { "line-color": ["get", "color"], "line-width":
          ["interpolate", ["linear"], ["zoom"], 4, 1.2, 8, 2.6, 12, 5],
          "line-opacity": .8 } },
      { id: "frontier", type: "line", source: "frontier",
        paint: { "line-color": "#b23a2e", "line-width":
          ["interpolate", ["linear"], ["zoom"], 4, 1.6, 9, 3.4],
          "line-dasharray": [3, 1.6], "line-opacity": .85 } },
    ],
    fog: { range: [1, 11], color: "#e8dcc0", "high-color": "#ecd9b0",
           "space-color": "#d9cba6", "horizon-blend": .25, "star-intensity": 0 },
  }
});
window.__m3 = m3;

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

/* ── 悬浮信息卡（复用 2D 美学类） ── */
const card3 = document.getElementById("card3d");
const c3body = document.getElementById("c3body");
function openCard3(kicker, html){
  document.getElementById("c3kick").textContent = kicker;
  c3body.innerHTML = html;
  card3.classList.add("open");
}
document.getElementById("c3close").onclick = () => card3.classList.remove("open");

/* ── 标记 ── */
function el(cls, html){
  const d = document.createElement("div");
  d.className = cls;
  if (html != null) d.innerHTML = html;
  return d;
}
function openFu3(p, u){
  const zN = u.zhou.length, xN = u.xian.length + u.zx.reduce((s, z) => s + z.x.length, 0);
  openCard3(p.name, `
    <div class="p-ju">${u.n}</div>
    ${u.now ? `<div class="p-now">治今 ${u.now}</div>` : ""}
    <div class="stat-strip" style="margin:8px 0">
      <div class="st"><b>${zN}</b><span>属州</span></div>
      <div class="st"><b>${xN}</b><span>领县</span></div>
      ${u.fg ? `<div class="st"><b>${u.fg}</b><span>附郭</span></div>` : ""}
    </div>
    ${u.note ? `<div class="quote">${u.note}</div>` : ""}
    ${u.yan ? `<div class="p-cap">沿革</div><div class="quote">${u.yan}……</div>` : ""}
    <div class="readrow" style="margin-top:10px">
      <a class="readfull" style="text-decoration:none" target="_self"
         href="index.html#mode=舆图&p=${p.id}&fu=${encodeURIComponent(u.n)}">⟨ 入 2D 详卷（四至·全文·县治）</a>
    </div>
    <div class="hint" style="margin-top:8px">2D 主场载有此府全部功能：原文全文、县治 Voronoi、书签、被引名次。</div>`);
}

function buildMarkers(){
  /* 府治印 */
  FY.provinces.forEach(p => p.fu.forEach(u => {
    if (!u.c) return;
    const col = PCOLORS[p.id] || "#2f5d70";
    const d = el("fu3d");
    d.style.setProperty("--pc", col);
    d.title = u.n;
    new maplibregl.Marker({ element: d })
      .setLngLat([u.c[1], u.c[0]]).addTo(m3);
    d.onclick = ev => { ev.stopPropagation(); openFu3(p, u); };
  }));
  /* 关隘：朱菱 + 名签 */
  PASSES.forEach(q => {
    const d = el("pass3d", `<i class="diamond3d"></i><span>${q.n.replace(/关$|口$/,"")}</span>`);
    d.title = `${q.n} · ${q.type} · ${q.fu} · 今${q.now}`;
    new maplibregl.Marker({ element: d })
      .setLngLat([q.c[1], q.c[0]]).addTo(m3);
    d.onclick = ev => {
      ev.stopPropagation();
      m3.flyTo({ center: [q.c[1], q.c[0] - .06], zoom: 10.6, pitch: 70,
        bearing: m3.getBearing(), duration: 1800, essential: true });
      openCard3("关隘", `
        <div class="p-ju">${q.n}</div>
        <div class="stat-strip" style="margin:8px 0">
          <div class="st"><b>${q.type}</b><span>类型</span></div>
          <div class="st"><b>${q.fu}</b><span>隶</span></div>
          <div class="st"><b>${q.now}</b><span>今地</span></div>
        </div>
        <div class="readrow"><a class="readfull" style="text-decoration:none"
          href="index.html#mode=舆图&p=bian">⟨ 入 2D 九边专题</a></div>`);
    };
  });
}

function buildOverlays(){
  /* 河流线 */
  const rf = RIVERS.map(r => ({ type: "Feature", properties: { color: r.color },
    geometry: { type: "LineString", coordinates: r.pts.map(p => [p[1], p[0]]) } }));
  m3.getSource("rivers").setData({ type: "FeatureCollection", features: rf });
  /* 九边防线（诸关经度串连，示意） */
  const line = PASSES.filter(q => q.type.indexOf("九边") >= 0 || q.type === "内三关")
    .sort((a, b) => a.c[1] - b.c[1]);
  m3.getSource("frontier").setData({ type: "FeatureCollection", features: [{
    type: "Feature", properties: {},
    geometry: { type: "LineString", coordinates: line.map(q => [q.c[1], q.c[0]]) } }] });
}

m3.on("load", () => {
  buildOverlays();
  buildMarkers();
  window.__m3ready = true;
  /* 高程懒启用：先探一片瓦片（4s 超时），可达才挂地形；
     弱网/被墙环境自动降平面 + 提示——页面永不因 DEM 拖死 */
  fetch("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/6/32/15.png",
        { method: "GET", signal: AbortSignal.timeout(4000) })
    .then(r => { if (r.ok){ m3.setTerrain({ source: "dem", exaggeration: 1.4 }); window.__m3terrain = true; } })
    .catch(() => { const chip = document.getElementById("demnote"); if (chip) chip.style.display = "block"; });
});

/* ── 形胜视角（立在关口，以顾祖禹之眼观之） ── */
const SCENES = [
  { n: "九边全景",   c: [111.5, 40.2], z: 4.4, p: 42, b: 0 },
  { n: "居庸望京师", c: [116.15, 40.22], z: 10.8, p: 72, b: 168 },
  { n: "潼关望河曲", c: [110.32, 34.62], z: 10.8, p: 68, b: 40 },
  { n: "剑门窥蜀",   c: [105.5, 32.28], z: 10.8, p: 70, b: 205 },
  { n: "山海关观海", c: [119.82, 40.08], z: 11,   p: 66, b: 118 },
  { n: "夔门峡口",   c: [109.55, 31.02], z: 11,   p: 68, b: 105 },
  { n: "井陉出太行", c: [114.05, 38.06], z: 11,   p: 70, b: 100 },
  { n: "河套阴山",   c: [109.6, 40.85], z: 8.6,  p: 58, b: 8 },
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

/* ── 九边飞览：嘉峪关 → 山海关，贴地形而行 ── */
const TOUR_NAMES = ["嘉峪关","凉州堡","宁夏镇","花马池","榆林镇","偏头关",
                    "雁门关","大同镇","宣府镇","古北口","山海关"];
const TOUR = TOUR_NAMES.map(n => PASSES.find(q => q.n === n)).filter(Boolean);
let touring = false, tourIdx = 0, tourTimer = null;
const tourBtn = document.getElementById("tourbtn");
const tourLab = document.getElementById("tourlab");
function bearingTo(a, b){
  /* 近似航向角：正北 0，正东 90 */
  const dy = (b[0] - a[0]), dx = (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180);
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}
function tourStep(){
  if (!touring) return;
  const q = TOUR[tourIdx], nx = TOUR[(tourIdx + 1) % TOUR.length];
  const br = bearingTo([q.c[1], q.c[0]], [nx.c[1], nx.c[0]]);
  m3.flyTo({ center: [q.c[1], q.c[0] - .09], zoom: 10.4, pitch: 71,
    bearing: br, duration: 3800, curve: 1.35, essential: true });
  tourLab.textContent = `${q.n}（${tourIdx + 1}/${TOUR.length}）`;
  tourIdx = (tourIdx + 1) % TOUR.length;
  tourTimer = setTimeout(tourStep, 4600);
}
function stopTour(){
  if (!touring) return;
  touring = false;
  clearTimeout(tourTimer);
  tourBtn.textContent = "▶ 飞览九边";
  tourLab.textContent = "";
}
tourBtn.onclick = () => {
  if (touring){ stopTour(); return; }
  touring = true;
  tourBtn.textContent = "⏸ 停止";
  tourStep();
};
m3.on("click", stopTour);

/* 缩放/俯仰/罗盘控件 */
m3.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");

} /* WebGL guard end */
