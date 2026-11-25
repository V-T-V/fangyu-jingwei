/* ═══════════ 方舆经纬 · 地图与三图层 ═══════════ */

/* var（非 const）：map 挂到 window，测试页可直取 */
var map = L.map("map",{zoomControl:true,minZoom:4,maxZoom:12,
  attributionControl:false,maxBounds:[[15,88],[47,140]],maxBoundsViscosity:.6});
map.fitBounds([[17,96],[44,129]]);

/* ── 底图：绢本地形 ↔ 卫星影像（观山川形胜），选择持久化 ── */
const BASEMAPS = {
  physical:{ url:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}",
             maxNative:8, cls:null, btn:"影像" },
  imagery:{ url:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            maxNative:12, cls:"imgbasemap", btn:"地形" },
};
var tileLayer = null, tileErrs = 0;
function setBasemap(kind){
  const bm = BASEMAPS[kind] ? kind : "physical";
  const conf = BASEMAPS[bm];
  if (tileLayer) map.removeLayer(tileLayer);
  tileErrs = 0;
  document.body.classList.toggle("imgbasemap", !!conf.cls);
  try{ localStorage.setItem("fybasemap", bm); }catch(e){}
  const btn = document.getElementById("bmtoggle");
  if (btn) btn.textContent = conf.btn;
  if (window.__NOTILES__) return;   /* 测试密封：断言页不拉外网瓦片——时长不被 CDN 天气绑架（test_basemap 是真网络金丝雀，不设此旗） */
  tileLayer = L.tileLayer(conf.url,{maxZoom:12,maxNativeZoom:conf.maxNative}).addTo(map);
  let tileOk = 0;
  tileLayer.on("tileload", ()=>{ tileOk++; });
  /* 瓦片断供兜底。判据为「连败 6 张且一张未成」——
     此前「累计 3 张失败」即撤层：网络稍抖，几十张里错 3 张，底图就被整场撤掉；
     且提示条贴在 top:12px，正被页眉盖住，用户只见底图消失、不见任何说明 */
  tileLayer.on("tileerror", ()=>{
    tileErrs++;
    if (tileErrs >= 6 && tileOk === 0){
      map.removeLayer(tileLayer);
      document.getElementById("map").style.background =
        "radial-gradient(ellipse 130% 100% at 50% 30%, #efe6cf 0%, #e7dcbc 50%, #ddd0ae 100%)";
      const note = document.createElement("div");
      note.className = "tile-offline-note";
      note.textContent = "底图暂不可达 · 标记与数据不受影响";
      document.getElementById("map").appendChild(note);
    }
  });
}
(function(){
  let saved = "physical";
  try{ saved = localStorage.getItem("fybasemap") || "physical"; }catch(e){}
  setBasemap(saved);
})();

const fuLayer = L.layerGroup().addTo(map);      // 舆图：府治印章（常驻）
const zhouLayer = L.layerGroup();               // 属州方章（zoom≥6 挂载，省 DOM）
const countyLayer = L.layerGroup();             // 县治点（zoom≥7 挂载——1489 点常驻拖慢平移）
const passLayer = L.layerGroup();               // 关隘（zoom≥5 挂载）
const eraLayer = L.layerGroup().addTo(map);     // 形势：都城要地
const riverLayer = L.layerGroup().addTo(map);   // 川渎：水道
const fuMarkers = {};                            // pid -> [markers]
var selPid = null;                               // 当前选中省（var：跨脚本无 TDZ）
let curEra = 0;                                  // 当前形势卷（键盘翻卷用）

/* 缩放分级挂载：低缩放只留府治印，县/州/关按需上屏 */
function applyZoomGates(){
  const z = map.getZoom();
  if(z>=6) map.addLayer(zhouLayer); else map.removeLayer(zhouLayer);
  if(z>=7) map.addLayer(countyLayer); else map.removeLayer(countyLayer);
  if(z>=5) map.addLayer(passLayer); else map.removeLayer(passLayer);
  applyProvDim();          // 图层重挂后元素是新建的，需补省选淡出
}
/* 省选淡出：非选中省的印/章/点加 .dim（CSS: body.selprov × .dim） */
function applyProvDim(){
  for(const id in fuMarkers){
    fuMarkers[id].forEach(m=>{
      const el = m.getElement && m.getElement();
      if(!el) return;
      const f = el.querySelector(".fuseal"); if(f) f.classList.toggle("dim", !!selPid && id!==selPid);
      const z = el.querySelector(".zseal");  if(z) z.classList.toggle("dim", !!selPid && id!==selPid);
      const x = el.querySelector(".xseal");  if(x) x.classList.toggle("dim", !!selPid && id!==selPid);
    });
  }
}

