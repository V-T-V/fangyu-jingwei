/* ═══════════ 方舆经纬 · 经纬互查（站际反向桥） ═══════════
   姊妹站单向桥（霞客经纬→方舆 · 寰宇经纬→方舆）补成双向：
   「霞客」徐霞客游记日条锚点按省府到访分布（计数随 data/xrev.js 重建更新）
   · 「寰宇」太平寰宇记宋 361 州对应明府分档。数据 data/xrev.js 构建期烘焙
   对应明府分档。数据 data/xrev.js 构建期烘焙（tools/build_xrev.py 生成，
   懒加载仿 sjzLoad 惯例，URL 挂 ?v 防缓存钉死）；深链为相对兄弟路径
   ../XXK/ ../TPHY/（父目录同根服务与 GitHub Pages 项目页两场景皆成立）。
   凡计数出自构建脚本，前端只渲染不计算。 */

let _xrevSub = "xk";            // 当前子页：xk 霞客 / hy 寰宇
let _xrevLoading = null;

function xrevLoad(cb){
  if (window.FY_XREV){ cb(); return; }
  if (_xrevLoading){ _xrevLoading.then(cb); return; }
  _xrevLoading = new Promise(ok => {
    const s = document.createElement("script");
    s.src = "data/xrev.js?v=125";
    s.onload = ok; s.onerror = ok;
    document.head.appendChild(s);
  }).then(() => {
    _xrevLoading = null;
    cb();
  });
}

/* 徽标分档：同名朱 · 升府赭 · 改名青 · 明属州橄榄 · 存疑虚线 · 无对应淡灰 */
const XR_REL = {
  same:   ["同名",   "rgba(178,58,46,.10)",  "rgba(178,58,46,.55)", "var(--cinnabar-d)"],
  promo:  ["升府",   "rgba(160,82,45,.10)",  "rgba(160,82,45,.5)",  "#7a4a1f"],
  rename: ["改名",   "rgba(47,93,112,.10)",  "rgba(47,93,112,.5)",  "var(--azur-d)"],
  mzhou:  ["明属州", "rgba(107,90,63,.10)",  "rgba(107,90,63,.55)", "#5c4d33"],
  near:   ["存疑",   "rgba(90,90,90,.06)",   "rgba(120,110,90,.5)", "var(--ink-faint)"],
  none:   ["无对应", "rgba(90,90,90,.05)",   "rgba(120,110,90,.3)", "var(--ink-faint)"],
};
function xrBadge(rel){
  const b = XR_REL[rel] || XR_REL.none;
  return `<span class="xr-badge" style="background:${b[1]};border-color:${b[2]};color:${b[3]}">${b[0]}</span>`;
}

