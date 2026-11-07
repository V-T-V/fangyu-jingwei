/* ═══════════ 方舆经纬 · 全书全文检索 ═══════════
   输入任意词句 → 按需加载 data/text/*.js（17 文件）→ 扫描全部原文
   → 结果片段列表 → 点击直达原文命中段落。 */

const FT_KEYS = [
  ...FY.provinces.map(p=>p.id), "juanshou", "xingshi", "chuandu"
];

/* 逐个加载文本文件（带进度回调），全部就绪后 cb() */
function ensureTextAll(onProg, cb){
  let i = 0;
  const next = ()=>{
    if (i >= FT_KEYS.length) { cb(); return; }
    const key = FT_KEYS[i];
    if (FYTEXT[key]) { i++; next(); return; }
    onProg && onProg(key, i, FT_KEYS.length);
    loadTextFile(key, ()=>{ i++; next(); });
  };
  next();
}

/* 转义 + 片段：命中处前后各 18 字 */
function ftSnippet(text, q){
  const i = text.indexOf(q);
  if (i < 0) return null;
  const a = Math.max(0, i - 18), b = Math.min(text.length, i + q.length + 18);
  const seg = text.slice(a, b).replace(/\s+/g, "")
    .replace(/�/g, "□").replace(/□+/g, "□");
  const esc = s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
                  .replace(/□/g, "<span class='qq'>□</span>");
  return (a>0?"…":"") + esc(seg.slice(0, seg.indexOf(q))) +
         "<b>" + esc(q).replace(/<span class='qq'>□<\/span>/g, "□") + "</b>" +
         esc(seg.slice(seg.indexOf(q)+q.length)) + (b<text.length?"…":"");
}
function countHits(text, q){
  let n = 0, i = text.indexOf(q);
  while (i >= 0) { n++; i = text.indexOf(q, i + q.length); }
  return n;
}

/* 扫全部已加载文本 → 结果数组 */
function ftSearch(q){
  const out = [];
  const push = (title, ctx, text, jump)=>{
    const n = countHits(text, q);
    if (!n) return;
    const snip = ftSnippet(text, q);
    out.push({title, ctx, n, snip, jump});
  };
  FY.provinces.forEach(p=>{
    const bag = FYTEXT[p.id];
    if (!bag) return;
    push(p.name+"方舆纪要序", p.name, bag.xu||"", {t:"xu", pid:p.id});
    for (const name in bag.fu){
      push(name, p.name, bag.fu[name], {t:"fu", pid:p.id, fu:name});
    }
  });
  if (FYTEXT.juanshou) FYTEXT.juanshou.forEach((it,i)=>{
    push(it.t, "卷首", it.x, {t:"js", i});
  });
  if (FYTEXT.xingshi) FYTEXT.xingshi.forEach((txt,i)=>{
    push(FY.xingshi[i].title.replace(/\u3000/g,""), "历代州域形势", txt, {t:"era", i});
  });
  if (FYTEXT.chuandu) FYTEXT.chuandu.forEach((txt,i)=>{
    push(FY.chuandu[i].title.replace(/\u3000/g," · "), "川渎", txt, {t:"cd", i});
  });
  out.sort((a,b)=>b.n-a.n);
  return out;
}

/* 跳转到命中处 */
function ftJump(r, q){
  if (r.jump.t === "fu"){
    const p = FY.provinces.find(x=>x.id===r.jump.pid);
    const name = r.jump.fu;
    const u = p.fu.find(x=>x.n===name) ||
              p.fu.find(x=>x.n.replace(/军民/g,"")===name.replace(/军民/g,""));
    if (u){ setMode("舆图"); selectProv(p.id); openFuText(p, u, q); }
  } else if (r.jump.t === "xu"){
    const p = FY.provinces.find(x=>x.id===r.jump.pid);
    setMode("舆图"); selectProv(p.id); openXuText(p, q);
  } else if (r.jump.t === "js"){
    openJuanshou(r.jump.i, q);
  } else if (r.jump.t === "era"){
    setMode("形势"); buildEra(r.jump.i); openEra(r.jump.i); highlightRail("形势", r.jump.i);
    openEraText(r.jump.i, q);
  } else if (r.jump.t === "cd"){
    const c = FY.chuandu[r.jump.i];
    const river = RIVERS.find(x=>c.title.includes(x.key)) || RIVERS[0];
    setMode("川渎"); openRiver(river); highlightRail("川渎", river.key);
    openRiverText(river, q);
  }
}

/* 触发入口：由检索框结果底部「在原书中检索」调用 */
function ftRun(q){
  const sres = document.getElementById("sresults");
  sres.classList.add("open");
  sres.innerHTML = `<div class="ftprog">正在加载全书原文…</div>`;
  const keepOpen = ()=>sres.classList.add("open");
  ensureTextAll((key, i, total)=>{
    const name = (FY.provinces.find(p=>p.id===key)||{name:key}).name || (key==="xingshi"?"历代州域形势":"川渎");
    keepOpen();
    sres.innerHTML = `<div class="ftprog">检索中 · ${name}（${i+1}/${total}）</div>`;
  }, ()=>{
    const results = ftSearch(q);
    if (!results.length){
      sres.innerHTML = `<div class="none">全书原文未见「${q}」</div>`;
      return;
    }
    keepOpen();
    const total = results.reduce((s,r)=>s+r.n,0);
    const rows = results.slice(0, 30).map((r,i)=>
      `<div class="sr ftr" data-i="${i}">
        <span class="tag t全">全</span>
        <span style="min-width:0">
          <span style="font-family:KaiTi,serif;font-size:14px;letter-spacing:1px">${r.title}</span>
          <span class="ctx">${r.ctx} · ${r.n} 处</span>
          <div class="ftsnip">${r.snip}</div>
        </span>
      </div>`).join("");
    sres.innerHTML =
      `<div class="fthead">全书「${q}」 — ${total} 处 / ${results.length} 篇</div>` +
      rows +
      (results.length>30?`<div class="fttail">已列前 30 篇 · 共 ${results.length} 篇命中</div>`:"");
    sres.querySelectorAll(".ftr").forEach(el=>el.onclick=()=>{
      sres.classList.remove("open");
      ftJump(results[+el.dataset.i], q);
    });
  });
}