/* 面板 / 纲目遮挡下的可视留白（容器像素）。取景时把目标让到未被遮挡的区域——
   此前一律按整幅地图居中：选省后该省的东半部正被右侧面板盖住，形势、川渎同理。
   open：true = 随后必开面板；false / 省略 = 按面板当前开合状态。
   手机（≤640）面板是底部抽屉 → 让下；否则是右侧卷宗 → 让右。两侧留白合计过半时按比例收，保住取景面积。 */
function viewInsets(open){
  const sz = map.getSize(), sheet = innerWidth <= 640, ins = {l:24, t:80, r:76, b:90};
  const rr = document.getElementById("rail");
  if (rr){ const right = rr.getBoundingClientRect().right; if (right > 0) ins.l = Math.max(ins.l, right + 24); }
  const pn = document.getElementById("panel");
  if (pn && (open === true || (open !== false && pn.classList.contains("open")))){
    if (sheet) ins.b = Math.max(ins.b, sz.y - pn.offsetTop + 16);
    else ins.r = Math.max(ins.r, sz.x - pn.offsetLeft + 24);
  }
  if (ins.l + ins.r > sz.x * .58){ const k = sz.x * .58 / (ins.l + ins.r); ins.l *= k; ins.r *= k; }
  if (ins.t + ins.b > sz.y * .6){ const k = sz.y * .6 / (ins.t + ins.b); ins.t *= k; ins.b *= k; }
  return ins;
}
/* 随后必开面板的取景（safeFly / safeFlyTo 的 open === true）：视图停稳后请 app.js 以取景目标（map._fyFocus）
   的中心为准，再对一次手机低倍图的可见带（app.js syncChrome(true)）。
   「停稳」须防抖：飞行只认留白、不受 maxBounds 约束；飞完那一刻 Leaflet 自带的 _panInsideMaxBounds 会紧接着
   用约 0.26s 把视图拉回边界内——挂在第一次 moveend 上量到的是回弹前的位置（2026-11-24 踩过）。
   只在取景后 600ms 的窗口内认这件事，用户随后手动拖动不受干预。监听在飞行开始之后才挂
   （新飞行会打断旧动画并同步触发一次 moveend）；飞行异常收场则 2.5 秒后撤掉监听。 */
function fyFocusSync(){
  let tmr = 0, born = 0;
  const again = () => {
    born = born || Date.now();
    if (Date.now() - born > 600){ map.off("moveend", again); return; }
    clearTimeout(tmr);
    tmr = setTimeout(() => { map.off("moveend", again); if (typeof syncChrome === "function") syncChrome(true); }, 380);
  };
  map.on("moveend", again);
  setTimeout(() => map.off("moveend", again), 2500);
}
/* 容器未完成布局（尺寸为 0）时飞行动画会算出 NaN —— 就绪前延迟重试 */
function safeFly(bounds, opts, open, extra){
  const run = () => {
    const o = Object.assign({duration:1.1}, opts);
    if (!o.raw){          // raw：按整幅地图居中（首屏总览用，与初始取景一致）
      const i = viewInsets(open), k = extra || 0;
      o.paddingTopLeft = [i.l + k, i.t + k];
      o.paddingBottomRight = [i.r + k, i.b + k];
    }
    delete o.raw;
    try{ map.flyToBounds(bounds, o); }
    catch(e){ map.fitBounds(bounds); }
    if (open === true){
      /* 对齐中心取投影后的像素中点，而非经纬度中点——墨卡托下二者差几像素，南北跨度大的朝代会把最北的都城顶到页签下 */
      const sw = map.project(bounds.getSouthWest()), ne = map.project(bounds.getNorthEast());
      map._fyFocus = map.unproject(sw.add(ne).divideBy(2));
      fyFocusSync();
    }
  };
  if (map.getSize().x > 40) run();
  else setTimeout(run, 250);
}
function safeFlyTo(center, zoom, opts, open){
  const run = () => {
    let target = center;
    if (open === true){                 // 仅对「随后必开面板」的调用让位
      const i = viewInsets(true), p = map.project(center, zoom);
      p.x -= (i.l - i.r) / 2; p.y -= (i.t - i.b) / 2;
      target = map.unproject(p, zoom);
    }
    try{ map.flyTo(target, zoom, opts); }
    catch(e){ map.setView(target, zoom); }
    if (open === true){
      map._fyFocus = center;
      fyFocusSync();
    }
  };
  if (map.getSize().x > 40) run();
  else setTimeout(run, 250);
}

