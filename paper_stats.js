/* 《方舆经纬》论文数字复核脚本：node paper_stats.js
   输出分省卷帙 / 16 军事语汇密度 / 每词之冠（站点语料口径）。
   ANALYSIS.md §四 一切文本数字之源。 */
const fs = require('fs');
const VOCAB = ['形胜','险要','要害','咽喉','锁钥','门户','屏蔽','冲要','守御','屯戍','关隘','堡寨','烽堠','营垒','倭寇','盗贼'];
const ids = {beizhi:'北直隶',nanzhi:'南直隶',shandong:'山东',shanxi:'山西',henan:'河南',shanxix:'陕西',sichuan:'四川',huguang:'湖广',jiangxi:'江西',zhejiang:'浙江',fujian:'福建',guangdong:'广东',guangxi:'广西',yunnan:'云南',guizhou:'贵州'};
let corpusAll = '';
const provTextById = {};
const out = [];
for (const id of Object.keys(ids)){
  const src = fs.readFileSync('data/text/' + id + '.js', 'utf8');
  const FYTEXT = {};
  const sandbox = { FYTEXT: {} };
  try { (new Function('FYTEXT', src.slice(src.indexOf('FYTEXT') - 0)))(sandbox.FYTEXT); } catch(e) { console.error('eval fail', id, e.message); }
  const bag = sandbox.FYTEXT[id] || {};
  let txt = bag.xu || '';
  for (const k in (bag.fu || {})) txt += bag.fu[k];
  const cnt = {};
  VOCAB.forEach(w => { cnt[w] = txt.split(w).length - 1; });
  const total = VOCAB.reduce((s, w) => s + cnt[w], 0);
  corpusAll += txt;
  provTextById[ids[id]] = txt;
  out.push({ p: ids[id], chars: txt.length, total, d: +(total * 10000 / txt.length).toFixed(2), cnt });
}
out.sort((a, b) => b.chars - a.chars);
console.log('省 | 字数(万) | 16词合计 | 每万字');
out.forEach(r => console.log(`${r.p} | ${(r.chars/10000).toFixed(1)} | ${r.total} | ${r.d}`));

// ── 顾祖禹的书架（《》引书榜）与时代层（连称对）——ANALYSIS §4.4/4.5 之源 ──

const bookCnt = {};
let bm;
const LB = String.fromCharCode(0x300a), RB = String.fromCharCode(0x300b);
const BOOKS_RE = new RegExp('[' + LB + ']([^' + LB + RB + ']{2,8})[' + RB + ']', 'g');
while ((bm = BOOKS_RE.exec(corpusAll)) !== null) bookCnt[bm[1]] = (bookCnt[bm[1]] || 0) + 1;
const books = Object.entries(bookCnt).sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log('--- 《》引书 TOP20（全书合计 ' + Object.values(bookCnt).reduce((a,b)=>a+b,0) + ' 处） ---');
books.forEach(([k, v]) => console.log(k + ': ' + v));
const PAIRS = ['秦汉','汉魏','魏晋','两晋','南北朝','隋唐','唐宋','五代','宋金','金元','元明','明初'];
const pairCnt = {};
PAIRS.forEach(p => pairCnt[p] = corpusAll.split(p).length - 1);
console.log('--- 时代连称合计 ---');
console.log(PAIRS.slice().sort((a,b)=>pairCnt[b]-pairCnt[a]).map(p=>p+':'+pairCnt[p]).join(' '));


// ── 天下之X 意象 + 方位里程分布——ANALYSIS §4.6 之源 ──
const txxCnt = {};
let tm;
const TXX_RE = /天下之([一-鿿]{1,3})/g;
while ((tm = TXX_RE.exec(corpusAll)) !== null) txxCnt[tm[1]] = (txxCnt[tm[1]] || 0) + 1;
const txx = Object.entries(txxCnt).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('--- 天下之X TOP10（人身喻天下） ---');
txx.forEach(x => console.log('天下之' + x[0] + ': ' + x[1]));