const XR_STYLE = `
  .xr-title{font-family:KaiTi,serif;font-size:16px;letter-spacing:4px;color:var(--azur-d);margin:14px 0 8px;border-bottom:1px solid var(--line);padding-bottom:6px}
  .xr-note{font-size:11px;line-height:1.8;letter-spacing:1px;color:var(--ink-mid);padding:8px 12px;border:1px dashed rgba(120,96,54,.3);background:rgba(245,238,218,.5);margin-top:6px}
  .xr-row{display:flex;align-items:center;gap:8px;padding:2.5px 0}
  .xr-nm{width:64px;font-size:13px;letter-spacing:1px;text-align:right;flex:none;cursor:pointer;color:var(--azur-d)}
  .xr-nm:hover{color:var(--cinnabar-d)}
  .xr-track{flex:1;height:13px;background:rgba(90,72,44,.08);position:relative}
  .xr-fill{height:100%;border-radius:0 2px 2px 0}
  .xr-val{width:190px;font-size:11.5px;color:var(--ink-mid);flex:none;font-variant-numeric:tabular-nums}
  .xr-badge{display:inline-block;padding:1px 7px;margin-right:5px;font-size:10.5px;letter-spacing:1px;border:1px solid;border-radius:2px;font-family:KaiTi,serif;vertical-align:middle}
  .xr-fu{padding:3px 8px;margin:3px 0;border-left:2px solid rgba(47,93,112,.4);background:rgba(245,238,218,.45);cursor:pointer}
  .xr-funm{font-family:KaiTi,serif;font-size:14.5px;letter-spacing:1px;color:var(--cinnabar-d);cursor:pointer}
  .xr-funm:hover{text-shadow:0 0 6px rgba(178,58,46,.4)}
  .xr-meta{font-size:11px;color:var(--ink-faint);letter-spacing:.5px}
  .xr-chip{display:inline-block;padding:2px 9px;margin:2px 3px 2px 0;font-size:12px;letter-spacing:1px;font-family:KaiTi,serif;border:1px solid var(--line);background:var(--silk-3);cursor:pointer;color:var(--ink-mid)}
  .xr-chip:hover{border-color:rgba(178,58,46,.5);color:var(--cinnabar-d)}
  .xr-ex{font-size:11.5px;line-height:1.8;color:var(--ink-mid);padding:4px 8px;border-left:2px solid rgba(74,122,155,.5);margin:4px 0 4px 6px;background:rgba(245,238,218,.5)}
  .xr-ext{font-family:KaiTi,serif;color:var(--azur-d);letter-spacing:1px}
  .xr-link{color:var(--cinnabar-d);text-decoration:none;border-bottom:1px dotted;white-space:nowrap}
  .xr-dui{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:5px 0 2px 6px}
  .xr-dui>div{padding:6px 9px;font-size:11.5px;line-height:1.85}
  .xr-dui .song{background:rgba(47,93,112,.06);border-left:2px solid rgba(47,93,112,.5)}
  .xr-dui .ming{background:rgba(178,58,46,.05);border-left:2px solid rgba(178,58,46,.45)}
  .xr-src{display:block;font-family:KaiTi,serif;font-size:10.5px;letter-spacing:2px;color:var(--ink-faint);margin-bottom:3px}
  .xr-none{padding:3px 8px;margin:4px 0}
  .xr-nonechips .xr-chip{cursor:default;color:var(--ink-faint);border-style:dashed}
  .xr-nonechips .xr-chip:hover{color:var(--ink-faint);border-color:var(--line)}`;

/* 面板尺寸复位（府详情等复用面板前，防 720px 内联泄漏——wenxin wxReset 同款） */
function xrReset(){ panel.style.width=""; panel.style.top=""; panel.style.bottom=""; }

function xrGoFu(pid, fu){
  const p = FY.provinces.find(x => x.id === pid);
  const u = p && p.fu.find(x => x.n === fu);
  if (!u) return;
  xrReset();
  setMode("舆图"); selectProv(p.id); openFu(p, u);
}

