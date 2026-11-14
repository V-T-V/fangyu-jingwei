/* ═══════════ 方舆经纬 · 全文检索 Worker ═══════════
   自持 FYTEXT 副本（importScripts 复用 HTTP/SW 缓存），扫描不占主线程。
   协议：{init,keys,meta} → {ready} ；{q} → {type:"rows",rows}
   计数/片段算法与 js/fulltext.js 保持一致（改动须两处同步）。 */

var FYTEXT = {};

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


/* ── 文心计量（与 js/wenxin.js 口径逐行一致；改动须两处同步） ── */
var WX_VOCAB = ["形胜","险要","要害","咽喉","锁钥","门户","屏蔽","冲要",
                "守御","屯戍","关隘","堡寨","烽堠","营垒","倭寇","盗贼"];
function wenxinCompute(){
  var provChars = [], provText = {}, extraChars = 0;
  (META.keys || []).forEach(function(pid){
    var bag = FYTEXT[pid];
    if (!bag) return;
    var parts = [];
    if (bag.xu) parts.push(bag.xu);
    for (var nm in (bag.fu || {})) parts.push(bag.fu[nm]);
    var txt = parts.join("");
    provText[pid] = txt;
    provChars.push({ prov: (META.provNames || {})[pid] || pid, pid: pid, chars: txt.length });
  });
  ["juanshou","xingshi","chuandu"].forEach(function(k){
    var v = FYTEXT[k];
    if (Array.isArray(v)) v.forEach(function(it){ extraChars += (typeof it === "string" ? it : it.x || "").length; });
  });
  provChars.sort(function(a,b){ return b.chars - a.chars; });
  var totalChars = provChars.reduce(function(s,x){ return s + x.chars; }, 0);

  var vocab = {};
  WX_VOCAB.forEach(function(wd){
    vocab[wd] = (META.keys || []).map(function(pid){
      var n = countHits(provText[pid] || "", wd);
      var ch = provChars.filter(function(x){ return x.pid === pid; })[0];
      ch = ch ? ch.chars : 0;
      return { prov: (META.provNames || {})[pid] || pid, pid: pid, n: n, dens: ch ? n*10000/ch : 0 };
    }).sort(function(a,b){ return b.n - a.n; });
  });

  var allParts = (META.keys || []).map(function(pid){ return provText[pid] || ""; });
  ["juanshou","xingshi","chuandu"].forEach(function(k){
    var v = FYTEXT[k];
    if (Array.isArray(v)) v.forEach(function(it){ allParts.push(typeof it === "string" ? it : it.x || ""); });
  });
  var bigText = allParts.join("");

  var LB = String.fromCharCode(0x300a), RB = String.fromCharCode(0x300b);
  var bkRe = new RegExp("[" + LB + "]([^" + LB + RB + "]{2,8})[" + RB + "]", "g");
  var bkCnt = {}, bmm;
  while ((bmm = bkRe.exec(bigText)) !== null) bkCnt[bmm[1]] = (bkCnt[bmm[1]] || 0) + 1;
  var bookTop = Object.keys(bkCnt).map(function(k){ return [k, bkCnt[k]]; })
                  .sort(function(a,b){ return b[1] - a[1]; }).slice(0, 12);

  var WX_VERBS = ["攻","围","拔","陷","克","破","守","据","降","战","败","屠","焚","掠"];
  var verbRows = provChars.map(function(x){
    var txt = provText[x.pid] || "";
    var total = WX_VERBS.reduce(function(s2, v){ return s2 + txt.split(v).length - 1; }, 0);
    return { prov: x.prov, d: +(total * 10000 / x.chars).toFixed(1) };
  }).sort(function(a, b){ return b.d - a.d; });
  var verbTop = verbRows.slice(0, 6);

  var WX_RIVERS = ["黄河","大河","大江","长江","运河","汉水","江水","漳水","滹沱","淮水"];
  var WX_MOUNTS = ["太行","荆山","阴山","恒山","陇山","剑门"];
  var shanheTop = []
    .concat(WX_RIVERS.map(function(r){ return ["水·" + r, countHits(bigText, r)]; }))
    .concat(WX_MOUNTS.map(function(m){ return ["山·" + m, countHits(bigText, m)]; }))
    .sort(function(a, b){ return b[1] - a[1]; }).slice(0, 8);

  var CJK0 = String.fromCharCode(0x4e00), CJK1 = String.fromCharCode(0x9fff);
  var txRe = new RegExp("天下之([" + CJK0 + "-" + CJK1 + "]{1,3})", "g");
  var txCnt = {}, txm;
  while ((txm = txRe.exec(bigText)) !== null) txCnt[txm[1]] = (txCnt[txm[1]] || 0) + 1;
  var tianxiaTop = Object.keys(txCnt).map(function(k){ return [k, txCnt[k]]; })
                    .sort(function(a,b){ return b[1] - a[1]; }).slice(0, 8);

  var names = [], seen = {};
  var provNms = {};
  Object.keys(META.provNames || {}).forEach(function(k){ provNms[META.provNames[k]] = 1; });
  var fus = META.fus || [];
  fus.forEach(function(one){
    var term = one.n.replace(/(军民府|军民卫|州府|府|州|卫)$/, "");
    if (term.length < 2 || provNms[term]) term = one.n;
    if (seen[term]) return;
    seen[term] = 1;
    names.push({ bare: term, fu: one.n, prov: one.prov, pid: one.pid });
  });
  var fuAll = names.map(function(x){
    return { bare: x.bare, fu: x.fu, prov: x.prov, pid: x.pid, n: countHits(bigText, x.bare) };
  }).sort(function(a,b){ return b.n - a.n; });

  return { provChars: provChars, extraChars: extraChars, totalChars: totalChars,
           vocab: vocab, fuAll: fuAll, bookTop: bookTop, tianxiaTop: tianxiaTop, shanheTop: shanheTop, verbTop: verbTop };
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
