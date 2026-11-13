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

self.onmessage = function(e){
  var m = e.data || {};
  if (m.init){
    try{
      META = m.meta || {};
      (m.keys || []).forEach(function(k){
        importScripts("../data/text/" + k + ".js");
      });
      self.postMessage({ ready: true });
    }catch(err){
      self.postMessage({ error: String(err) });
    }
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
