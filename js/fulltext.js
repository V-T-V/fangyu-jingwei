/* ═══════════ 方舆经纬 · 全书全文检索 ═══════════
   输入任意词句 → 按需加载 data/text/*.js（17 文件）→ 扫描全部原文
   → 结果片段列表 → 点击直达原文命中段落。 */

const FT_KEYS = [
  ...FY.provinces.map(p=>p.id), "juanshou", "xingshi", "chuandu"
];

/* 并行加载全部文本（带进度回调），全部就绪后 cb()
   —— 浏览器并发取 18 文件，比逐个串行快数倍；loadTextFile 自带去重队列 */
function ensureTextAll(onProg, cb){
  const total = FT_KEYS.length;
  let done = 0;
  if (!total) { cb(); return; }
  FT_KEYS.forEach(key=>{
    const fin = ()=>{
      if (done >= total) return;            /* 防御重复回调（进度超计） */
      done++;
      onProg && onProg(key, done, total);
      if (done === total) cb();
    };
    if (FYTEXT[key]) { fin(); return; }
    loadTextFile(key, fin);      // onload/onerror 都会回调
  });
}

/* ── 检索 Worker：扫描移出主线程（file:// 或不可用时自动回退主线程） ── */
let _ftw = null, _ftwReady = false, _ftwFailed = false;
window.__ftwUsed = false;
function ftWorkerReady(){
  if (_ftwReady) return Promise.resolve(true);
  if (_ftwFailed) return Promise.resolve(false);
  /* 无头自动化（虚拟时钟与 worker 网络加载不相容，会冻结 dump）→ 直接走主线程
     __FY_NO_WORKER__：测试页显式声明；navigator.webdriver：CDP 驱动场景 */
  if (window.__FY_NO_WORKER__ || navigator.webdriver){ _ftwFailed = true; return Promise.resolve(false); }
  return new Promise(res => {
    try{
      _ftw = new Worker("js/ftworker.js");
      /* 6s 未就绪即回退主线程（SW/HTTP 缓存已暖，现实 <2s；虚拟时钟不等 worker 网络） */
      const okTimer = setTimeout(() => { if (!_ftwReady){ _ftwFailed = true; res(false); } }, 6000);
      _ftw.onmessage = e => {
        const m = e.data || {};
        if (m.ready){ _ftwReady = true; clearTimeout(okTimer); res(true); }
        else if (m.type === "wenxin" && _ftw._wxHandler){
          const h = _ftw._wxHandler; _ftw._wxHandler = null; h(m.cache);
        }
        else if (m.type === "rows" && _ftw._handler){
          const h = _ftw._handler; _ftw._handler = null; h(m.rows);
        }
        else if (m.error){
          _ftwFailed = true; clearTimeout(okTimer); res(false);
          /* 错误也要唤醒挂起回调，让上层走回退而非永等 */
          if (_ftw._wxHandler){ const h = _ftw._wxHandler; _ftw._wxHandler = null; h(null); }
          if (_ftw._handler){ const h = _ftw._handler; _ftw._handler = null; h(null); }
        }
      };
      _ftw.onerror = () => { _ftwFailed = true; clearTimeout(okTimer); res(false); };
      _ftw.postMessage({
        init: true,
        keys: FT_KEYS,
        meta: {
          keys: FT_KEYS,
          provNames: FY.provinces.reduce((o, p) => (o[p.id] = p.name, o), {}),
          fus: FY.provinces.reduce((a, p) => a.concat(p.fu.map(u => ({ n: u.n, prov: p.name, pid: p.id }))), []),
          xsTitles: FY.xingshi.map(x => x.title.replace(/　/g, "")),
          cdTitles: FY.chuandu.map(x => x.title.replace(/　/g, " · ")),
        }
      });
    }catch(e){ _ftwFailed = true; res(false); }
  });
}
function ftWorkerSearch(q, cb){
  if (!_ftwReady){ cb(null); return; }
  _ftw._handler = rows => { window.__ftwUsed = true; cb(rows); };
  _ftw.postMessage({ q });
}

/* 进度挂接（闭包安全）：外部（文心等）经此设置/清除 worker 装载进度回调 */
function ftWorkerProgress(cb){ if (_ftw) _ftw._prog = cb; }
function ftWorkerProgressClear(){ if (_ftw) _ftw._prog = null; }

function ftWorkerWenxin(cb){
  if (!_ftwReady){ cb(null); return; }
  _ftw._wxHandler = cache => cb(cache);
  _ftw.postMessage({ wenxin: true });
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
  /* q 保持原样用于文本检索；HTML 模板处才转义（不污染查询词） */
  const escQ = q.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  sres.innerHTML = `<div class="ftprog">正在加载全书原文…</div>`;
  const keepOpen = ()=>sres.classList.add("open");
  const render = results => {
      if (!results.length){
        sres.innerHTML = `<div class="none">全书原文未见「${escQ}」</div>`;
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
      `<div class="fthead">全书「${escQ}」 — ${total} 处 / ${results.length} 篇</div>` +
      rows +
      (results.length>30?`<div class="fttail">已列前 30 篇 · 共 ${results.length} 篇命中</div>`:"");
      sres.querySelectorAll(".ftr").forEach(el=>el.onclick=()=>{
        sres.classList.remove("open");
        ftJump(results[+el.dataset.i], q);
      });
    };
  /* 深度优化：Worker 自行装载并逐文件报进度——主线程零解析（8.2MB 全下后台）；
     Worker 不可用/超时 → 回退主线程 ensureTextAll + ftSearch（file:// 等场景） */
  if (window.__FY_NO_WORKER__){
    ensureTextAll((key, i, total)=>{
      const name = (FY.provinces.find(p=>p.id===key)||{name:key}).name || (key==="xingshi"?"历代州域形势":"川渎");
      keepOpen();
      sres.innerHTML = `<div class="ftprog">检索中 · ${name}（${i+1}/${total}）</div>`;
    }, ()=>{
      ftWorkerReady().then(() => {
        ftWorkerSearch(q, rows => render(rows || ftSearch(q)));
      });
    });
    return;
  }
  ftWorkerReady().then(ok => {
    if (!ok){
      ensureTextAll((key, i, total)=>{
        const name = (FY.provinces.find(p=>p.id===key)||{name:key}).name || (key==="xingshi"?"历代州域形势":"川渎");
        keepOpen();
        sres.innerHTML = `<div class="ftprog">检索中 · ${name}（${i+1}/${total}）</div>`;
      }, ()=> render(ftSearch(q)));
      return;
    }
    _ftw._prog = (i, total) => {
      keepOpen();
      sres.innerHTML = `<div class="ftprog">后台装载全书 · ${i}/${total}（主线程空闲）</div>`;
    };
    ftWorkerSearch(q, rows => {
      _ftw._prog = null;
      render(rows || ftSearch(q));
    });
  });
}
