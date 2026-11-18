/* ═══════════ 方舆经纬 · 全文/文心公共纯核 ═══════════
   主线程（defer 链 fulltext.js / wenxin.js）与 Worker（ftworker.js 开头
   importScripts("ft_core.js")）共用的纯数据与纯函数。
   约束：本文件禁止任何 document/window 引用——只做无 DOM 的纯计算。
   调度不在此处：wenxin.js wxCompute 主线程 24 名/块让出、ftworker.js
   wenxinCompute Worker 直算，两个调度器各自调用以下纯核。改动只改这一份。 */

/* ── 全文检索：计数与片段（原 fulltext.js / ftworker.js 双拷贝合一） ── */
function countHits(text, q){
  var n = 0, i = text.indexOf(q);
  while (i >= 0){ n++; i = text.indexOf(q, i + q.length); }
  return n;
}
function ftSnippet(text, q){
  var i = text.indexOf(q);
  if (i < 0) return null;
  var a = Math.max(0, i - 18), b = Math.min(text.length, i + q.length + 18);
  var seg = text.slice(a, b).replace(/\s+/g, "")
    .replace(/\uFFFD/g, "\u25A1").replace(/\u25A1+/g, "\u25A1");
  var esc = function(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/\u25A1/g, "<span class='qq'>\u25A1</span>"); };
  return (a > 0 ? "\u2026" : "") + esc(seg.slice(0, seg.indexOf(q))) +
    "<b>" + esc(q).replace(/<span class='qq'>\u25A1<\/span>/g, "\u25A1") + "</b>" +
    esc(seg.slice(seg.indexOf(q) + q.length)) + (b < text.length ? "\u2026" : "");
}

/* ── 文心词表（口径同 paper_stats.js；原 wenxin.js / ftworker.js 双拷贝合一） ── */
var WX_VOCAB = ["形胜","险要","要害","咽喉","锁钥","门户","屏蔽","冲要",
                "守御","屯戍","关隘","堡寨","烽堠","营垒","倭寇","盗贼"];
var WX_VERBS = ["攻","围","拔","陷","克","破","守","据","降","战","败","屠","焚","掠"];
var WX_RIVERS = ["黄河","大河","大江","长江","运河","汉水","江水","漳水","滹沱","淮水"];
var WX_MOUNTS = ["太行","荆山","阴山","恒山","陇山","剑门"];

/* ── 文心计量纯核（输入语料描述，输出指标——无 IO 无 DOM） ── */

/* 语料装订：provList=[{pid,prov,txt}]（省序连缀文本），extraList=卷首/形势/川渎字串数组 */
function wxCorpus(provList, extraList){
  var provText = {}, charsByPid = {};
  var provChars = provList.map(function(x){
    provText[x.pid] = x.txt;
    charsByPid[x.pid] = x.txt.length;
    return { prov: x.prov, pid: x.pid, chars: x.txt.length };
  });
  provChars.sort(function(a,b){ return b.chars - a.chars; });
  var extraChars = 0;
  extraList.forEach(function(s){ extraChars += s.length; });
  var totalChars = provChars.reduce(function(s,x){ return s + x.chars; }, 0);
  var allParts = provList.map(function(x){ return provText[x.pid] || ""; });
  extraList.forEach(function(s){ allParts.push(s); });
  return { provList: provList, provChars: provChars, provText: provText, charsByPid: charsByPid,
           extraChars: extraChars, totalChars: totalChars, bigText: allParts.join("") };
}

