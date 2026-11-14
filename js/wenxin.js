/* ═══════════ 方舆经纬 · 文心（全书文本计量） ═══════════
   依赖 fulltext.js 的 ensureTextAll / countHits 与 panels.js 的面板基元。
   三问：顾祖禹的笔墨写到哪里去？哪些地名被反复掂量？战略词汇浓在何处？ */

/* 战略词汇（顾祖禹军事地理语汇，人工整编 16 词） */
const WX_VOCAB = ["形胜","险要","要害","咽喉","锁钥","门户","屏蔽","冲要",
                  "守御","屯戍","关隘","堡寨","烽堠","营垒","倭寇","盗贼"];

let _wxCache = null;          // 计算结果缓存（重开面板即时呈现）
let _wxBusy = false;

/* ── 被引着色：全书掂量次数画上舆图 ─────────────────────
   圆径与色温随 log(次数) 缩放——顾祖禹战略注意力的地图化。 */
let fuHeatLayer = null, fuHeatLegend = null;
function clearFuHeat(){
  if (fuHeatLayer){ map.removeLayer(fuHeatLayer); fuHeatLayer = null; }
  if (fuHeatLegend){ fuHeatLegend.remove(); fuHeatLegend = null; }
  const btn = document.getElementById("wxheat");
  if (btn){ btn.textContent = "🗺 被引着色"; btn.title = "在舆图上以圆径色温呈现各府被引次数"; }
}
function toggleFuHeat(){
  if (fuHeatLayer){ clearFuHeat(); return; }
  if (!_wxCache) return;
  if (mode !== "舆图") setMode("舆图");
  const f = _wxCache.fuAll;
  const ns = f.map(x => x.n);
  const lo = Math.log(Math.max(1, Math.min(...ns))), hi = Math.log(Math.max(...ns));
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const colAt = t => `rgb(${lerp(160,178,t)},${lerp(119,58,t)},${lerp(47,46,t)})`;   // 赭→朱
  fuHeatLayer = L.layerGroup().addTo(map);
  f.forEach(x => {
    const p = FY.provinces.find(pp => pp.id === x.pid);
    const u = p && p.fu.find(uu => uu.n === x.fu);
    if (!u || !u.c) return;
    const t = hi > lo ? (Math.log(x.n) - lo) / (hi - lo) : .5;
    L.circleMarker(u.c, {
      radius: 7 + 11 * t, color: "#7a4a1f", weight: 1,
      fillColor: colAt(t), fillOpacity: .5,
      className: "fuheat", interactive: true
    }).addTo(fuHeatLayer)
      .bindTooltip(`<b style="font-family:KaiTi,serif;font-size:13.5px">${x.fu}</b><br>
        <span style="font-size:10px;color:#57503f">全书被引 ${x.n} 次 · 第 ${f.indexOf(x)+1} 位</span>`,
        {direction:"top",offset:[0,-4],opacity:.95,className:"ftip"})
      .on("click", () => { if (mode !== "舆图") setMode("舆图"); selectProv(p.id); openFu(p, u); });
  });
  const maxN = f[0].n, minN = f[f.length-1].n;
  fuHeatLegend = L.control({position: "topright"});
  fuHeatLegend.onAdd = function(){
    const d = L.DomUtil.create("div", "fuheat-legend");
    d.innerHTML = `<b>被引着色</b><i>${minN} 次</i>
      <span style="background:linear-gradient(90deg,${colAt(0)},${colAt(1)})"></span>
      <i>${maxN} 次</i>`;
    return d;
  };
  fuHeatLegend.addTo(map);
  const btn = document.getElementById("wxheat");
  if (btn){ btn.textContent = "✓ 已着色 · 关闭"; btn.title = "点此关闭被引着色"; }
}

