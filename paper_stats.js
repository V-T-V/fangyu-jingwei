/* 《方舆经纬》论文数字复核脚本：node paper_stats.js
   输出分省卷帙 / 16 军事语汇密度 / 每词之冠（站点语料口径）。
   ANALYSIS.md §四 一切文本数字之源。 */
const fs = require('fs');
const VOCAB = ['形胜','险要','要害','咽喉','锁钥','门户','屏蔽','冲要','守御','屯戍','关隘','堡寨','烽堠','营垒','倭寇','盗贼'];
const ids = {beizhi:'北直隶',nanzhi:'南直隶',shandong:'山东',shanxi:'山西',henan:'河南',shanxix:'陕西',sichuan:'四川',huguang:'湖广',jiangxi:'江西',zhejiang:'浙江',fujian:'福建',guangdong:'广东',guangxi:'广西',yunnan:'云南',guizhou:'贵州'};
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
  out.push({ p: ids[id], chars: txt.length, total, d: +(total * 10000 / txt.length).toFixed(2), cnt });
}
out.sort((a, b) => b.chars - a.chars);
console.log('省 | 字数(万) | 16词合计 | 每万字');
out.forEach(r => console.log(`${r.p} | ${(r.chars/10000).toFixed(1)} | ${r.total} | ${r.d}`));
console.log('--- 每词之冠（每万字） ---');
VOCAB.forEach(w => {
  const best = out.reduce((m, r) => (r.cnt[w]*10000/r.chars > m.cnt[w]*10000/m.chars ? r : m), out[0]);
  console.log(`${w}: ${best.p} ${(best.cnt[w]*10000/best.chars).toFixed(2)}`);
});