/* 静态指标：语汇分省 / 攻守动词 / 山河 / 天下之X / 引书——一次算全 */
function wxStatic(corpus){
  var vocab = {};
  WX_VOCAB.forEach(function(wd){
    vocab[wd] = corpus.provList.map(function(x){
      var n = countHits(corpus.provText[x.pid] || "", wd);
      var ch = corpus.charsByPid[x.pid] || 0;
      return { prov: x.prov, pid: x.pid, n: n, dens: ch ? n * 10000 / ch : 0 };
    }).sort(function(a,b){ return b.n - a.n; });
  });

  var verbRows = corpus.provChars.map(function(x){
    var txt = corpus.provText[x.pid] || "";
    var total = WX_VERBS.reduce(function(s2, v){ return s2 + txt.split(v).length - 1; }, 0);
    return { prov: x.prov, d: +(total * 10000 / x.chars).toFixed(1) };
  }).sort(function(a, b){ return b.d - a.d; });

  var shanheTop = []
    .concat(WX_RIVERS.map(function(r){ return ["水·" + r, countHits(corpus.bigText, r)]; }))
    .concat(WX_MOUNTS.map(function(m){ return ["山·" + m, countHits(corpus.bigText, m)]; }))
    .sort(function(a, b){ return b[1] - a[1]; }).slice(0, 8);

  var CJK0 = String.fromCharCode(0x4e00), CJK1 = String.fromCharCode(0x9fff);
  var txRe = new RegExp("天下之([" + CJK0 + "-" + CJK1 + "]{1,3})", "g");
  var txCnt = {}, txm;
  while ((txm = txRe.exec(corpus.bigText)) !== null) txCnt[txm[1]] = (txCnt[txm[1]] || 0) + 1;
  var tianxiaTop = Object.keys(txCnt).map(function(k){ return [k, txCnt[k]]; })
                    .sort(function(a,b){ return b[1] - a[1]; }).slice(0, 8);

  var LB = String.fromCharCode(0x300a), RB = String.fromCharCode(0x300b);
  var bkRe = new RegExp("[" + LB + "]([^" + LB + RB + "]{2,8})[" + RB + "]", "g");
  var bkCnt = {}, bmm;
  while ((bmm = bkRe.exec(corpus.bigText)) !== null) bkCnt[bmm[1]] = (bkCnt[bmm[1]] || 0) + 1;
  var bookTop = Object.keys(bkCnt).map(function(k){ return [k, bkCnt[k]]; })
                  .sort(function(a,b){ return b[1] - a[1]; }).slice(0, 12);

  return { vocab: vocab, verbRows: verbRows, verbTop: verbRows.slice(0, 6),
           shanheTop: shanheTop, tianxiaTop: tianxiaTop, bookTop: bookTop };
}

/* 府名简目：fus=[{n,prov,pid}]，provNames=省名数组——去尾简名，单字/撞省名回退全名，再去重 */
function wxFuNames(fus, provNames){
  var names = [], seen = {};
  var provNms = {};
  (provNames || []).forEach(function(nm){ provNms[nm] = 1; });
  (fus || []).forEach(function(one){
    var term = one.n.replace(/(军民府|军民卫|州府|府|州|卫)$/, "");
    if (term.length < 2 || provNms[term]) term = one.n;
    if (seen[term]) return;
    seen[term] = 1;
    names.push({ bare: term, fu: one.n, prov: one.prov, pid: one.pid });
  });
  return names;
}

/* 逐府掂量：全书语料数每个简名（Worker 直算一次到位；主线程分块路径逐名调 countHits） */
function wxFuAll(bigText, names){
  return names.map(function(x){
    return { bare: x.bare, fu: x.fu, prov: x.prov, pid: x.pid, n: countHits(bigText, x.bare) };
  }).sort(function(a,b){ return b.n - a.n; });
}

/* 分省密度：语汇累计 / 水名 / 山名（每万字） */
function wxDensities(corpus, vocab){
  var vocabDens = {};
  corpus.provChars.forEach(function(x){ vocabDens[x.pid] = 0; });
  WX_VOCAB.forEach(function(wd){ (vocab[wd] || []).forEach(function(r){ vocabDens[r.pid] += r.dens; }); });
  var rivDens = {}, mntDens = {};
  corpus.provChars.forEach(function(x){
    var txt = corpus.provText[x.pid] || "";
    var rv = 0, mt = 0;
    WX_RIVERS.forEach(function(r){ rv += txt.split(r).length - 1; });
    WX_MOUNTS.forEach(function(m){ mt += txt.split(m).length - 1; });
    rivDens[x.pid] = rv * 10000 / Math.max(1, x.chars);
    mntDens[x.pid] = mt * 10000 / Math.max(1, x.chars);
  });
  return { vocabDens: vocabDens, rivDens: rivDens, mntDens: mntDens };
}
