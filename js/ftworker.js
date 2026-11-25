/* ═══════════ 方舆经纬 · 全文检索 Worker ═══════════
   自持 FYTEXT 副本（importScripts 复用 HTTP/SW 缓存），扫描不占主线程。
   协议：{init,keys,meta} → {ready} ；{q} → {type:"rows",rows}
   计数/片段与文心词表/计量纯核在 js/ft_core.js（与本 Worker 同目录，相对解析即 js/ft_core.js）。 */

importScripts("ft_core.js");

var FYTEXT = {};

var META = null;

function scan(q){
  var out = [];
  var push = function(title, ctx, text, jump){
    var n = countHits(text, q);
    if (!n) return;
    out.push({ title: title, ctx: ctx, n: n, snip: ftSnippet(text, q), jump: jump });
  };
  (META.keys || []).forEach(function(pid){
    var bag = FYTEXT[pid];
    if (!bag) return;
    var pn = (META.provNames || {})[pid] || pid;
    push(pn + "方舆纪要序", pn, bag.xu || "", { t: "xu", pid: pid });
    for (var name in bag.fu) push(name, pn, bag.fu[name], { t: "fu", pid: pid, fu: name });
  });
  if (FYTEXT.juanshou) FYTEXT.juanshou.forEach(function(it, i){
    push(it.t, "卷首", it.x, { t: "js", i: i });
  });
  if (FYTEXT.xingshi) FYTEXT.xingshi.forEach(function(txt, i){
    push((META.xsTitles || [])[i] || "形势", "历代州域形势", txt, { t: "era", i: i });
  });
  if (FYTEXT.chuandu) FYTEXT.chuandu.forEach(function(txt, i){
    push((META.cdTitles || [])[i] || "川渎", "川渎", txt, { t: "cd", i: i });
  });
  out.sort(function(a, b){ return b.n - a.n; });
  return out;
}


/* ── 文心计量：Worker 直算调度（纯核在 js/ft_core.js，与主线程 wxCompute 同口径） ── */
function wenxinCompute(){
  /* 只取省卷：META.keys 另含 juanshou / xingshi / chuandu（其文已由 extraList 计入 extraChars）——
     此前一并入表，这三项没有省名、字数记 0，以原始键名混进「卷帙分布」图（与主线程 wxCompute 口径不一致） */
  var provList = (META.keys || []).filter(function(pid){ return META.provNames && META.provNames[pid]; }).map(function(pid){
    var bag = FYTEXT[pid] || {};
    var parts = [];
    if (bag.xu) parts.push(bag.xu);
    for (var nm in (bag.fu || {})) parts.push(bag.fu[nm]);
    return { pid: pid, prov: (META.provNames || {})[pid] || pid, txt: parts.join("") };
  });
  var extraList = [];
  ["juanshou","xingshi","chuandu"].forEach(function(k){
    var v = FYTEXT[k];
    if (Array.isArray(v)) v.forEach(function(it){ extraList.push(typeof it === "string" ? it : it.x || ""); });
  });
  var corpus = wxCorpus(provList, extraList);
  var st = wxStatic(corpus);
  var names = wxFuNames(META.fus || [], Object.values(META.provNames || {}));
  var fuAll = wxFuAll(corpus.bigText, names);
  var dens = wxDensities(corpus, st.vocab);
  return { provChars: corpus.provChars, extraChars: corpus.extraChars, totalChars: corpus.totalChars,
           vocab: st.vocab, fuAll: fuAll, bookTop: st.bookTop, tianxiaTop: st.tianxiaTop,
           shanheTop: st.shanheTop, verbTop: st.verbTop,
           _verbRows: st.verbRows, _vocabDens: dens.vocabDens, _rivDens: dens.rivDens, _mntDens: dens.mntDens };
}

self.onmessage = function(e){
  var m = e.data || {};
  if (m.init){
    try{
      META = m.meta || {};
      var ks = m.keys || [];
      ks.forEach(function(k, i){
        self.postMessage({ type: "wprog", i: i + 1, total: ks.length });
        importScripts("../data/text/" + k + ".js");
      });
      self.postMessage({ ready: true });
    }catch(err){
      self.postMessage({ error: String(err) });
    }
    return;
  }
  if (m.wenxin){
    try{ self.postMessage({ type: "wenxin", cache: wenxinCompute() }); }
    catch(err){ self.postMessage({ error: String(err) }); }
    return;
  }
  if (m.q != null){
    try{
      self.postMessage({ type: "rows", q: m.q, rows: scan(m.q) });
    }catch(err){
      self.postMessage({ error: String(err) });
    }
  }
};
