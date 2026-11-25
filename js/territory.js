/* ═══════════ 方舆经纬 · 县域示意（选省 / 选府时的 Voronoi 拼图与域晕裁剪） ═══════════
   自 map.js 拆出（map.js 触 700 行上限）。调用方一律以 typeof 守卫引入；
   依赖 map.js 的全局 map / PCOLORS / provHull / fuHull。 */

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
    const others = allPts.filter(o => o !== pt);
    if (!others.length) return;
    // 附郭跳过：府治与附郭县同点，只画县的那一格
    if (pt.isFu && others.some(o => map.distance(pt.pos, o.pos) < 2000)) return;
    // 邻居 = 其余全部点 → 精确 Voronoi，单元彼此不叠。
    // 此前只取最近 12 个：单元切不全、层层叠压；加之 voronoiCell 分量乘反，叠出来是一整块实心矩形
    const cell = voronoiCell(pt.pos, others.map(o => o.pos), bounds);
    if (!cell || cell.length < 3) return;
    // 同一府的县同一色阶，府与府深浅交替——「府域」拼图
    const shade = pt.fu % 2 === 0 ? 0.03 : 0.07;
    const polygon = L.polygon(cell, {
      color: pt.col, weight: 0.5, opacity: 0.22,
      fillColor: pt.col, fillOpacity: shade,
      interactive: false
    }).addTo(map);
    countyCircles.push(polygon);
  });
  clipToHull(countyCircles, provHull);
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
      // 点在法向上的投影 = 经度差 × 法向经度分量 + 纬度差 × 法向纬度分量。
      // （此前两组乘反——cur[0] / next[0] 是纬度，却乘了经度分量 nxn——半平面切在了错误的位置）
      const curSide = (cur[1]-mx)*nxn + (cur[0]-my)*nyn;
      const nextSide = (next[1]-mx)*nxn + (next[0]-my)*nyn;
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
    const others = pts.filter(o => o !== pt);
    if (!others.length) return;
    // 附郭跳过：府治点与附郭县同点，只画县的那一格
    if (pt.nm === "__fu__" && others.some(o => map.distance(pt.pos, o.pos) < 2000)) return;
    const cell = voronoiCell(pt.pos, others.map(o => o.pos), bounds);
    if (!cell || cell.length < 3) return;
    const shade = pt.nm === "__fu__" ? 0.03 : (i % 2 === 0 ? 0.05 : 0.09);
    const polygon = L.polygon(cell, {
      color: col, weight: 0.6, opacity: .28,
      fillColor: col, fillOpacity: shade,
      interactive: false
    }).addTo(map);
    countyCircles.push(polygon);
  });
  clipToHull(countyCircles, fuHull);
}
/* 单元裁到域晕轮廓内：Leaflet 的矢量画在同一 <svg> 里，给单元 path 挂 clip-path
   （<use> 引用轮廓 path，缩放时随之变换）即可。不裁的话单元填满外扩的经纬框，四边是笔直的矩形硬边 */
let clipSeq = 0;
function clipToHull(layers, hull){
  const hp = hull && hull._path;
  if (!hp || !hp.ownerSVGElement) return;
  const NS = "http://www.w3.org/2000/svg", svg = hp.ownerSVGElement;
  if (!hp.id) hp.id = "fy-hull-" + (++clipSeq);
  let cp = svg.querySelector("clipPath.fy-hull-clip");
  if (!cp){
    cp = document.createElementNS(NS, "clipPath");
    cp.setAttribute("class", "fy-hull-clip");
    cp._use = document.createElementNS(NS, "use");
    cp.appendChild(cp._use);
    (svg.querySelector("defs") || svg.insertBefore(document.createElementNS(NS, "defs"), svg.firstChild)).appendChild(cp);
  }
  cp.id = "fy-hull-clip";
  cp._use.setAttribute("href", "#" + hp.id);
  layers.forEach(l => { if (l._path) l._path.setAttribute("clip-path", "url(#fy-hull-clip)"); });
}
function clearCountyTerritories(){
  countyCircles.forEach(c => map.removeLayer(c));
  countyCircles = [];
}