function openWenxin(){
  vset("文心", "计量");
  vseal.textContent = "笔墨";
  document.body.classList.remove("nopanel");
  panel.classList.add("open");
  panel.style.width = "min(720px, calc(100vw - 20px))";
  panel.style.top = "76px";
  panel.style.bottom = "52px";

  if (_wxCache){ wxRender(_wxCache); return; }
  if (_wxBusy) return;

  pbody.innerHTML = `
  <style>
    .wx-title{font-family:KaiTi,serif;font-size:16px;letter-spacing:4px;color:var(--azur-d);margin:14px 0 8px;border-bottom:1px solid var(--line);padding-bottom:6px}
    .wx-note{font-size:11px;line-height:1.8;letter-spacing:1px;color:var(--ink-mid);padding:8px 12px;border:1px dashed rgba(120,96,54,.3);background:rgba(245,238,218,.5);margin-top:6px}
    .wx-row{display:flex;align-items:center;gap:8px;padding:2.5px 0}
    .wx-nm{width:64px;font-size:13px;letter-spacing:1px;text-align:right;flex:none;cursor:pointer}
    .wx-nm.fu{cursor:pointer}
    .wx-track{flex:1;height:13px;background:rgba(90,72,44,.08);position:relative}
    .wx-fill{height:100%;background:linear-gradient(90deg,#2f5d70,#3d7a72);border-radius:0 2px 2px 0;cursor:pointer}
    .wx-val{width:110px;font-size:11.5px;color:var(--ink-mid);flex:none;font-variant-numeric:tabular-nums}
    .wx-chip{display:inline-block;padding:3px 10px;margin:2px 3px 2px 0;font-size:12.5px;letter-spacing:2px;
      font-family:KaiTi,serif;border:1px solid var(--line);background:var(--silk-3);cursor:pointer;color:var(--ink-mid)}
    .wx-chip.on{background:rgba(178,58,46,.08);border-color:rgba(178,58,46,.5);color:var(--cinnabar-d)}
    .wx-prog{font-size:12px;letter-spacing:2px;color:var(--ink-faint);padding:4px 0;font-family:KaiTi,serif}
  </style>
  <div class="p-kicker">读史方舆纪要 · 文本计量</div>
  <div class="wx-prog" id="wxProg">正在准备全书原文…</div>`;

  ensureTextAll((key, done, total) => {
    const el = document.getElementById("wxProg");
    if (el) el.textContent = `载入原文 ${done} / ${total} …`;
  }, () => {
    /* 深度优化：计量入 Worker（文本已在后台线程，主线程零阻塞）；
       无头/无 Worker 环境自动回退主线程分块路径 */
    if (typeof ftWorkerWenxin === "function"){
      ftWorkerWenxin(cache => {
        if (cache && Array.isArray(cache.fuAll) && cache.fuAll.length){
          window.__wxwUsed = true;
          _wxCache = cache;
          _wxBusy = false;
          wxRender(_wxCache);
          return;
        }
        wxCompute();
      });
      return;
    }
    wxCompute();
  });
}

/* 地→文：府详情卡取此府的被引次数与名次（未计量时返回 null） */
function wxFuStat(p, u){
  if (!_wxCache) return null;
  const f = _wxCache.fuAll.find(x => x.pid === p.id && x.fu === u.n);
  if (!f) return null;
  return { n: f.n, rank: _wxCache.fuAll.indexOf(f) + 1 };
}

