/* ═══════════ 方舆经纬 · 九边专题（明北边防务体系） ═══════════
   PASSES 人工整编数据按 type 分组：九边九镇（西→东）＋内三关＋太行八陉＋天下名关 */

const BIAN_ZHEN = [
  ["九边·甘肃", "甘肃镇"], ["九边·宁夏", "宁夏镇"], ["九边·延绥", "延绥镇"],
  ["九边·山西", "山西镇"], ["九边·大同", "大同镇"], ["九边·宣府", "宣府镇"],
  ["九边·蓟镇", "蓟州镇"], ["九边·辽东", "辽东镇"],
];
const BIAN_OTHER = [
  ["内三关", "内三关"], ["太行八陉", "太行八陉"],
];

/* 定位一关：舆图模式 + 飞至 + 脉冲环；面板题签随之更新 */
function revealPass(q){
  if (mode !== "舆图") setMode("舆图");
  vset(q.n, "关隘");
  vseal.textContent = "关";
  safeFlyTo(q.c, 8, {duration: 1.1});
  const ring = L.circleMarker(q.c, {radius: 15, weight: 2.4, color: "#b23a2e",
    opacity: .9, fill: false, className: "evring"}).addTo(map);
  setTimeout(() => map.removeLayer(ring), 3200);
}

/* 镇域视野：一镇诸关的包络 */
function flyZhen(list){
  const b = L.latLngBounds(list.map(q => q.c)).pad(.35);
  if (mode !== "舆图") setMode("舆图");
  safeFly(b, {duration: 1.1});
}

function openBian(){
  vset("九边", "防务");
  vseal.textContent = "边防";
  const byType = {};
  PASSES.forEach(q => { (byType[q.type] = byType[q.type] || []).push(q); });

  const zhRow = ([key, name]) => {
    const list = byType[key] || [];
    if (!list.length) return "";
    const chips = list.map(q =>
      `<span class="chip jschip" data-p="${q.n}" title="${q.fu} · 今${q.now}">${q.n}</span>`).join("");
    return `<div class="bian-zhen" data-z="${key}">
      <span class="bz-nm">${name}<i>${list.length} 垣</i></span>
      <span class="bz-chips">${chips}</span></div>`;
  };

  const known = new Set([...BIAN_ZHEN, ...BIAN_OTHER].map(x => x[0]));
  const rest = PASSES.filter(q => !known.has(q.type));
  const restChips = rest.map(q =>
    `<span class="chip" data-p="${q.n}" title="${q.type} · ${q.fu} · 今${q.now}">${q.n}</span>`).join("");

  pbody.innerHTML = `
   <div class="p-kicker">明北边防务 · 西起嘉峪关 东抵山海关</div>
   <div class="quote qxu">明人设九边以御虏：曰辽东、曰蓟州、曰宣府、曰大同、曰山西（偏关）、曰延绥、曰宁夏、曰固原、曰甘肃。边墙万里，墩堡相望，关塞之险，天下之脊也。</div>
   <div class="p-cap">九镇（自西而东 · 点镇名观其垣塞，点关名飞至其地）</div>
   ${BIAN_ZHEN.map(zhRow).join("")}
   <div class="p-cap">辅车</div>
   ${BIAN_OTHER.map(zhRow).join("")}
   <div class="p-cap">天下名关 ${rest.length}</div>
   <div class="chips">${restChips}</div>
   <div class="p-cap">图式</div>
   <div class="hint">舆图模式 zoom≥5 见 50 关隘标记：九边诸关朱色（bian 虚线为防线走向），内三关与诸名关墨色。红线为九边防线（嘉峪关→山海关），防线据诸关经度串连，示意而已。</div>
   <div class="readrow"><button class="readfull" id="bianGo">➤ 图上观九边全线</button></div>`;

  pbody.querySelectorAll(".chip[data-p]").forEach(ch => ch.onclick = () => {
    const q = PASSES.find(x => x.n === ch.dataset.p);
    if (q) revealPass(q);
  });
  pbody.querySelectorAll(".bian-zhen[data-z]").forEach(z => z.onclick = e => {
    if (e.target.classList.contains("chip")) return;      // 关隘 chip 自有动作
    flyZhen(byType[z.dataset.z] || []);
  });
  const go = pbody.querySelector("#bianGo");
  if (go) go.onclick = () => {
    if (mode !== "舆图") setMode("舆图");
    const b = L.latLngBounds(PASSES.filter(q => q.type.indexOf("九边") >= 0 || q.type === "内三关").map(q => q.c)).pad(.08);
    safeFly(b, {duration: 1.4});
  };
  showPanel();
}