/* ── 舆图模式：府治印章 ── */
const FU_OFF = {right:[12,0], left:[-12,0], top:[0,-12], bottom:[0,12]};
/* 是否府治标记。县标记也带 _fu，但那是府名字符串而非府对象——
   此前各处只判 _fu 真值：县标记被当成府，取不到 u.n，选省时绑出一批内容为 undefined 的空标签 */
function isFuMark(m){ return !!m._fu && typeof m._fu === "object"; }
function bindFuTip(m, permanent, dir){
  if(!isFuMark(m)) return;                  // 属州标记自持 tooltip，不参与名录切换
  m.unbindTooltip();
  const p=m._prov,u=m._fu,i=m._i||0;
  if(permanent){
    // 首选朝向随相邻府治左右/上下交替；实际朝向由 layoutLabels 按避让结果给出
    dir = dir || ["right","left","bottom","right"][i%4];
    m.bindTooltip(u.n,{permanent:true,direction:dir,offset:FU_OFF[dir],className:"fulab"});
  }else{
    m.bindTooltip(`<b style="font-family:KaiTi,serif;font-size:14px;letter-spacing:2px">${u.n}</b><br>
      <span style="font-size:10px;letter-spacing:1px;color:#57503f">${p.name}${u.now?" · 今 "+u.now:""}</span>`,
      {direction:"top",offset:[0,-6],opacity:.95,className:"ftip"});
  }
}
function setFuLabels(pid){ layoutLabels(); }
function buildFu(){
  fuLayer.clearLayers(); zhouLayer.clearLayers(); countyLayer.clearLayers();
  for(const pid in fuMarkers) delete fuMarkers[pid];
  FY.provinces.forEach(p=>{
    fuMarkers[p.id]=[];
    p.fu.forEach((u,ui)=>{
      if(!u.c) return;
      const col = PCOLORS[p.id]||"#2f5d70";
      const ic = L.divIcon({className:"", iconSize:[13,13],
        html:`<div class="fuseal" style="--pc:${col}" title="${u.n}"></div>`});
      const m = L.marker(u.c,{icon:ic}).addTo(fuLayer);
      m._pid=p.id; m._fu=u; m._prov=p; m._i=ui;
      bindFuTip(m,false); m._lab = "hov";
      m.on("click",()=>{ openFu(p,u); });
      m.on("mouseover",()=>{const el=m.getElement()&&m.getElement().querySelector(".fuseal");el&&el.classList.add("hot");});
      m.on("mouseout",()=>{const el=m.getElement()&&m.getElement().querySelector(".fuseal");el&&el.classList.remove("hot");});
      fuMarkers[p.id].push(m);
    });
    // 属州小方章（zoom≥6 显示，点击开所属府）
    p.fu.forEach(u=>{
      (u.zx||[]).forEach(z=>{
        if(!z.c) return;
        const zi = L.divIcon({className:"", iconSize:[8,8],
          html:`<div class="zseal" style="--pc:${PCOLORS[p.id]||"#2f5d70"}" title="${z.n}"></div>`});
        const zm = L.marker(z.c,{icon:zi, zIndexOffset:-200}).addTo(zhouLayer);
        zm._pid=p.id; zm._zhou=z.n;
        zm.bindTooltip(`<b style="font-family:KaiTi,serif;font-size:13px;letter-spacing:2px">${z.n}</b><br>
          <span style="font-size:10px;letter-spacing:1px;color:#57503f">隶 ${u.n}${z.now?" · 今 "+z.now:""}</span>`,
          {direction:"top",offset:[0,-4],opacity:.95,className:"ftip"});
        zm.on("click",()=>openFu(p,u));
        fuMarkers[p.id].push(zm);
      });
      // 县治推算点（zoom≥7 显现，富信息 + zoom≥8 常显标签）
      const xc = u.xianc || {};
      Object.keys(xc).forEach(nm=>{
        const d = xc[nm];
        const pos = Array.isArray(d) ? d : d.c;    // 兼容旧数组格式
        if (!pos) return;
        const isObj = !Array.isArray(d);
        const typ = isObj ? (d.type || "推算") : "推算";
        const dirStr = isObj && d.dir ? `府${d.dir}` : "";
        const liStr = isObj && d.li ? `${d.li}里` : "";
        const xi = L.divIcon({className:"", iconSize:[5,5],
          html:`<div class="xseal ${typ==="附郭"?"fg-x":""}" style="--pc:${PCOLORS[p.id]||"#2f5d70"}" title="${nm}"></div>`});
        const xm = L.marker(pos,{icon:xi, zIndexOffset:-400}).addTo(countyLayer);
        xm._pid=p.id; xm._xian=nm; xm._fu=u.n; xm._prov=p;
        /* 富信息 tip 存于标记：zoomend 重建（常显名/富信息）皆从此取 */
        xm._tipHtml = `<b style="font-family:KaiTi,serif;font-size:13px;letter-spacing:2px">${nm}</b><br>
          <span style="font-size:10px;letter-spacing:1px;color:#57503f">隶 ${u.n}</span><br>
          <span style="font-size:10px;letter-spacing:1px;color:${typ==="附郭"?"#9a6b3f":"#8b8069"}">${dirStr?dirStr+" ·":""} ${typ}${liStr?" · "+liStr:""}</span>`;
        bindXianTip(xm); xm._lab = "hov";
        xm.on("click",e=>openCountyCard(p,u,nm,d,e.latlng));
        fuMarkers[p.id].push(xm);
      });
    });
  });
}
/* 县标记富信息悬停 tip（bindTooltip 单槽——常显标签与富信息互斥切换） */
function bindXianTip(m){
  if(m._tipHtml) m.bindTooltip(m._tipHtml,
    {direction:"top",offset:[0,-3],opacity:.95,className:"ftip"});
}
/* 属州层 zoom 门控：CSS 类管样式过渡，图层挂载管 DOM 数量 */
map.on("zoomend",()=>{
  document.body.classList.toggle("z6", map.getZoom()>=6);
  document.body.classList.toggle("z7", map.getZoom()>=7);
  document.body.classList.toggle("z5", map.getZoom()>=5);
  document.body.classList.toggle("z4", map.getZoom()>=4);
  document.body.classList.toggle("z8", map.getZoom()>=8);
  document.body.classList.toggle("z9", map.getZoom()>=9);
  applyZoomGates();
  layoutLabels();
});
map.on("moveend", layoutLabels);