/* ── 计算（分块，UI 不冻结；then=完成回调，缺省渲染文心面板） ── */
function wxCompute(then){
  _wxBusy = true;
  /* 省级语料 + 字数 */
  const provChars = [], provText = {};
  let extraChars = 0;
  FY.provinces.forEach(p => {
    const bag = FYTEXT[p.id] || {};
    const parts = [];
    if (bag.xu){ parts.push(bag.xu); }
    Object.keys(bag.fu || {}).forEach(nm => parts.push(bag.fu[nm]));
    const txt = parts.join("");
    provText[p.id] = txt;
    provChars.push({ prov: p.name, pid: p.id, chars: txt.length });
  });
  ["juanshou","xingshi","chuandu"].forEach(k => {
    const v = FYTEXT[k];
    if (Array.isArray(v)) v.forEach(it => { extraChars += (typeof it === "string" ? it : it.x || "").length; });
  });
  provChars.sort((a,b) => b.chars - a.chars);
  const totalChars = provChars.reduce((s,x) => s + x.chars, 0);

  /* 战略词汇分省密度 */
  const vocab = {};
  WX_VOCAB.forEach(w => {
    vocab[w] = FY.provinces.map(p => {
      const n = countHits(provText[p.id] || "", w);
      const ch = provChars.find(x => x.prov === p.name).chars;
      return { prov: p.name, pid: p.id, n, dens: ch ? n * 10000 / ch : 0 };
    }).sort((a,b) => b.n - a.n);
  });

  /* 府名被引：全书语料（省+卷首+形势+川渎）连缀一次 */
  const allParts = FY.provinces.map(p => provText[p.id] || "");
  ["juanshou","xingshi","chuandu"].forEach(k => {
    const v = FYTEXT[k];
    if (Array.isArray(v)) v.forEach(it => allParts.push(typeof it === "string" ? it : it.x || ""));
  });
  const bigText = allParts.join("");

  /* 天下之X 意象（口径同 paper_stats.js；守卫顺序教训：十/百分支在前） */
  const CJK0 = String.fromCharCode(0x4e00), CJK1 = String.fromCharCode(0x9fff);
  const txRe = new RegExp("天下之([" + CJK0 + "-" + CJK1 + "]{1,3})", "g");
  const txCnt = {};
  let txm;
  while ((txm = txRe.exec(bigText)) !== null) txCnt[txm[1]] = (txCnt[txm[1]] || 0) + 1;
  const tianxiaTop = Object.entries(txCnt).sort((a, b) => b[1] - a[1]).slice(0, 8);

  /* 顾祖禹的书架：《》引书 TOP12（口径同 paper_stats.js） */
  const LBk = String.fromCharCode(0x300a), RBk = String.fromCharCode(0x300b);
  const bkRe = new RegExp("[" + LBk + "]([^" + LBk + RBk + "]{2,8})[" + RBk + "]", "g");
  const bkCnt = {};
  let bmm;
  while ((bmm = bkRe.exec(bigText)) !== null) bkCnt[bmm[1]] = (bkCnt[bmm[1]] || 0) + 1;
  const bookTop = Object.entries(bkCnt).sort((a, b) => b[1] - a[1]).slice(0, 12);

  const names = [], seen = new Set();
  const provNms = new Set(FY.provinces.map(p => p.name));
  FY.provinces.forEach(p => p.fu.forEach(u => {
    let term = u.n.replace(/(军民府|军民卫|州府|府|州|卫)$/, "");
    /* 单字简名（徐州→徐）与省名撞车（河南府→河南）都退回全名检索 */
    if (term.length < 2 || provNms.has(term)) term = u.n;
    if (seen.has(term)) return;
    seen.add(term);
    names.push({ bare: term, fu: u.n, prov: p.name, pid: p.id });
  }));

  const prog = document.getElementById("wxProg");
  const fuAll = [];
  const CH = 24;                                  // 每块 24 名，让出主线程
  const step = i0 => {
    const el = prog || document.getElementById("wxProg");
    if (el) el.textContent = `掂量府名 ${Math.min(i0 + CH, names.length)} / ${names.length} …`;
    for (let i = i0; i < Math.min(i0 + CH, names.length); i++){
      fuAll.push({ ...names[i], n: countHits(bigText, names[i].bare) });
    }
    if (i0 + CH < names.length){ setTimeout(() => step(i0 + CH), 0); return; }
    fuAll.sort((a,b) => b.n - a.n);
    _wxCache = { provChars, extraChars, totalChars, vocab, fuAll, bookTop, tianxiaTop };
    _wxBusy = false;
    if (typeof then === "function") then(_wxCache); else wxRender(_wxCache);
  };
  step(0);
}

