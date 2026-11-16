/* 论文插图数据源：node docs/figs_data.js > docs/figs_data.json
   口径与 paper_stats.js 完全一致（同一正则 · 同一 cn2num · 同一 split 计数）。
   产出：里程直方图 bins · 引书 TOP10 · 分省密度（用于与 S1 互证）。 */
const fs = require('fs');

const VOCAB = ['形胜','险要','要害','咽喉','锁钥','门户','屏蔽','冲要','守御','屯戍','关隘','堡寨','烽堠','营垒','倭寇','盗贼'];
const WVERBS = ['攻','围','拔','陷','克','破','守','据','降','战','败','屠','焚','掠'];
const ids = {beizhi:'北直隶',nanzhi:'南直隶',shandong:'山东',shanxi:'山西',henan:'河南',shanxix:'陕西',sichuan:'四川',huguang:'湖广',jiangxi:'江西',zhejiang:'浙江',fujian:'福建',guangdong:'广东',guangxi:'广西',yunnan:'云南',guizhou:'贵州'};

let corpusAll = '';
const provs = [];
for (const id of Object.keys(ids)){
  const src = fs.readFileSync('data/text/' + id + '.js', 'utf8');
  const sandbox = { FYTEXT: {} };
  try { (new Function('FYTEXT', src.slice(src.indexOf('FYTEXT') - 0)))(sandbox.FYTEXT); } catch(e) { console.error('eval fail', id, e.message); }
  const bag = sandbox.FYTEXT[id] || {};
  let txt = bag.xu || '';
  for (const k in (bag.fu || {})) txt += bag.fu[k];
  corpusAll += txt;
  const v = VOCAB.reduce((s, w) => s + txt.split(w).length - 1, 0);
  const w2 = WVERBS.reduce((s, x) => s + txt.split(x).length - 1, 0);
  provs.push({ p: ids[id], chars: txt.length, vocab_d: +(v * 10000 / txt.length).toFixed(2), verb_d: +(w2 * 10000 / txt.length).toFixed(2) });
}

/* 里程——LI_RE 与 paper_stats.js 逐字相同 */
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
const liNums = [];
for (const m of (corpusAll.match(LI_RE) || [])){
  let t = m.slice(0, -1);
  while (t && '东南西北至距去'.indexOf(t[0]) >= 0) t = t.slice(1);
  const v = t ? cn2numJS(t) : null;
  if (v && v >= 1 && v <= 900) liNums.push(v);
}
liNums.sort((a, b) => a - b);
const LN = liNums.length;

/* 直方图：0-300 里按 10 里分箱，>300 并入末箱标记 */
const BINS = [];
for (let i = 0; i < 30; i++) BINS.push([i * 10, 0]);
let over = 0;
liNums.forEach(v => { if (v > 300) over++; else BINS[Math.min(29, Math.floor((v - 1) / 10))][1]++; });
const median = liNums[LN >> 1];
const p75 = liNums[Math.floor(LN * .75)];
const p95 = liNums[Math.floor(LN * .95)];

/* 引书 TOP10——BOOKS_RE 与 paper_stats.js 逐字相同 */
const bookCnt = {};
let bm;
const LB = String.fromCharCode(0x300a), RB = String.fromCharCode(0x300b);
const BOOKS_RE = new RegExp('[' + LB + ']([^' + LB + RB + ']{2,8})[' + RB + ']', 'g');
while ((bm = BOOKS_RE.exec(corpusAll)) !== null) bookCnt[bm[1]] = (bookCnt[bm[1]] || 0) + 1;
const booksTop = Object.entries(bookCnt).sort((a, b) => b[1] - a[1]).slice(0, 10);

console.log(JSON.stringify({ n_li: LN, median, p75, p95, over300: over, bins: BINS, books_top: booksTop, provs }, null, 1));
