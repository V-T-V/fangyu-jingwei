/* ═══════════ 方舆经纬 · 地图与三图层 ═══════════ */

const map = L.map("map",{zoomControl:true,minZoom:4,maxZoom:12,
  attributionControl:false,maxBounds:[[15,88],[47,140]],maxBoundsViscosity:.6});
map.fitBounds([[17,96],[44,129]]);
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}",{
  maxZoom:12,maxNativeZoom:8}).addTo(map);

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
    });
  });
}
/* 属州层 zoom 门控 */
map.on("zoomend",()=>{
  document.body.classList.toggle("z6", map.getZoom()>=6);
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
function eraHull(e){
  const all = [...e.caps, ...e.plcs].map(c=>[c[1], c[2]]);
  const hull = convexHull(all);
  if(hull.length < 3) return null;
  const n = hull.length;
  const cLat = hull.reduce((s,p)=>s+p[0],0)/n, cLng = hull.reduce((s,p)=>s+p[1],0)/n;
  return hull.map(p=>[cLat+(p[0]-cLat)*1.3, cLng+(p[1]-cLng)*1.3]);   // 由重心外扩三成
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
function buildRivers(sel){
  riverLayer.clearLayers();
  RIVERS.forEach(r=>{
    const line = L.polyline(r.pts.map(p=>[p[0],p[1]]),{color:r.color,weight:r.weight,
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

/* 舆图模式：点地图空白处取消省选 */
map.on("click",()=>{
  if(mode==="舆图" && selPid) selectProv(null);
});