/* ── 标签排布（zoomend / moveend）──────────────────────────────
   优先级：都城 > 要地（形势）；府名 > 县名（舆图）。先到者占位，后到者逐个让位。
   · 府名：z≥6 常显；选了省则该省府名在任何缩放都显。此前府名只在「选省」或「点府」之后才出现——
     z8 下满屏县名，府治却是不具名的菱章；且县名盖在府名上。
   · 县名：z≥8 常显，只排视界内的，让位府名 / 印面 / 先到的县名。
   · 形势：都城、要地标签依次试 右→左→上→下，四面皆压的退回悬停。
     此前都城标签按奇偶定朝向（洛邑朝左，正撞上镐京朝右的标签），要地标签一律朝右（压在都城印上）。
   状态没变的标记不重绑（_lab 缓存）——平移时不必重建上千个 tooltip。 */
const LAB_DIR = ["right", "left", "top", "bottom"];
function labRect(pt, dir, off, w, h){
  const x0 = pt.x + off[0], y0 = pt.y + off[1];
  return dir === "right" ? [x0, y0 - h / 2, x0 + w, y0 + h / 2]
       : dir === "left"  ? [x0 - w, y0 - h / 2, x0, y0 + h / 2]
       : dir === "top"   ? [x0 - w / 2, y0 - h, x0 + w / 2, y0]
       :                   [x0 - w / 2, y0, x0 + w / 2, y0 + h];
}
function setLabel(m, st, dir, off){
  const key = st + (dir ? ":" + dir : "");
  if (m._lab === key) return;
  m._lab = key;
  m.unbindTooltip();
  if (m._cap || m._plc){
    if (st === "per") m.bindTooltip(m._cap || m._plc, {permanent:true, direction:dir, offset:off,
      className:m._cap ? "caplab" : "plclab"});
    else m.bindTooltip(m._cap || m._plc, {direction:"top", offset:[0,-8], opacity:.95, className:"ftip"});
    } else if (m._xian){
      if (st === "per") m.bindTooltip(m._xian.replace(/县$/,""), {permanent:true, direction:dir || "right", offset:off || [8,0], className:"xianlab"});
      else bindXianTip(m);
  } else if (isFuMark(m)) bindFuTip(m, st === "per", dir);
}
/* 版面遮挡区（容器像素）：标签不得压在固定界面之下——纲目、页眉三块、页脚、右缘控件列、面板、时间轴。
   此前标签只避让彼此：贴着纲目右缘的县名被切成半截字（2026-11-24 z8 实录）。手机上纲目收起（移出屏外）即不计。 */
