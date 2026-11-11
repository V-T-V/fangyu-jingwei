/* ═══════════ 方舆经纬 · 地图与三图层 ═══════════ */

const map = L.map("map",{zoomControl:true,minZoom:4,maxZoom:12,
  attributionControl:false,maxBounds:[[15,88],[47,140]],maxBoundsViscosity:.6});
map.fitBounds([[17,96],[44,129]]);
const tileLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}",{
  maxZoom:12,maxNativeZoom:8}).addTo(map);
/* 瓦片断供兜底：>5 张 404 → 隐瓦片层，绢底自足（矢量数据不受影响） */
let tileErrs = 0;
tileLayer.on("tileerror", ()=>{
  tileErrs++;
  if (tileErrs === 6){
    map.removeLayer(tileLayer);
    document.getElementById("map").style.background =
      "radial-gradient(ellipse 130% 100% at 50% 30%, #efe6cf 0%, #e7dcbc 50%, #ddd0ae 100%)";
    const note = document.createElement("div");
    note.style.cssText = "position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:500;" +
      "background:rgba(245,238,218,.95);border:1px solid var(--line,#8b765a);padding:4px 14px;" +
      "font:11px KaiTi,serif;letter-spacing:3px;color:#8b8069;pointer-events:none";
    note.textContent = "底图离线 · 标记与数据不受影响";
    document.getElementById("map").appendChild(note);
  }
});

const fuLayer = L.layerGroup().addTo(map);      // 舆图：府治印章
const eraLayer = L.layerGroup().addTo(map);     // 形势：都城要地
const riverLayer = L.layerGroup().addTo(map);   // 川渎：水道
const fuMarkers = {};                            // pid -> [markers]
let curEra = 0;                                  // 当前形势卷（键盘翻卷用）

/* 容器未完成布局（尺寸为 0）时飞行动画会算出 NaN —— 就绪前延迟重试 */
function safeFly(bounds, opts){
  if(map.getSize().x > 40){
    try{ map.flyToBounds(bounds, opts); }
    catch(e){ map.fitBounds(bounds); }
  }else{
    setTimeout(()=>safeFly(bounds, opts), 250);
  }
}
function safeFlyTo(center, zoom, opts){
  if(map.getSize().x > 40){
    try{ map.flyTo(center, zoom, opts); }
    catch(e){ map.setView(center, zoom); }
  }else{
    setTimeout(()=>safeFlyTo(center, zoom, opts), 250);
  }
}

