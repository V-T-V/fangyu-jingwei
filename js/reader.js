/* ═══════════ 方舆经纬 · 原卷全文（懒加载 data/text/*.js） ═══════════
   首屏不载全文；点「阅原卷」时按省/专题注入 <script>，
   单省 200KB~1MB，本地读取即时。 */

const FYTEXT = window.FYTEXT || (window.FYTEXT = {});
const __textQueue = {};

function loadTextFile(key, cb){
  if (FYTEXT[key]) { cb(true); return; }
  if (__textQueue[key]) { __textQueue[key].push(cb); return; }
  __textQueue[key] = [cb];
  const s = document.createElement("script");
  s.src = "data/text/" + key + ".js";
  s.onload = ()=>{ const q=__textQueue[key]; delete __textQueue[key]; q.forEach(f=>f(true)); };
  s.onerror = ()=>{ const q=__textQueue[key]; delete __textQueue[key]; q.forEach(f=>f(false)); };
  document.head.appendChild(s);
}

/* 名字归一：军民府/御夷府/州府 等书写差异统一，两侧同函数比较 */
function normFu(n){
  return n.replace(/军民|御夷/g, "").replace(/州府/g, "府").replace(/[府州卫]$/, "");
}
function fuText(pid, name){
  const bag = FYTEXT[pid];
  if (!bag || !bag.fu) return null;
  if (bag.fu[name]) return bag.fu[name];
  const target = normFu(name);
  for (const k in bag.fu) if (normFu(k) === target) return bag.fu[k];
  return null;
}