const CHROME_SEL = "#rail,#railtoggle,.brand,#modes,#searchwrap,footer,#map .leaflet-control-zoom,#bmtoggle,.north,#panel,#tl,#tlPlay,#sresults";
function chromeRects(){
  const o = map.getContainer().getBoundingClientRect(), out = [];
  document.querySelectorAll(CHROME_SEL).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.right <= o.left || r.bottom <= o.top || r.left >= o.right || r.top >= o.bottom) return;
    out.push([r.left - o.left - 3, r.top - o.top - 3, r.right - o.left + 3, r.bottom - o.top + 3]);
  });
  return out;
}
function layoutLabels(){
  if (!map._loaded) return;
  const z = map.getZoom(), sz = map.getSize(), M = 80, placed = [], chrome = chromeRects();
  const hit = r => (placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])
                 || chrome.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]));
  const ptOf = m => map.latLngToContainerPoint(m.getLatLng());
  const inView = pt => pt.x > -M && pt.y > -M && pt.x < sz.x + M && pt.y < sz.y + M;
  const rot = (arr, first) => [first].concat(arr.filter(d => d !== first));
  /* 试放：按 dirs 顺序取第一个不相压的朝向；四面皆压退回悬停 */
  const place = (m, text, dirs, offs, cw, h) => {
    if (inView(ptOf(m))){
      const w = text.length * cw + 12;
      for (const d of dirs){
        const r = labRect(ptOf(m), d, offs[d], w, h);
        if (!hit(r)){ placed.push(r); setLabel(m, "per", d, offs[d]); return; }
      }
    }
    setLabel(m, "hov");
  };

  if (document.body.classList.contains("m-形势")){
    const caps = [], plcs = [];
    eraLayer.eachLayer(l => { if (l._cap) caps.push(l); else if (l._plc) plcs.push(l); });
    caps.forEach(m => { const p = ptOf(m); placed.push([p.x - 14, p.y - 14, p.x + 14, p.y + 14]); });   // 都城印面：谁都不得压
    plcs.forEach(m => { const p = ptOf(m); placed.push([p.x - 6, p.y - 6, p.x + 6, p.y + 6]); });
    caps.forEach(m => place(m, m._cap, LAB_DIR, {right:[16,0], left:[-16,0], top:[0,-18], bottom:[0,16]}, 15.5, 22));
    plcs.forEach(m => place(m, m._plc, LAB_DIR, {right:[7,0], left:[-7,0], top:[0,-8], bottom:[0,8]}, 14.5, 18));
    return;
  }
  const order = selPid && fuMarkers[selPid] ? [selPid] : [];          // 选中省的府名排最前
  for (const id in fuMarkers) if (id !== selPid) order.push(id);
  order.forEach(id => fuMarkers[id].forEach(m => {
    if (isFuMark(m)){ const p = ptOf(m); placed.push([p.x - 10, p.y - 10, p.x + 10, p.y + 10]); }   // 印面：县名不得盖印
  }));
  order.forEach(id => fuMarkers[id].forEach(m => {
    if (!isFuMark(m)) return;
    if (id === selPid || (z >= 6 && !selPid))     // 选了省：只标本省（邻省印章已淡出，标签也不该抢眼）
      place(m, m._fu.n, rot(LAB_DIR, ["right","left","bottom","right"][(m._i||0)%4]), FU_OFF, 14, 20);
    else setLabel(m, "hov");
  }));
  order.forEach(id => fuMarkers[id].forEach(m => {
    if (!m._xian) return;
    if (z >= 8) place(m, m._xian.replace(/县$/,""), ["right", "left"], {right:[8,0], left:[-8,0]}, 13, 18);   // 右侧压到版面（控件列 / 面板）则改标左侧
    else setLabel(m, "hov");
  }));
}

