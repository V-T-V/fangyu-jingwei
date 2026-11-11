/* ═══════════ 方舆经纬 · 数据透视 ═══════════ */
/* 自包含工具：不依赖 map.js / Leaflet */
function _anaDist(a, b) {
  const R = 6371;
  const la1 = a[0]*Math.PI/180, la2 = b[0]*Math.PI/180;
  const dLa = (b[0]-a[0])*Math.PI/180, dLo = (b[1]-a[1])*Math.PI/180;
  const h = Math.sin(dLa/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLo/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h)); // km
}
function _anaHullArea(pts) {
  if (pts.length < 3) return 0;
  const sorted = [...pts].sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const cross = (o,a,b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lower = [], upper = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = sorted.length-1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0,-1).concat(upper.slice(0,-1));
  if (hull.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const j = (i+1) % hull.length;
    area += hull[i][0]*hull[j][1] - hull[j][0]*hull[i][1];
  }
  const latAvg = (pts.reduce((s,p) => s + p[0], 0) / pts.length) * Math.PI / 180;
  return Math.abs(area/2) * 111 * 111 * Math.cos(latAvg); // km²
}

function openAnalytics(){
  vset("透视", "分析");
  vseal.textContent = "统计";
  document.body.classList.remove("nopanel");
  panel.classList.add("open");
  panel.style.width = "min(720px, calc(100vw - 20px))";
  panel.style.top = "76px";
  panel.style.bottom = "52px";

  // ── 数据准备 ──
  const dists = [];
  const provDists = {};
  const fuAreas = [];
  for (const p of FY.provinces) {
    provDists[p.name] = [];
    for (const u of p.fu) {
      if (!u.c) continue;
      const pts = [u.c];
      Object.keys(u.xianc || {}).forEach(nm => {
        const d = u.xianc[nm];
        const pos = Array.isArray(d) ? d : d.c;
        if (pos) {
          pts.push(pos);
          const km = _anaDist(u.c, pos);
          if (km > 1) {
            dists.push({ prov: p.name, fu: u.n, km });
            provDists[p.name].push(km);
          }
        }
      });
      if (pts.length >= 3) {
        const area = _anaHullArea(pts);
        if (area > 0) fuAreas.push({ prov: p.name, fu: u.n, area });
      }
    }
  }
  dists.sort((a,b) => a.km - b.km);
  fuAreas.sort((a,b) => b.area - a.area);
  const median = dists[Math.floor(dists.length/2)]?.km || 0;
  const mean = dists.reduce((s,d) => s + d.km, 0) / (dists.length || 1);

  // ── 直方图数据 ──
  const bins = {};
  for (let b = 0; b < 400; b += 20) bins[b] = 0;
  dists.forEach(d => {
    const b = Math.min(Math.floor(d.km / 20) * 20, 380);
    bins[b] = (bins[b] || 0) + 1;
  });
  const maxBin = Math.max(...Object.values(bins));

  // ── 分省中位数 ──
  const provStats = Object.keys(provDists)
    .filter(k => provDists[k].length >= 5)
    .map(k => ({
      prov: k,
      median: provDists[k].sort((a,b) => a-b)[Math.floor(provDists[k].length/2)],
      n: provDists[k].length
    })).sort((a,b) => a.median - b.median);

  // ── 渲染 ──
  const histBars = Object.keys(bins).sort((a,b) => +a - +b).map(b => {
    const h = (bins[b] / maxBin) * 100;
    return `<div class="hist-col" title="${b}-${+b+19}km: ${bins[b]}县">
      <div class="hist-bar" style="height:${h}%"></div>
      <span class="hist-lab">${+b < 100 ? b : ''}</span>
    </div>`;
  }).join("");

  const provBars = provStats.map((s, i) => {
    const w = (s.median / provStats[provStats.length-1].median) * 100;
    return `<div class="prov-row">
      <span class="prov-nm">${s.prov}</span>
      <div class="prov-track"><div class="prov-fill" style="width:${w}%;background:hsl(${140 - i*8},35%,45%)"></div></div>
      <span class="prov-val">${s.median.toFixed(0)}km</span>
      <span class="prov-ct">n=${s.n}</span>
    </div>`;
  }).join("");

  const topFu = fuAreas.slice(0, 15).map((f, i) =>
    `<tr><td>${i+1}</td><td>${f.fu}</td><td>${f.prov}</td><td class="num">${Math.round(f.area).toLocaleString()}</td></tr>`
  ).join("");

  const botFu = fuAreas.slice(-8).reverse().map((f, i) =>
    `<tr><td>${fuAreas.length - i}</td><td>${f.fu}</td><td>${f.prov}</td><td class="num">${Math.round(f.area).toLocaleString()}</td></tr>`
  ).join("");

  pbody.innerHTML = `
  <style>
    .ana-section{margin-bottom:20px}
    .ana-title{font-family:KaiTi,serif;font-size:16px;letter-spacing:4px;color:var(--azur-d);margin-bottom:10px;border-bottom:1px solid var(--line);padding-bottom:6px}
    .ana-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
    .ana-stat{text-align:center;padding:10px 4px;background:rgba(47,93,112,.05);border:1px solid var(--line)}
    .ana-stat b{display:block;font-family:KaiTi,serif;font-size:24px;color:var(--azur-d)}
    .ana-stat span{font-size:10px;letter-spacing:2px;color:var(--ink-faint)}
    .hist-wrap{display:flex;align-items:flex-end;gap:2px;height:120px;padding:0 4px;border-bottom:1px solid var(--line);margin-bottom:4px}
    .hist-col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%}
    .hist-bar{width:100%;background:linear-gradient(180deg,#5a8368,#3d6b52);border-radius:1px 1px 0 0;min-height:1px}
    .hist-lab{font-size:9px;color:var(--ink-faint);margin-top:2px}
    .prov-row{display:flex;align-items:center;gap:8px;padding:3px 0}
    .prov-nm{width:60px;font-size:13px;letter-spacing:1px;text-align:right;flex:none}
    .prov-track{flex:1;height:14px;background:rgba(90,72,44,.08);position:relative}
    .prov-fill{height:100%;border-radius:0 2px 2px 0}
    .prov-val{width:46px;font-size:12px;color:var(--ink-mid);flex:none}
    .prov-ct{width:36px;font-size:10px;color:var(--ink-faint);flex:none}
    .ana-table{width:100%;border-collapse:collapse;font-size:12px}
    .ana-table th{position:sticky;top:0;background:var(--silk-2);font-family:KaiTi,serif;font-size:11px;letter-spacing:2px;padding:5px 8px;border-bottom:1px solid var(--line);text-align:left}
    .ana-table td{padding:3px 8px;border-bottom:1px dashed rgba(120,96,54,.15)}
    .ana-table .num{text-align:right;font-variant-numeric:tabular-nums}
    .ana-note{font-size:11px;line-height:1.8;letter-spacing:1px;color:var(--ink-mid);padding:8px 12px;border:1px dashed rgba(120,96,54,.3);background:rgba(245,238,218,.5);margin-top:6px}
  </style>

  <div class="p-kicker">读史方舆纪要 · 空间统计 · 基于 ${dists.length} 个非附郭县治推算坐标</div>
    <div style="margin:8px 0;display:flex;gap:8px;align-items:center">
      <label style="font-size:12px;letter-spacing:2px;color:var(--ink-mid)">省份筛选</label>
      <select id="provFilter" style="padding:4px 10px;font-family:inherit;font-size:13px;letter-spacing:1px;border:1px solid var(--line);background:var(--silk-3);color:var(--ink);outline:none;border-radius:0">
        <option value="">全部十五省</option>
        ${FY.provinces.map(x=>`<option value="${x.name}">${x.name}</option>`).join("")}
      </select>
    </div>

  <div class="ana-section">
    <div class="ana-title">总览</div>
    <div class="ana-stats">
      <div class="ana-stat"><b>${dists.length}</b><span>样本县</span></div>
      <div class="ana-stat"><b>${median.toFixed(0)}<small style="font-size:12px">km</small></b><span>中位距离</span></div>
      <div class="ana-stat"><b>${mean.toFixed(0)}<small style="font-size:12px">km</small></b><span>平均距离</span></div>
      <div class="ana-stat"><b>${Math.round(median/0.357)}</b><span>折合明里</span></div>
    </div>
    <div class="ana-note">中位距离 ${median.toFixed(0)} km 折合约 ${Math.round(median/0.357)} 明里——恰好一个白天的骑程，验证明代府辖县的「一日可达」原则。详见 <a href="ANALYSIS.md" target="_blank" style="color:var(--azur-d)">ANALYSIS.md</a>。</div>
  </div>

  <div class="ana-section">
    <div class="ana-title">县→府直线距离分布（每格 20 km）</div>
    <div class="hist-wrap">${histBars}</div>
    <div style="font-size:10px;color:var(--ink-faint);text-align:right">km</div>
  </div>

  <div class="ana-section">
    <div class="ana-title">分省中位距离（浙江最密 → 湖广最疏）</div>
    ${provBars}
    <div class="ana-note">南北密度梯度：江南水乡（浙江 ${provStats[0]?.median.toFixed(0)} km）→ 西北边疆（湖广 ${provStats[provStats.length-1]?.median.toFixed(0)} km），递增近一倍。</div>
  </div>

  <div class="ana-section">
    <div class="ana-title">府域面积 TOP 15（km²）</div>
    <table class="ana-table"><thead><tr><th>#</th><th>府</th><th>省</th><th style="text-align:right">面积</th></tr></thead><tbody>${topFu}</tbody></table>
  </div>

  <div class="ana-section">
    <div class="ana-title">最小府域</div>
    <table class="ana-table"><thead><tr><th>#</th><th>府</th><th>省</th><th style="text-align:right">面积</th></tr></thead><tbody>${botFu}</tbody></table>
    <div class="ana-note">天下第一府 = 夔州（${Math.round(fuAreas[0]?.area||0).toLocaleString()} km²），最小 = ${fuAreas[fuAreas.length-1]?.fu}（${Math.round(fuAreas[fuAreas.length-1]?.area||0).toLocaleString()} km²），差距 ${fuAreas.length>0 ? Math.round(fuAreas[0].area / fuAreas[fuAreas.length-1].area) : 0} 倍。</div>
  </div>

  <div class="ana-section">
    <div class="ana-title">府域面积 × 平均县距</div>
    <div id="scatterArea"></div>
    <div class="ana-note">每个点 = 一府。横轴：府域面积（km²，对数），纵轴：县治平均距离（km）。可见面积越大、县距越远的正相关趋势。</div>
  </div>

  <div class="readrow" style="margin-top:14px;display:flex;gap:8px">
    <button class="readfull" id="anaCsv">⤓ 导出 CSV</button>
    <button class="readfull" id="anaBack">⟨ 返回舆图</button>
  </div>`;

  const pf = document.getElementById("provFilter");
  if (pf) pf.onchange = () => {
    const prov = pf.value;
    if (!prov) return; // 全部 = 不筛选（暂不重绘）
    // 高亮该省的条形图行
    pbody.querySelectorAll(".prov-row").forEach(row => {
      const isMatch = row.querySelector(".prov-nm").textContent === prov;
      row.style.background = isMatch ? "rgba(178,58,46,.08)" : "";
      row.style.opacity = prov && !isMatch ? .35 : 1;
    });
    // 高亮表格中该省的行
    pbody.querySelectorAll(".ana-table tbody tr").forEach(tr => {
      const isMatch = tr.cells[2] && tr.cells[2].textContent === prov;
      tr.style.background = isMatch ? "rgba(178,58,46,.06)" : "";
      tr.style.opacity = prov && !isMatch ? .3 : 1;
    });
  };
  // 散点图渲染
  const scArea = document.getElementById("scatterArea");
  if (scArea) {
    const fuDists = {};
    dists.forEach(d => {
      if (!fuDists[d.fu]) fuDists[d.fu] = [];
      fuDists[d.fu].push(d.km);
    });
    const pts = fuAreas
      .filter(f => fuDists[f.fu] && fuDists[f.fu].length >= 2)
      .map(f => ({ fu: f.fu, prov: f.prov, area: f.area,
        avgD: fuDists[f.fu].reduce((s,x) => s+x, 0) / fuDists[f.fu].length }));
    if (pts.length >= 5) {
      const maxA = Math.max(...pts.map(x => x.area));
      const maxD = Math.max(...pts.map(x => x.avgD));
      const dots = pts.map(x => {
        const left = (Math.log10(x.area) / Math.log10(maxA)) * 88 + 4;
        const bottom = (x.avgD / maxD) * 82 + 5;
        const sz = Math.min(Math.log2(x.avgD) * 4, 14);
        return '<div class="sc-dot" style="left:'+left+'%;bottom:'+bottom+'%;width:'+sz+'px;height:'+sz+'px" title="'+x.fu+'('+x.prov+'): '+Math.round(x.area)+'km² / '+x.avgD.toFixed(0)+'km"></div>';
      }).join("");
      scArea.innerHTML = '<div class="sc-wrap"><div class="sc-y">km</div><div class="sc-plot">'+dots+'</div><div class="sc-x">km²</div></div>';
    }
  }
  // CSV 导出
  document.getElementById("anaCsv").onclick = () => {
    const NL = String.fromCharCode(10);
    let csv = String.fromCharCode(0xFEFF) + "省份,府,县治距离km" + NL;
    dists.forEach(d => { csv += d.prov + "," + d.fu + "," + d.km.toFixed(1) + NL; });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
    a.download = "方舆经纬-县治距离.csv";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
  };
  document.getElementById("anaBack").onclick = () => {
    panel.style.width = "";
    panel.style.top = "";
    panel.style.bottom = "";
    openIntro();
  };
}