const CNd = { '零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
function cn2numJS(s){
  let n = 0, cur = 0;
  for (const ch of s){
    if (ch === '百'){ n += (cur || 1) * 100; cur = 0; continue; }
    if (ch === '十'){ n += (cur || 1) * 10; cur = 0; continue; }
    const d = CNd[ch];
    if (d === undefined) return null;
    cur = d;
  }
  return n + cur;
}
const LI_RE = new RegExp('[东南西北]{1,2}[至距去]?[零一二两三四五六七八九十百]{1,6}里', 'g');
const liMatches = corpusAll.match(LI_RE) || [];
const liNums = [];
for (const m of liMatches){
  let t = m.slice(0, -1);
  while (t && '东南西北至距去'.indexOf(t[0]) >= 0) t = t.slice(1);
  const v = t ? cn2numJS(t) : null;
  if (v && v >= 1 && v <= 900) liNums.push(v);
}
liNums.sort((a, b) => a - b);
const LN = liNums.length;
console.log('--- 方位里程分布（n=' + LN + '） ---');
console.log('中位 ' + liNums[LN >> 1] + ' 里 · 均值 ' + (liNums.reduce((a, b) => a + b, 0) / LN).toFixed(1) +
  ' · P25/P75 ' + liNums[Math.floor(LN * .25)] + '/' + liNums[Math.floor(LN * .75)] +
  ' · P95 ' + liNums[Math.floor(LN * .95)]);


// ── 山河名录 + 城周金字塔——ANALYSIS §4.7 之源 ──
const RIVERS = ['黄河','大河','大江','长江','运河','汉水','江水','漳水','滹沱','淮水','洛水','漕河','汾水','泗水','渭水','汴水'];
const MOUNTS = ['太行','荆山','阴山','恒山','陇山','剑门','碣石','积石','桐柏','巫山','峨眉','武当'];
console.log('--- 山河名录 TOP ---');
RIVERS.map(r => [r, corpusAll.split(r).length - 1]).sort((a, b) => b[1] - a[1]).slice(0, 8)
  .forEach(x => console.log('水·' + x[0] + ': ' + x[1]));
MOUNTS.map(m => [m, corpusAll.split(m).length - 1]).sort((a, b) => b[1] - a[1]).slice(0, 6)
  .forEach(x => console.log('山·' + x[0] + ': ' + x[1]));
const ZH_RE = new RegExp('[城池][周围][零一二两三四五六七八九十百]{1,5}里', 'g');
const zhNums = [];
for (const m of (corpusAll.match(ZH_RE) || [])){
  const t = m.slice(2, -1);
  const v = cn2numJS(t);
  if (v && v >= 1 && v <= 120) zhNums.push(v);
}
zhNums.sort((a, b) => a - b);
const ZN = zhNums.length;
console.log('--- 城周金字塔（n=' + ZN + '） ---');
console.log('中位 ' + zhNums[ZN >> 1] + ' 里 · P25/P75 ' + zhNums[Math.floor(ZN * .25)] + '/' + zhNums[Math.floor(ZN * .75)] + ' · 最大 ' + zhNums[ZN - 1]);


// ── 战争的动词地理——ANALYSIS §4.8 之源 ──
const WVERBS = ['攻','围','拔','陷','克','破','守','据','降','战','败','屠','焚','掠'];
const verbRows = out.map(function(r){
  const txt = provTextById[r.p] || '';
  const cnt = {};
  WVERBS.forEach(v => cnt[v] = txt.split(v).length - 1);
  const total = WVERBS.reduce((a, v) => a + cnt[v], 0);
  return { prov: r.p, total: total, d: +(total * 10000 / r.chars).toFixed(2) };
}).sort((a, b) => b.d - a.d);
console.log('--- 攻守动词密度 TOP6 / 垫底3 ---');
verbRows.slice(0, 6).forEach(r => console.log(r.prov + ' ' + r.d));
console.log('…');
verbRows.slice(-3).forEach(r => console.log(r.prov + ' ' + r.d));

console.log('--- 每词之冠（每万字） ---');
VOCAB.forEach(w => {
  const best = out.reduce((m, r) => (r.cnt[w]*10000/r.chars > m.cnt[w]*10000/m.chars ? r : m), out[0]);
  console.log(`${w}: ${best.p} ${(best.cnt[w]*10000/best.chars).toFixed(2)}`);
});