/* ── 舆图模式：府治印章 ── */
function bindFuTip(m, permanent){
  if(!m._fu) return;                  // 属州标记自持 tooltip，不参与名录切换
  m.unbindTooltip();
  const p=m._prov,u=m._fu,i=m._i||0;
  if(permanent){
    // 相邻府治标签左右/上下交替，避让叠压
    const dir=["right","left","bottom","right"][i%4];
    const off={right:[11,0],left:[-11,0],bottom:[0,9],top:[0,-9]}[dir];
    m.bindTooltip(u.n,{permanent:true,direction:dir,offset:off,className:"fulab"});
  }else{
    m.bindTooltip(`<b style="font-family:KaiTi,serif;font-size:14px;letter-spacing:2px">${u.n}</b><br>
      <span style="font-size:10px;letter-spacing:1px;color:#57503f">${p.name}${u.now?" · 今 "+u.now:""}</span>`,
      {direction:"top",offset:[0,-6],opacity:.95,className:"ftip"});
  }
}
function setFuLabels(pid){
  for(const id in fuMarkers) fuMarkers[id].forEach(m=>bindFuTip(m, !!pid && id===pid));
}
function buildFu(){
  fuLayer.clearLayers();
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
      bindFuTip(m,false);
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
        const zm = L.marker(z.c,{icon:zi, zIndexOffset:-200}).addTo(fuLayer);
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
        const xm = L.marker(pos,{icon:xi, zIndexOffset:-400}).addTo(fuLayer);
        xm._pid=p.id; xm._xian=nm; xm._fu=u.n; xm._prov=p;
        /* 富信息 tip 存于标记：zoomend 重建（常显名/富信息）皆从此取 */
        xm._tipHtml = `<b style="font-family:KaiTi,serif;font-size:13px;letter-spacing:2px">${nm}</b><br>
          <span style="font-size:10px;letter-spacing:1px;color:#57503f">隶 ${u.n}</span><br>
          <span style="font-size:10px;letter-spacing:1px;color:${typ==="附郭"?"#9a6b3f":"#8b8069"}">${dirStr?dirStr+" ·":""} ${typ}${liStr?" · "+liStr:""}</span>`;
        bindXianTip(xm);
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
/* 属州层 zoom 门控 */
map.on("zoomend",()=>{
  document.body.classList.toggle("z6", map.getZoom()>=6);
  document.body.classList.toggle("z7", map.getZoom()>=7);
  document.body.classList.toggle("z5", map.getZoom()>=5);
  document.body.classList.toggle("z4", map.getZoom()>=4);
  // zoom≥8：县名常显（带碰撞检测——近距离县名只显示一个，其余退回富信息悬停）
  document.body.classList.toggle("z8", map.getZoom()>=8);
  if(map.getZoom()>=8){
    const all = Object.values(fuMarkers).flat().filter(m=>m._xian);
    const shown = [];
    all.forEach(m=>{
      m.unbindTooltip();
      const pt = map.latLngToContainerPoint(m.getLatLng());
      const too = shown.some(s=>{
        const p2 = map.latLngToContainerPoint(s.getLatLng());
        return Math.abs(pt.x-p2.x)<45 && Math.abs(pt.y-p2.y)<18;
      });
      if(!too){
        m.bindTooltip(m._xian.replace(/县$/,""),{permanent:true,direction:"right",offset:[8,0],className:"xianlab"});
        shown.push(m);
      }else{
        bindXianTip(m);          // 被避让的县仍可悬停看富信息
      }
    });
  } else {
    Object.values(fuMarkers).flat().forEach(m=>{
      if(m._xian){ m.unbindTooltip(); bindXianTip(m); }
    });
  }
});

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
  e.plcs.forEach(n=>{
    L.marker([n[1],n[2]],{icon:L.divIcon({className:"",iconSize:[8,8],
      html:`<div class="plc"></div>`})}).addTo(eraLayer)
      .bindTooltip(n[0],{permanent:true,direction:"right",className:"plclab",offset:[7,0]});
  });
  e.caps.forEach((n,i)=>{
    const dir = i%3===1 ? "left" : (i%3===2 ? "bottom" : "right");
    const off = {right:[16,0], left:[-16,0], bottom:[0,14]}[dir];
    L.marker([n[1],n[2]],{icon:L.divIcon({className:"",iconSize:[26,26],
      html:`<div class="cap">${n[0][0]}</div>`}),zIndexOffset:900}).addTo(eraLayer)
      .bindTooltip(n[0],{permanent:true,direction:dir,className:"caplab",offset:off});
  });
  safeFly(eraBounds(e),{duration:1.1,padding:[130,130]});
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
  safeFly(r._line.getBounds().pad(.08),{duration:1.1});
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
    // 两端标签
    const west = sorted[0], east = sorted[sorted.length-1];
    if (west) L.marker(west.c, {icon:L.divIcon({className:"",iconSize:[60,18],
      html:`<div class="fronlab">九边西端·${west.n}</div>`}), interactive:false})
      .addTo(fuLayer);
    if (east) L.marker(east.c, {icon:L.divIcon({className:"",iconSize:[60,18],
      html:`<div class="fronlab">九边东端·${east.n}</div>`}), interactive:false})
      .addTo(fuLayer);
  }
}

