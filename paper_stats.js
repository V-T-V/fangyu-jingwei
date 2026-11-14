/* 《方舆经纬》论文数字复核脚本：node paper_stats.js
   输出分省卷帙 / 16 军事语汇密度 / 每词之冠（站点语料口径）。
   ANALYSIS.md §四 一切文本数字之源。 */
const fs = require('fs');
const VOCAB = ['形胜','险要','要害','咽喉','锁钥','门户','屏蔽','冲要','守御','屯戍','关隘','堡寨','烽堠','营垒','倭寇','盗贼'];
const ids = {beizhi:'北直隶',nanzhi:'南直隶',shandong:'山东',shanxi:'山西',henan:'河南',shanxix:'陕西',sichuan:'四川',huguang:'湖广',jiangxi:'江西',zhejiang:'浙江',fujian:'福建',guangdong:'广东',guangxi:'广西',yunnan:'云南',guizhou:'贵州'};
let corpusAll = '';
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

console.log('--- 每词之冠（每万字） ---');
VOCAB.forEach(w => {
  const best = out.reduce((m, r) => (r.cnt[w]*10000/r.chars > m.cnt[w]*10000/m.chars ? r : m), out[0]);
  console.log(`${w}: ${best.p} ${(best.cnt[w]*10000/best.chars).toFixed(2)}`);
});