/* ── 霞客子页：每省 → 府到访锚点分布 + 样例 + 行踪摘要 ── */
function xrRenderXk(d){
  const xk = d.xk;
  const esc = h => h.replace(/&/g, "&amp;");
  const y0 = Math.min(...xk.byProv.map(p => p.y0));
  const y1 = Math.max(...xk.byProv.map(p => p.y1));
  const mx = xk.byProv.length ? xk.byProv[0].n : 1;
  const provRows = xk.byProv.map(pv => `
    <div class="xr-row"><span class="xr-nm" data-pid="${pv.pid}" title="点击展开府域明细">${pv.prov}</span>
      <div class="xr-track"><div class="xr-fill" style="width:${(pv.n/mx*100).toFixed(1)}%;background:linear-gradient(90deg,#4a7a9b,#2f5d70)"></div></div>
      <span class="xr-val">${pv.n} 锚 · ${pv.trips} 篇 · ${pv.y0}${pv.y1>pv.y0?"–"+pv.y1:""}</span></div>
    <div class="xrfus" data-for="${pv.pid}" style="display:none">${pv.fus.map(f => `
      <div class="xr-fu">
        <span class="xr-funm" data-pid="${pv.pid}" data-fu="${f.fu}" title="入本站 ${f.fu} 详情">${f.fu}</span>
        <span class="xr-meta"> · ${f.n} 锚 · ${f.y0}${f.y1>f.y0?"–"+f.y1:""} 年游经</span>
        <span style="margin-left:6px">${f.visits.map(v =>
          `<a class="xr-link" href="${esc("../XXK/#trip="+v.id+"&d="+v.d)}" target="_blank" rel="noopener" title="${v.date} · 循程而读直达当日">↗${v.t.replace(/日记$/,"")}</a>`).join(" ")}</span>
        ${(f.ex || []).map(e => `
          <div class="xr-ex"><span class="xr-ext">《${e.t}》·${e.name}</span>　…${e.ctx}…
            <a class="xr-link" href="${esc(e.href)}" target="_blank" rel="noopener">↗ 循程而读</a></div>`).join("")}
      </div>`).join("")}
    </div>`).join("");
  return `
    <div class="xr-title">霞客行踪 · 到访府域分布</div>
    ${provRows}
    <div class="xr-note">徐霞客足迹按<b>明末行政</b>归位——凡 ${xk.total} 锚，${xk.matched} 锚落于方舆府县（余 ${xk.unmatched} 锚多山寺岩潭，本无府县对应），计 ${xk.provsHit} 省 ${xk.fusHit} 府，游踪 ${y0}–${y1} 年。
    霞客之游与祖禹之作同处明清之际——一以足迹证山河，一以笔墨论形胜。
    点省名展开府域明细；点府名入本站府详情；↗ 篇名赴姊妹站<b>霞客经纬</b>循程而读当日。</div>`;
}

/* ── 寰宇子页：每府 → 宋对应分档徽标 + 治所沿革对读 ── */
function xrRenderHy(d){
  const hy = d.hy, s = hy.song, m = hy.ming;
  const esc = h => h.replace(/&/g, "&amp;");
  const legend = Object.keys(XR_REL).map(k =>
    xrBadge(k)).join(" ");
  const mx = hy.byProv.length ? hy.byProv[0].fus.length : 1;
  const provRows = hy.byProv.map(pv => `
    <div class="xr-row"><span class="xr-nm" data-pid="${pv.pid}" title="点击入舆图观其省域">${pv.prov}</span>
      <div class="xr-track"><div class="xr-fill" style="width:${(pv.fus.length/mx*100).toFixed(1)}%;background:linear-gradient(90deg,#a0522d,#b23a2e)"></div></div>
      <span class="xr-val">有宋源 ${pv.fus.length} · 无 ${pv.none.length}</span></div>
    <div class="xrfus" data-for="${pv.pid}" style="display:none">
      ${pv.fus.map(f => `
      <div class="xr-fu">
        <span class="xr-funm" data-pid="${pv.pid}" data-fu="${f.fu}" title="入本站 ${f.fu} 详情">${f.fu}</span>
        ${xrBadge(f.rel)}
        <span class="xr-meta">宋源 ${f.songs.length} 条 · 五百年对读 ▾</span>
        <div class="xr-songlist" data-fu="${f.fu}" style="display:none">
          ${f.songs.map(g => `
          <div style="margin:3px 0 0 2px">
            <a class="xr-link" href="${esc(g.href)}" target="_blank" rel="noopener" title="${g.ev}">↗ ${g.z}</a>
            <span class="xr-badge" style="background:${XR_REL[g.rel][1]};border-color:${XR_REL[g.rel][2]};color:${XR_REL[g.rel][3]}">${XR_REL[g.rel][0]}</span>
            <span class="xr-meta">${g.ev}</span>
            <div class="xr-dui">
              <div class="song"><span class="xr-src">宋 · 太平寰宇记</span>${g.yz ? g.yz + "……" : "（是州沿革未载）"}</div>
              <div class="ming"><span class="xr-src">明 · 读史方舆纪要</span>${f.yan ? f.yan + "……" : "（是府沿革未载）"}</div>
            </div>
          </div>`).join("")}
        </div>
      </div>`).join("")}
      ${pv.none.length ? `
      <div class="xr-none xr-nonechips">
        <span class="xr-meta">明置而宋书无征（${pv.none.length}）：</span>
        ${pv.none.map(nm => `<span class="xr-chip">${nm}</span>`).join("")}
      </div>` : ""}
    </div>`).join("");
  return `
    <div class="xr-title">寰宇溯源 · 宋明对应分档</div>
    <div style="margin:2px 0 6px">${legend}<span class="xr-meta" style="margin-left:6px">宋 ${s.song_zhou} 州 · 得对 ${s.matched} · 无对 ${s.none}；明 ${m.fu} 府 · 有宋源 ${m.hit} · 无 ${m.miss}</span></div>
    ${provRows}
    <div class="xr-note">乐史《太平寰宇记》记宋初 ${s.song_zhou} 府州，去顾祖禹著书又六百年。
    姊妹站<b>寰宇经纬</b>以同名/升府/改名/明属州四档实证衔接、坐标近邻存疑、无对应如实存阙；本页自方舆（明府）视角入站重组。
    点省名展开府域明细；点府行展开宋明治所沿革对读；↗ 宋州名赴姊妹站直达其州卡。</div>`;
}