/* 关隘图层：50 处天下名关（人工整编），zoom≥5 显现 */
let passMarkers = [];
function buildPasses(){
  {
    const list = PASSES;
    list.forEach(q=>{
      const m = L.marker(q.c, {icon: L.divIcon({className:"", iconSize:[14,14],
        html: `<div class="passmark ${q.type.indexOf("九边")>=0?"bian":""}" title="${q.n}"></div>`}),
        zIndexOffset:600}).addTo(fuLayer);
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

/* 省级 Voronoi：全省所有县治同时分区，按府着色深浅交替 */
function showProvinceVoronoi(p){
  clearCountyTerritories();
  const bounds = { south: 99, north: 0, west: 199, east: 0 };
  const allPts = [];
  p.fu.forEach((u, fi) => {
    if (!u.c) return;
    const col = PCOLORS[p.id] || "#2f5d70";
    // 府治也作为一个点参与 Voronoi
    allPts.push({ pos: u.c, fu: fi, col, isFu: true });
    Object.keys(u.xianc || {}).forEach(nm => {
      const d = u.xianc[nm];
      const pos = Array.isArray(d) ? d : d.c;
      if (pos) allPts.push({ pos, fu: fi, col, isFu: false });
    });
    // 更新 bounds
    const xc = u.xianc || {};
    [u.c, ...Object.values(xc).map(d => Array.isArray(d) ? d : d.c)].forEach(pos => {
      if (!pos) return;
      bounds.south = Math.min(bounds.south, pos[0]);
      bounds.north = Math.max(bounds.north, pos[0]);
      bounds.west = Math.min(bounds.west, pos[1]);
      bounds.east = Math.max(bounds.east, pos[1]);
    });
  });
  if (allPts.length < 3) return;
  const pad = 0.5;
  bounds.south -= pad; bounds.north += pad;
  bounds.west -= pad; bounds.east += pad;

  allPts.forEach((pt, i) => {
    // 邻居 = 最近的 12 个点
    const dists = allPts.filter(o => o !== pt)
      .map(o => ({ o, d: map.distance(pt.pos, o.pos) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 12)
      .map(x => x.o.pos);
    if (!dists.length) return;
    // 附郭跳过
    if (dists[0] && map.distance(pt.pos, dists[0]) < 2000 && pt.isFu) return;
    const cell = voronoiCell(pt.pos, dists, bounds);
    if (!cell || cell.length < 3) return;
    // 同府交替深浅，不同府用同一省色
    const shade = pt.isFu ? 0.02 : ((pt.fu + (i % 2)) % 2 === 0 ? 0.05 : 0.09);
    const polygon = L.polygon(cell, {
      color: pt.col, weight: pt.isFu ? 1.5 : 0.6,
      opacity: pt.isFu ? 0.5 : 0.25,
      fillColor: pt.col, fillOpacity: shade,
      interactive: false
    }).addTo(map);
    countyCircles.push(polygon);
  });
}

/* Voronoi 县域：精确多边形分区，县界完美拼合 */
function voronoiCell(target, neighbors, bounds) {
  // 半平面裁剪法：从大方框开始，逐一用与邻居的垂直平分线裁剪
  let poly = [
    [bounds.south, bounds.west], [bounds.north, bounds.west],
    [bounds.north, bounds.east], [bounds.south, bounds.east]
  ];
  const [ty, tx] = target;
  for (const [ny, nx] of neighbors) {
    // 垂直平分线上的两个点 + 法向量
    const my = (ty + ny) / 2, mx = (tx + nx) / 2;
    const dx = nx - tx, dy = ny - ty;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len < 1) continue;
    const nxn = dx / len, nyn = dy / len; // 单位法向量（指向邻居）
    // 裁剪：保留 target 侧（点积 < 0 的一侧）
    const newPoly = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i], next = poly[(i+1) % poly.length];
      const curSide = (cur[0]-my)*nxn + (cur[1]-mx)*nyn;
      const nextSide = (next[0]-my)*nxn + (next[1]-mx)*nyn;
      if (curSide <= 0) newPoly.push(cur);
      if ((curSide < 0) !== (nextSide < 0)) {
        const t = curSide / (curSide - nextSide);
        newPoly.push([cur[0] + t*(next[0]-cur[0]), cur[1] + t*(next[1]-cur[1])]);
      }
    }
    poly = newPoly;
    if (poly.length < 3) return null;
  }
  return poly;
}

let countyCircles = [];
function showCountyTerritories(p, u){
  clearCountyTerritories();
  const xc = u.xianc || {};
  const names = Object.keys(xc);
  if (names.length < 2) return;
  const col = PCOLORS[p.id] || "#2f5d70";
  const pts = names.map(nm => {
    const d = xc[nm];
    return { nm, pos: Array.isArray(d) ? d : d.c };
  }).filter(x => x.pos);
  if (u.c) pts.push({ nm: "__fu__", pos: u.c });
  if (pts.length < 2) return;

  // 找 bounds
  let south=99, north=0, west=199, east=0;
  pts.forEach(pt => {
    south = Math.min(south, pt.pos[0]); north = Math.max(north, pt.pos[0]);
    west = Math.min(west, pt.pos[1]); east = Math.max(east, pt.pos[1]);
  });
  const pad = 0.5;
  const bounds = { south: south-pad, north: north+pad, west: west-pad, east: east+pad };

  pts.forEach((pt, i) => {
    // 邻居 = 距离 < 3x 最近距离的其他县
    const dists = pts.filter(o => o !== pt).map(o => ({
      o, d: map.distance(pt.pos, o.pos)
    })).sort((a,b) => a.d - b.d);
    if (!dists.length) return;
    const minD = dists[0].d;
    if (minD < 1000) return; // 附郭跳过
    const neighbors = dists.filter(x => x.d < Math.max(minD * 3, 50000)).map(x => x.o.pos);
    const cell = voronoiCell(pt.pos, neighbors, bounds);
    if (!cell || cell.length < 3) return;
    const shade = pt.nm === "__fu__" ? 0.03 : (i % 2 === 0 ? 0.06 : 0.10);
    const polygon = L.polygon(cell, {
      color: col, weight: 0.8, opacity: .3,
      fillColor: col, fillOpacity: shade,
      interactive: false
    }).addTo(map);
    countyCircles.push(polygon);
  });
}
function clearCountyTerritories(){
  countyCircles.forEach(c => map.removeLayer(c));
  countyCircles = [];
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
    safeFlyTo(pos, 8, {duration:1});
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