/* ── 渲染 ───────────────────────────────────────────── */
let _wxWord = "形胜";
function wxRender(c){
  const maxChars = c.provChars[0].chars;
  const charBars = c.provChars.map(x => `
    <div class="wx-row"><span class="wx-nm" data-pid="${x.pid}" title="点击入舆图观其省域">${x.prov}</span>
      <div class="wx-track"><div class="wx-fill" style="width:${(x.chars/maxChars*100).toFixed(1)}%"></div></div>
      <span class="wx-val">${(x.chars/10000).toFixed(1)} 万字</span></div>`).join("");

  const top20 = c.fuAll.slice(0, 20);
  const maxN = top20[0] ? top20[0].n : 1;
  const fuBars = top20.map((f,i) => `
    <div class="wx-row"><span class="wx-nm fu" data-w="${f.bare}" title="点击全书检索「${f.bare}」">${i+1} ${f.bare}</span>
      <div class="wx-track"><div class="wx-fill" data-w="${f.bare}" style="width:${(f.n/maxN*100).toFixed(1)}%;background:linear-gradient(90deg,#a0522d,#b23a2e)"></div></div>
      <span class="wx-val">${f.n} 次 · ${f.prov}<i class="wxgo" data-pid="${f.pid}" data-fu="${f.fu}" title="入舆图观此府"> ➤</i></span></div>`).join("");

  const chips = WX_VOCAB.map(w =>
    `<span class="wx-chip${w===_wxWord?" on":""}" data-w="${w}">${w}</span>`).join("");

  pbody.innerHTML = `
  <style>
    .wx-title{font-family:KaiTi,serif;font-size:16px;letter-spacing:4px;color:var(--azur-d);margin:14px 0 8px;border-bottom:1px solid var(--line);padding-bottom:6px}
    .wx-note{font-size:11px;line-height:1.8;letter-spacing:1px;color:var(--ink-mid);padding:8px 12px;border:1px dashed rgba(120,96,54,.3);background:rgba(245,238,218,.5);margin-top:6px}
    .wx-row{display:flex;align-items:center;gap:8px;padding:2.5px 0}
    .wx-nm{width:64px;font-size:13px;letter-spacing:1px;text-align:right;flex:none}
    .wx-nm.fu,.wx-fill[data-w]{cursor:pointer}
    .wx-nm[data-pid]{cursor:pointer}
    .wx-nm[data-pid]:hover{color:var(--cinnabar-d)}
    .wxgo{font-style:normal;cursor:pointer;color:var(--cinnabar);letter-spacing:0}
    .wxgo:hover{color:var(--cinnabar-d);text-shadow:0 0 6px rgba(178,58,46,.4)}
    .wx-track{flex:1;height:13px;background:rgba(90,72,44,.08);position:relative}
    .wx-fill{height:100%;background:linear-gradient(90deg,#2f5d70,#3d7a72);border-radius:0 2px 2px 0}
    .wx-val{width:110px;font-size:11.5px;color:var(--ink-mid);flex:none;font-variant-numeric:tabular-nums}
    .wx-chip{display:inline-block;padding:3px 10px;margin:2px 3px 2px 0;font-size:12.5px;letter-spacing:2px;
      font-family:KaiTi,serif;border:1px solid var(--line);background:var(--silk-3);cursor:pointer;color:var(--ink-mid)}
    .wx-chip.on{background:rgba(178,58,46,.08);border-color:rgba(178,58,46,.5);color:var(--cinnabar-d)}
    .wx-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0 12px}
    .wx-stat{text-align:center;padding:9px 4px;background:rgba(47,93,112,.05);border:1px solid var(--line)}
    .wx-stat b{display:block;font-family:KaiTi,serif;font-size:22px;color:var(--azur-d)}
    .wx-stat span{font-size:10px;letter-spacing:2px;color:var(--ink-faint)}
  </style>
  <div class="p-kicker">读史方舆纪要 · 文本计量</div>

  <div class="wx-stats">
    <div class="wx-stat"><b>${(c.totalChars/10000).toFixed(0)}</b><span>省卷万字</span></div>
    <div class="wx-stat"><b>${(c.extraChars/10000).toFixed(0)}</b><span>形势川渎卷首</span></div>
    <div class="wx-stat"><b>${c.fuAll.length}</b><span>府名受掂量</span></div>
    <div class="wx-stat"><b>${c.fuAll[0] ? c.fuAll[0].bare : "—"}</b><span>最被引地名</span></div>
  </div>

  <div class="wx-title">卷帙分布 · 各省方舆字数</div>
  ${charBars}
  <div class="wx-note">北密南疏的笔墨本身就是判断——边疆诸省卷帙虽简，形势论列反重；江南赋重之地，纪载尤繁。</div>

  <div class="wx-title">府名被引 TOP 20 · 全书掂量次数</div>
  ${fuBars}
  <div class="wx-note">以简名计（去「府／州／卫」尾），遍检全书 260 万字——被引次数即顾祖禹反复掂量的战略权重。点行可全书检索。个别同名词目（如「太平」）计为合计。</div>

  <div class="wx-title">顾祖禹的书架 · 引书 TOP 12</div>
  ${c.bookTop.map(x => `
    <div class="wx-row"><span class="wx-nm">${x[0]}</span>
      <div class="wx-track"><div class="wx-fill" style="width:${(x[1]/c.bookTop[0][1]*100).toFixed(1)}%;background:linear-gradient(90deg,#6b5a3f,#8a6a3a)"></div></div>
      <span class="wx-val">${x[1]} 次</span></div>`).join("")}
  <div class="wx-note">书例引用近万处——水经注居首，正史地理志（汉/隋/唐/宋）成链；城邑考、舆程记当属顾氏自著或家学所辑。</div>

  <div class="wx-title">天下之 X · 人身喻天下</div>
  <div class="chips">${(c.tianxiaTop || []).map(x =>
    `<span class="chip" title="${x[1]} 处">天下之${x[0]}</span>`).join("")}</div>

  <div class="wx-title">战略词汇 · 分省浓淡</div>
  <div>${chips}</div>
  <div id="wxVocab" style="margin-top:8px"></div>
  <div class="wx-note">军事地理语汇每万字出现次数之排序——边镇（屯戍/烽堠/堡寨）与腹里（漕运/形胜）的用词差，即明代国防地理的心图。点词切换。</div>

  <div class="readrow" style="margin-top:14px;display:flex;gap:8px">
    <button class="readfull" id="wxheat" title="在舆图上以圆径色温呈现各府被引次数">🗺 被引着色</button>
    <button class="readfull" id="wxCsv">⤓ 导出 CSV</button>
    <button class="readfull" id="wxBack">⟨ 返回舆图</button>
  </div>`;

  const drawVocab = () => {
    const rows = c.vocab[_wxWord] || [];
    const mx = rows[0] ? rows[0].n : 1;
    document.getElementById("wxVocab").innerHTML = rows.map(r => `
      <div class="wx-row"><span class="wx-nm" data-pid="${r.pid}" title="点击入舆图观其省域">${r.prov}</span>
        <div class="wx-track"><div class="wx-fill" style="width:${mx?(r.n/mx*100).toFixed(1):0}%"></div></div>
        <span class="wx-val">${r.n} 次 · 万字 ${r.dens.toFixed(2)}</span></div>`).join("");
  };
  drawVocab();
  pbody.querySelectorAll(".wx-chip").forEach(ch => ch.onclick = () => {
    _wxWord = ch.dataset.w;
    pbody.querySelectorAll(".wx-chip").forEach(x => x.classList.toggle("on", x === ch));
    drawVocab();
  });
  pbody.querySelectorAll(".wx-nm.fu,[data-w].wx-fill").forEach(el => {
    if (el.classList.contains("fu") || el.classList.contains("wx-fill"))
      el.onclick = () => ftRun(el.dataset.w);
  });
  /* 文→地联动：省名入舆图观省域；府行 ➤ 直飞该府 */
  const wxReset = () => { panel.style.width=""; panel.style.top=""; panel.style.bottom=""; };
  pbody.querySelectorAll(".wx-nm[data-pid]").forEach(el => el.onclick = () => {
    const p = FY.provinces.find(x => x.id === el.dataset.pid);
    if (!p) return;
    wxReset();
    setMode("舆图"); selectProv(p.id);
  });
  pbody.querySelectorAll(".wxgo").forEach(el => el.onclick = ev => {
    ev.stopPropagation();
    const p = FY.provinces.find(x => x.id === el.dataset.pid);
    const u = p && p.fu.find(x => x.n === el.dataset.fu);
    if (!u) return;
    wxReset();
    setMode("舆图"); selectProv(p.id); openFu(p, u);
  });

  const wh = document.getElementById("wxheat");
  if (wh) wh.onclick = () => toggleFuHeat();
  document.getElementById("wxCsv").onclick = () => {
    const NL = String.fromCharCode(10);
    let csv = String.fromCharCode(0xFEFF) + "类别,名称,省份,指标,数值" + NL;
    c.provChars.forEach(x => { csv += "省卷字数," + x.prov + ",," + "字数," + x.chars + NL; });
    WX_VOCAB.forEach(w => (c.vocab[w] || []).forEach(r => {
      csv += "战略词汇," + w + "," + r.prov + ",次数," + r.n + NL; }));
    c.fuAll.forEach(f => { csv += "府名被引," + f.fu + "," + f.prov + ",次数," + f.n + NL; });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
    a.download = "方舆经纬-文心计量.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };
  document.getElementById("wxBack").onclick = () => {
    panel.style.width = ""; panel.style.top = ""; panel.style.bottom = "";
    openIntro();
  };
}