/* ── 形势模式 ── */
/* 凸包（Andrew 单调链）：据本卷都邑实时生成疆域示意，非考证边界 */
function convexHull(points){
  const pts = [...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross = (o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lower = [], upper = [];
  for(const p of pts){
    while(lower.length>=2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for(let i=pts.length-1; i>=0; i--){
    const p = pts[i];
    while(upper.length>=2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
function hullLatLngs(points, pad){
  const hull = convexHull(points);
  if(hull.length < 3) return null;
  const n = hull.length;
  const cLat = hull.reduce((s,p)=>s+p[0],0)/n, cLng = hull.reduce((s,p)=>s+p[1],0)/n;
  return hull.map(p=>[cLat+(p[0]-cLat)*pad, cLng+(p[1]-cLng)*pad]);
}
function eraHull(e){
  return hullLatLngs([...e.caps, ...e.plcs].map(c=>[c[1], c[2]]), 1.3);
}
/* 省选疆域晕：选中省治所凸包（府+州），省色描边淡晕，取消即隐 */
let provHull = null;
function showProvHull(p){
  hideProvHull();
  const pts = [];
  p.fu.forEach(u=>{ if(u.c) pts.push(u.c); (u.zx||[]).forEach(z=>{ if(z.c) pts.push(z.c); }); });
  const hull = hullLatLngs(pts, 1.18);
  if(!hull) return;
  const col = PCOLORS[p.id] || "#2f5d70";
  provHull = L.polygon(hull, {color:col, weight:2.4, dashArray:"7 6", opacity:.85,
    fillColor:col, fillOpacity:.13, lineCap:"round", interactive:false}).addTo(map);
}
function hideProvHull(){
  if(provHull){ map.removeLayer(provHull); provHull = null; }
}
function buildEra(ei){
  eraLayer.clearLayers();
  const e = ERAS[ei]; if(!e) return;
  curEra = ei;
  const xs = FY.xingshi[ei];
  // 疆域示意：据本卷都邑的凸包（淡朱罩+虚线），非考证边界
  const hull = eraHull(e);
  if(hull){
    L.polygon(hull, {color:"#b23a2e", weight:2, dashArray:"7 6", opacity:.7,
      fillColor:"#b23a2e", fillOpacity:.09, lineCap:"round", interactive:false})
      .addTo(eraLayer);
  }
  // 王迹连线
  if(e.caps.length>1){
    L.polyline(e.caps.map(c=>[c[1],c[2]]),{color:"#b23a2e",weight:2.2,
      opacity:.65,dashArray:"2 8",lineCap:"round"}).addTo(eraLayer);
  }
  // 要地 / 都城：标签由 layoutLabels 排布（右→左→上→下试放避让），此处只挂名
  e.plcs.forEach(n=>{
    const m = L.marker([n[1],n[2]],{icon:L.divIcon({className:"",iconSize:[8,8],
      html:`<div class="plc"></div>`})}).addTo(eraLayer);
    m._plc = n[0];
  });
  e.caps.forEach(n=>{
    const m = L.marker([n[1],n[2]],{icon:L.divIcon({className:"",iconSize:[26,26],
      html:`<div class="cap">${n[0][0]}</div>`}),zIndexOffset:900}).addTo(eraLayer);
    m._cap = n[0];
  });
  layoutLabels();
  safeFly(eraBounds(e),{duration:1.1}, true, 50);
}
function eraBounds(e){
  const all=[...e.caps,...e.plcs].map(c=>[c[1],c[2]]);
  return L.latLngBounds(all).pad(.14);
}

/* ── 川渎模式 ── */
/* Chaikin 切角平滑：控制点数据不变，渲染成自然曲线 */
function chaikin(pts, iter){
  for(let k=0;k<iter;k++){
    const out=[pts[0]];
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i], b=pts[i+1];
      out.push([a[0]*0.75+b[0]*0.25, a[1]*0.75+b[1]*0.25]);
      out.push([a[0]*0.25+b[0]*0.75, a[1]*0.25+b[1]*0.75]);
    }
    out.push(pts[pts.length-1]);
    pts=out;
  }
  return pts;
}
function buildRivers(sel){
  riverLayer.clearLayers();
  RIVERS.forEach(r=>{
    const line = L.polyline(chaikin(r.pts.map(p=>[p[0],p[1]]), 2),{color:r.color,weight:r.weight,
      opacity:.88,dashArray:r.dash,lineCap:"round"}).addTo(riverLayer);
    line.bindTooltip(`<b style="font-family:KaiTi,serif;font-size:14px;letter-spacing:3px">${r.key}</b>`,
      {sticky:true,className:"ftip"});
    line.on("click",()=>{openRiver(r);highlightRail("川渎",r.key);});
    r._line=line;
    // 沿流要邑：可点者直达其府
    r._plcs=[];
    (r.plc||[]).forEach(q=>{
      const m = L.marker([q[1],q[2]],{icon:L.divIcon({className:"",iconSize:[11,11],
        html:`<div class="rpt" style="--rc:${r.color}"></div>`}),zIndexOffset:500}).addTo(riverLayer);
      m.bindTooltip(`<b style="font-family:KaiTi,serif;font-size:13.5px;letter-spacing:2px">${q[0]}</b>${q[3]?
        `<br><span style="font-size:10px;letter-spacing:1px;color:#57503f">点击入 ${q[3]}</span>`:
        `<br><span style="font-size:10px;letter-spacing:1px;color:#8b8069">${r.key}沿流要地</span>`}`,
        {direction:"top",offset:[0,-5],opacity:.95,className:"ftip"});
      r._plcs.push(m);
      if(q[3]) m.on("click",()=>{
        for(const p of FY.provinces){
          const u=p.fu.find(x=>x.n===q[3]);
          if(u){ if(mode!=="舆图") setMode("舆图"); selectProv(p.id); openFu(p,u); break; }
        }
      });
    });
  });
  const r = RIVERS.find(x=>x.key===sel)||RIVERS[0];
  safeFly(r._line.getBounds().pad(.08),{duration:1.1}, true);
  return r;
}

/* 九边防线：自辽东至甘肃，横亘北疆的明帝国边防体系 */
function buildFrontier(){
  {
    const list = PASSES;
    const bianPasses = list.filter(q=>q.type.indexOf("九边")>=0 || q.type.indexOf("内三关")>=0);
    // 按经度排序（西→东），串成防线
    const sorted = bianPasses.sort((a,b)=>a.c[1]-b.c[1]);
    const line = L.polyline(sorted.map(q=>q.c), {
      color:"#b23a2e", weight:4, dashArray:"12 8", opacity:.7,
      lineCap:"round", interactive:false}).addTo(fuLayer);
    // 两端标签（钉在端点关隘的坐标上；样式把它抬到关隘三角之上——此前居中压字，见 css .fronlab）
    const west = sorted[0], east = sorted[sorted.length-1];
    if (west) L.marker(west.c, {icon:L.divIcon({className:"",iconSize:[60,18],
      html:`<div class="fronlab">九边西端·${west.n}</div>`}), interactive:false})
      .addTo(fuLayer);
    if (east) L.marker(east.c, {icon:L.divIcon({className:"",iconSize:[60,18],
      html:`<div class="fronlab">九边东端·${east.n}</div>`}), interactive:false})
      .addTo(fuLayer);
  }
}

/* 关隘图层：50 处天下名关（人工整编），zoom≥5 挂载 */
let passMarkers = [];
function buildPasses(){
  {
    const list = PASSES;
    list.forEach(q=>{
      const m = L.marker(q.c, {icon: L.divIcon({className:"", iconSize:[14,14],
        html: `<div class="passmark ${q.type.indexOf("九边")>=0?"bian":""}" title="${q.n}"></div>`}),
        zIndexOffset:600}).addTo(passLayer);
      m.bindTooltip(`<b style="font-family:KaiTi,serif;font-size:14px;letter-spacing:2px">${q.n}</b><br>
        <span style="font-size:10px;letter-spacing:1px;color:#b23a2e">${q.type}</span><br>
        <span style="font-size:10px;letter-spacing:1px;color:#57503f">${q.fu} · 今${q.now}</span>`,
        {direction:"top",offset:[0,-5],opacity:.95,className:"ftip"});
      passMarkers.push(m);
    });
  }
}

/* 量距：shift+点击两点 → 直线(km) + 折合明里（0.62 驿路系数标定） */
let measurePts = [];
map.on("click", e=>{
  if(!e.originalEvent.shiftKey) return;
  measurePts.push([e.latlng.lat, e.latlng.lng]);
  if (measurePts.length === 2){
    const [a, b] = measurePts;
    const R = 6371;
    const la1 = a[0]*Math.PI/180, la2 = b[0]*Math.PI/180;
    const dLa = (b[0]-a[0])*Math.PI/180, dLo = (b[1]-a[1])*Math.PI/180;
    const h = Math.sin(dLa/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLo/2)**2;
    const km = 2*R*Math.asin(Math.sqrt(h));
    const mingLi = Math.round(km / 0.357);       // 明里（含驿路系数）
    const line = L.polyline([a,b], {color:"#b23a2e", weight:2, dashArray:"4 6",
      opacity:.8, interactive:false}).addTo(map);
    const mid = [(a[0]+b[0])/2, (a[1]+b[1])/2];
    const label = L.marker(mid, {icon: L.divIcon({className:"", iconSize:[120,36],
      html: `<div style="background:rgba(245,238,218,.95);border:1px solid #b23a2e;
             padding:4px 10px;font:12px/1.5 KaiTi,serif;letter-spacing:1px;color:#2e2921;
             white-space:nowrap;text-align:center">
        ${km.toFixed(0)} 公里<br>折合明里 <b style="color:#b23a2e">${mingLi}</b> 里</div>`}),
      interactive:false, zIndexOffset:1000}).addTo(map);
    setTimeout(()=>{ map.removeLayer(line); map.removeLayer(label); }, 6000);
    measurePts = [];
  }
});

/* 舆图模式：点地图空白处取消省选 */
map.on("click",()=>{
  if(mode==="舆图" && selPid) selectProv(null);
});

/* 府域晕：选中一府时显示该府县治凸包轮廓 */
let fuHull = null;
function showFuHull(p, u){
  clearFuHull();
  const pts = [];
  if (u.c) pts.push(u.c);
  const xc = u.xianc || {};
  Object.keys(xc).forEach(nm => {
    const d = xc[nm];
    const pos = Array.isArray(d) ? d : d.c;
    if (pos) pts.push(pos);
  });
  if (pts.length < 3) return;
  const hull = hullLatLngs(pts, 1.15);
  if (!hull) return;
  const col = PCOLORS[p.id] || "#2f5d70";
  fuHull = L.polygon(hull, {
    color: col, weight: 1.5, dashArray: "5 5", opacity: .6,
    fillColor: col, fillOpacity: .07,
    lineCap: "round", interactive: false
  }).addTo(map);
}
function clearFuHull(){
  if (fuHull){ map.removeLayer(fuHull); fuHull = null; }
}

/* 府→县领属线：选中一府时显示其行政辐射 */
let jurLines = [];
function showJurisdiction(p, u){
  clearJurisdiction();
  if (!u.c || !u.xianc) return;
  const col = PCOLORS[p.id] || "#2f5d70";
  Object.keys(u.xianc).forEach(nm => {
    const d = u.xianc[nm];
    const pos = Array.isArray(d) ? d : d.c;
    if (!pos) return;
    const dist = map.distance(u.c, pos);
    if (dist > 300000) return;  // >300km 跳过
    const line = L.polyline([u.c, pos], {
      color: col, weight: 1, opacity: .25,
      dashArray: "3 5", interactive: false
    }).addTo(map);
    jurLines.push(line);
  });
}
function clearJurisdiction(){
  jurLines.forEach(l => map.removeLayer(l));
  jurLines = [];
}

/* 检索定位到县治推算点：飞至 + 脉冲环 */
function revealCounty(pid, fuName, xianName){
  const p = FY.provinces.find(x=>x.id===pid);
  if(!p) return false;
  const u = p.fu.find(x=>x.n===fuName);
  if(!u || !u.xianc || !u.xianc[xianName]) return false;
  if(mode!=="舆图") setMode("舆图");
  selectProv(pid);
  openFu(p,u);
  const d = u.xianc[xianName];
  const pos = Array.isArray(d) ? d : d.c;
  setTimeout(()=>{
    safeFlyTo(pos, 8, {duration:1}, true);
    // 打开县级信息卡
    if (typeof openCountyCard === "function") {
      setTimeout(()=>openCountyCard(p, u, xianName, d, null), 600);
    }
    const ring = L.circleMarker(pos, {radius:14, weight:2.2, color:"#b23a2e",
      opacity:.9, fill:false, className:"evring"}).addTo(map);
    setTimeout(()=>map.removeLayer(ring), 3200);
  }, 420);
  return true;
}