function xrRender(d){
  const isXk = _xrevSub === "xk";
  pbody.innerHTML = `
  <style>${XR_STYLE}</style>
  <div class="p-kicker">读史方舆纪要 · 站际互查</div>
  <div class="tabbar">
    <button class="tb ${isXk?"on":""}" data-s="xk">霞客 ${isXk?d.xk.total:""}</button>
    <button class="tb ${!isXk?"on":""}" data-s="hy">寰宇 ${!isXk?d.hy.song.song_zhou:""}</button>
  </div>
  ${isXk ? xrRenderXk(d) : xrRenderHy(d)}
  <div class="readrow" style="margin-top:14px;display:flex;gap:8px">
    <button class="readfull" id="xrBack">⟨ 返回舆图</button>
  </div>`;
  pbody.querySelectorAll(".tb").forEach(b => b.onclick = () => { _xrevSub = b.dataset.s; xrRender(d); });
  pbody.querySelectorAll(".xr-funm").forEach(el => el.onclick = ev => {
    ev.stopPropagation();
    xrGoFu(el.dataset.pid, el.dataset.fu);
  });
  /* 省名点击 → 展开/收起府列表（面板内明细；入舆图走府名/省晕） */
  pbody.querySelectorAll(".xr-row .xr-nm[data-pid]").forEach(el => el.onclick = () => {
    const box = pbody.querySelector(`.xrfus[data-for="${el.dataset.pid}"]`);
    if (box) box.style.display = box.style.display === "none" ? "block" : "none";
  });
  /* 府行点击 → 展开/收起明细（霞客样例常显，寰宇对读展开）；链接点击不触发 */
  pbody.querySelectorAll(".xr-fu").forEach(el => el.onclick = ev => {
    if (ev.target.closest("a")) return;
    const list = el.querySelector(".xr-songlist");
    if (list) list.style.display = list.style.display === "none" ? "block" : "none";
  });
  document.getElementById("xrBack").onclick = () => { xrReset(); openIntro(); };
}

function openXrev(sub){
  if (sub) _xrevSub = sub;
  vset("经纬互查", "桥");
  vseal.textContent = "互查";
  document.body.classList.remove("nopanel");
  panel.classList.add("open");
  panel.style.width = "min(720px, calc(100vw - 20px))";
  panel.style.top = "76px";
  panel.style.bottom = "52px";
  pbody.innerHTML = `
  <style>${XR_STYLE}</style>
  <div class="p-kicker">读史方舆纪要 · 站际互查</div>
  <div class="wx-prog" style="font-size:12px;letter-spacing:2px;color:var(--ink-faint);padding:6px 0;font-family:KaiTi,serif">正在载入互查数据…</div>`;
  xrevLoad(() => {
    if (!window.FY_XREV){
      pbody.innerHTML = `<div class="xr-note">互查数据未载入（离线首访）——联网后重开互查即可。</div>`;
      return;
    }
    xrRender(window.FY_XREV);
  });
}