/* ── 原文视图 ── */
const BADSENT = /[A-Za-z\uff21-\uff3a\uff41-\uff5a\uff66-\uff9f\u3040-\u30ff□]/;
function escT(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* 交叉链接索引：府/属州/县名 → 可跳转目标（同省条目优先）
   府与属州另收裸名变体（荆州→荆州府）；县名须全称，免歧义 */
const XL = (()=>{ const m = new Map();
  const add = (n,tgt)=>{ if(n && n.length>1){ if(!m.has(n)) m.set(n,[]); m.get(n).push(tgt); } };
  FY.provinces.forEach(p=>p.fu.forEach(u=>{
    const tgt = {pid:p.id, fu:u.n};
    add(u.n, tgt);
    const bare = u.n.replace(/[府州]$/, "");
    if (bare !== u.n && bare.length >= 2) add(bare, tgt);
    u.zhou.forEach(z=>{ add(z, tgt);
      const zb = z.replace(/州$/, "");
      if (zb !== z && zb.length >= 2) add(zb, tgt); });
    u.xian.forEach(x=>add(x.replace(/〔.*?〕/g,""), tgt));
  }));
  return m;
})();
const XL_RE = new RegExp(
  "(" + [...XL.keys()].sort((a,b)=>b.length-a.length).join("|") + ")", "g");

function linkify(html, ctxPid){
  return html.replace(XL_RE, m=>{
    const list = XL.get(m);
    const pick = (list.find(x=>x.pid===ctxPid) || list[0]);
    return "<a class='xl' data-pid='"+pick.pid+"' data-fu='"+pick.fu+"'>"+m+"</a>";
  });
}
function paraHtml(p, ctxPid){
  // 句级损坏标注：源站 GB2312 缺字句淡显虚线；
  // 句内外来字符（拉丁/假名）按校勘惯例以 □ 缺字符代之
  const sents = p.split(/(?<=[。；：])/);
  return sents.map(s=>{
    const isBad = BADSENT.test(s);
    if(isBad) s = s.replace(/[A-Za-z\uff21-\uff3a\uff41-\uff5a\uff66-\uff9f\u3040-\u30ff]+/g, "□").replace(/□+/g, "□");
    let t = escT(s).replace(/【([^】]{1,10})】/g, "<span class='tk'>〔$1〕</span>");
    if(ctxPid) t = linkify(t, ctxPid);
    t = t.replace(/□/g, "<span class='qchar'>□</span>");
    return isBad ? "<span class='bad'>"+t+"</span>" : t;
  }).join("");
}
/* 阅读字号（会话级记忆） */
let tfs = 14.5;
/* 定位词：命中处常驻标记并居中滚动（跨标签时退化为段落定位） */
function jumpInText(q){
  if (!q) return;
  const eq = escT(q);
  for (const tp of pbody.querySelectorAll(".tp")){
    if (!tp.textContent.includes(q)) continue;
    const i = tp.innerHTML.indexOf(eq);
    if (i >= 0){
      tp.innerHTML = tp.innerHTML.slice(0,i) + "<span class='hitmark'>"+eq+"</span>" + tp.innerHTML.slice(i+eq.length);
      tp.querySelector(".hitmark").scrollIntoView({behavior:"smooth", block:"center"});
    } else {
      tp.scrollIntoView({behavior:"smooth", block:"start"});
    }
    return;
  }
}
function renderText(title, kicker, raw, backFn, ctxPid, toc){
  const short = title.length > 5 ? title.slice(0, 5) : title;
  vset(short, "原卷");
  const paras = raw.split(/\n+/).map(p=>p.trim()).filter(Boolean);
  const body = paras.map(p => "<p class='tp'>" + paraHtml(p, ctxPid) + "</p>").join("");
  const tocHtml = (toc && toc.length)
    ? `<div class="tocrow"><span class="tocap">卷内跳转</span>${toc.map(n=>
        `<span class="chip small tocz" data-n="${n}">${n.replace(/县$/,"")}</span>`).join("")}</div>` : "";
  pbody.innerHTML = `
    <div class="p-kicker">${kicker}</div>
    <button class="tback" id="tback">⟨ 返回详情</button>
    <div class="tmeta">《${title}》全篇 · ${raw.length.toLocaleString()} 字
      <span class="tbtns"><button class="tfsb" data-d="-1" title="缩小">A−</button><button class="tfsb" data-d="1" title="放大">A+</button><button class="tfsb" id="tdl" title="存为文本">⤓ 文本</button></span>
      <span class="tlegend">淡显句为源本编码损坏 · 地名可点</span></div>
    ${tocHtml}
    <div class="twrap" style="font-size:${tfs}px">${body}</div>`;
  document.getElementById("tback").onclick = backFn;
  document.getElementById("tdl").onclick = ()=>{
    const blob = new Blob([raw], {type:"text/plain;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = title + ".txt";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
  };
  pbody.querySelectorAll(".tfsb[data-d]").forEach(b=>b.onclick=()=>{
    tfs = Math.min(20, Math.max(11.5, tfs + (+b.dataset.d)*1.5));
    pbody.querySelector(".twrap").style.fontSize = tfs + "px";
  });
  // 卷内跳转：滚动到该州县首次出现的段落并闪烁
  pbody.querySelectorAll(".tocz").forEach(z=>z.onclick=()=>{
    const name = z.dataset.n;
    const tp = Array.from(pbody.querySelectorAll(".tp")).find(p=>p.textContent.includes(name));
    if(!tp) return;
    tp.scrollIntoView({behavior:"smooth", block:"start"});
    tp.classList.add("flash");
    setTimeout(()=>tp.classList.remove("flash"), 1600);
  });
  pbody.scrollTop = 0;
  showPanel();
  if (renderText._q) { const q = renderText._q; renderText._q = null; setTimeout(()=>jumpInText(q), 120); }
}

function textFallback(title, backFn, note){
  vset(title.length>5?title.slice(0,5):title, "原卷");
  pbody.innerHTML = `
    <div class="p-kicker">原卷全文</div>
    <button class="tback" id="tback">⟨ 返回详情</button>
    <div class="hint" style="margin-top:10px">${note||"此条原卷全文未收，详见所属府州叙事。"}</div>`;
  document.getElementById("tback").onclick = backFn;
  showPanel();
}

/* 府全文 */
function openFuText(p, u, q){
  renderText._q = q || null;
  BM.setLast({kind:"fu", pid:p.id, fu:u.n});
  const back = ()=>openFu(p,u);
  loadTextFile(p.id, ok=>{
    const t = ok ? fuText(p.id, u.n) : null;
    if (t) renderText(u.n, p.name+"方舆纪要 · "+p.vols.join("、"), t, back, p.id,
      [...new Set([u.fg, ...u.zhou, ...u.xian].filter(Boolean).map(x=>x.replace(/〔.*?〕/g,"")))]);
    else textFallback(u.n, back, "原卷未见此府独立成篇（土州羁縻附见于统辖府叙事），所示为摘录。");
  });
}
/* 省序全文 */
function openXuText(p, q){
  renderText._q = q || null;
  const back = ()=>openProv(p);
  loadTextFile(p.id, ok=>{
    const t = ok && FYTEXT[p.id] && FYTEXT[p.id].xu;
    if (t) renderText(p.name+"方舆纪要序", "读史方舆纪要 · "+p.name, t, back, p.id);
    else textFallback(p.name+"序", back);
  });
}
/* 形势卷全文 */
function openEraText(ei, q){
  renderText._q = q || null;
  BM.setLast({kind:"era", i:ei});
  const back = ()=>openEra(ei);
  const meta = FY.xingshi[ei].title.replace(/\u3000/g," · ");
  loadTextFile("xingshi", ok=>{
    const t = ok && FYTEXT.xingshi && FYTEXT.xingshi[ei];
    if (t) renderText(ERAS[ei].label+"纪", meta, t, back);
    else textFallback(ERAS[ei].label, back);
  });
}
/* 川渎卷全文 */
function openRiverText(r, q){
  renderText._q = q || null;
  const ci = FY.chuandu.findIndex(c=>c.title.includes(r.key));
  BM.setLast({kind:"cd", i:Math.max(ci,0)});
  const back = ()=>openRiver(r);
  const i = FY.chuandu.findIndex(c=>c.title.includes(r.key));
  const meta = i>=0 ? FY.chuandu[i].title.replace(/\u3000/g," · ") : r.key;
  loadTextFile("chuandu", ok=>{
    const t = ok && FYTEXT.chuandu && FYTEXT.chuandu[i>=0?i:0];
    if (t) renderText(r.key, meta, t, back);
    else textFallback(r.key, back);
  });
}

/* 原文地名链接：点击 → 舆图模式定位该府 */
pbody.addEventListener("click", e=>{
  const a = e.target.closest(".xl");
  if(!a) return;
  const p = FY.provinces.find(x=>x.id===a.dataset.pid);
  if(!p) return;
  const u = p.fu.find(x=>x.n===a.dataset.fu);
  if(!u) return;
  if(mode!=="舆图") setMode("舆图");
  selectProv(p.id);
  openFu(p,u);
});

/* 卷首文献（叙/总叙/凡例） */
function openJuanshou(i, q){
  renderText._q = q || null;
  BM.setLast({kind:"js", i});
  const back = ()=>openIntro();
  loadTextFile("juanshou", ok=>{
    const it = ok && FYTEXT.juanshou && FYTEXT.juanshou[i];
    if (it && it.x) renderText(it.t, "读史方舆纪要 · 卷首", it.x, back);
    else textFallback("卷首", back);
  });
}
