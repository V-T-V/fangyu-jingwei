/* ═══════════ 方舆经纬 · 统计 / 启动 / 快捷键 ═══════════ */

/* 全局统计（自解析数据实时计算） */
const ST = (()=>{ let f=0,z=0,x=0,pf=0;
  FY.provinces.forEach(p=>{pf++;p.fu.forEach(u=>{f++;z+=u.zhou.length;x+=u.xian.length;
    u.zx.forEach(zz=>x+=zz.x.length);});});
  return {f,z,x,pf}; })();
document.getElementById("bookstat").textContent =
  `${ST.pf}省 · ${ST.f}府 · ${ST.z}州 · ${ST.x}县 · 130卷`;

/* 状态写回 URL（刷新/分享保持视图，不产生历史记录） */
function syncHash(m, rest){
  const h = "#mode=" + encodeURIComponent(m) + (rest ? "&" + rest : "");
  try{ history.replaceState(null, "", location.pathname + location.search + h); }catch(e){}
}

/* 初始图层与纲目 */
buildFu();
if (typeof buildPasses === "function") buildPasses();
if (typeof buildFrontier === "function") buildFrontier();
railYutu();

/* 形势 · 九卷时间轴（点击切换，openEra 同步高亮） */
const tlEl = document.getElementById("tl");
function tlBuild(){
  tlEl.innerHTML = '<div class="axis"></div>' + ERAS.map(e=>
    `<div class="seg" data-i="${e.i}"><span class="nm">${e.label}</span><span class="tm">${e.time}</span></div>`).join("");
  tlEl.querySelectorAll(".seg").forEach(g=>g.onclick=()=>{
    buildEra(+g.dataset.i); openEra(+g.dataset.i); highlightRail("形势",+g.dataset.i);
  });
}
function tlSync(i){
  tlEl.querySelectorAll(".seg").forEach(g=>g.classList.toggle("on", +g.dataset.i===i));
}
tlBuild();

/* 序幕 */
function dismissBoot(cb){
  const b=document.getElementById("boot");
  if(!b){cb&&cb();return;}
  b.classList.add("gone");
  setTimeout(()=>{b.remove();cb&&cb();},900);
}
var _bt = document.getElementById("boot"); if (_bt) _bt.onclick=()=>dismissBoot(()=>openIntro());

/* 快捷键：Esc 收面板；形势模式 ←/→ 翻卷 */
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    hidePanel();
    if(mode==="舆图") selectProv(null);
    return;
  }
  if(e.key==="?" && e.target.tagName!=="INPUT"){ openAbout(); return; }
  if(e.target.tagName==="INPUT"||e.target.tagName==="SELECT") return;  // 输入中不抢键
  if(mode!=="形势") return;
  if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
    const d=e.key==="ArrowRight"?1:-1;
    const ei=Math.min(Math.max(curEra+d,0),ERAS.length-1);
    buildEra(ei);openEra(ei);highlightRail("形势",ei);
  }
});

var _al = document.getElementById("aboutlink"); if (_al) _al.onclick = openAbout;

var _tl = document.getElementById("tablelink"); if (_tl) _tl.onclick = openTable;

/* ── 漫步模式：随机穿越帝国 ── */
function wander(){
  const p = FY.provinces[Math.floor(Math.random() * FY.provinces.length)];
  const u = p.fu[Math.floor(Math.random() * p.fu.length)];
  setMode("舆图");
  selectProv(p.id);
  setTimeout(()=>{
    openFu(p, u);
    // 打开原文，随机滚到一段
    setTimeout(()=>{
      openFuText(p, u);
      setTimeout(()=>{
        const tps = document.querySelectorAll(".tp");
        if (tps.length > 3){
          const k = Math.floor(Math.random() * Math.min(tps.length, 20));
          tps[k].scrollIntoView({behavior:"smooth", block:"center"});
          tps[k].classList.add("flash");
          setTimeout(()=>tps[k].classList.remove("flash"), 2000);
        }
      }, 1200);
    }, 800);
  }, 500);
}

var _wl = document.getElementById("wanderlink");
if (_wl) _wl.onclick = wander;

var _ana = document.getElementById("analyticslink");
if (_ana) _ana.onclick = openAnalytics;

var _wx = document.getElementById("wenxinlink");
if (_wx) _wx.onclick = function(){ if (typeof openWenxin === "function") openWenxin(); };

var _bl = document.getElementById("bianlink");
if (_bl) _bl.onclick = function(){ if (typeof openBian === "function") openBian(); };

var _td = document.getElementById("tdlink");
if (_td) _td.onclick = function(){ location.href = "3d.html"; };

/* 底图切换：地形 ⇄ 影像（观山川形胜） */
var _bm = document.getElementById("bmtoggle");
if (_bm) _bm.onclick = function(){
  setBasemap(document.body.classList.contains("imgbasemap") ? "physical" : "imagery");
};

/* ── 形势自动播放：Play 键穿越九朝 ──
   var（非 let）：app.js 若中途崩，modes.js 的 typeof 守卫不致落入 TDZ */
var eraPlaying = false, eraTimer = null;
function toggleEraPlay(){
  const btn = document.getElementById("eraPlay");
  if (eraPlaying) {
    clearTimeout(eraTimer);
    eraPlaying = false;
    if (typeof stopTTS === "function") stopTTS();
    if (btn) { btn.textContent = "▶"; btn.style.background = ""; btn.title = "播放九朝演进"; }
    return;
  }
  eraPlaying = true;
  if (btn) { btn.textContent = "⏸"; btn.style.background = "rgba(178,58,46,.1)"; btn.title = "暂停"; }
  let idx = curEra;
  const narrate = i => {
    if (typeof startTTS !== "function" || !("speechSynthesis" in window)) return;
    const xs = FY.xingshi[i];
    const txt = xs ? xs.ex.slice(0, 50) + "。" : "";
    if (txt) startTTS(txt);
  };
  const step = () => {
    idx = (idx + 1) % ERAS.length;
    buildEra(idx); openEra(idx); highlightRail("形势", idx);
    document.querySelectorAll("#tl .seg").forEach((g,i)=>g.classList.toggle("on", i===idx));
    narrate(idx);
  };
  /* 递归 setTimeout：每轮重读速度档，播放中途换档立即生效 */
  const tick = () => {
    const speed = +(document.getElementById("eraSpeed")||{value:"4000"}).value || 4000;
    eraTimer = setTimeout(()=>{ if (eraPlaying) { step(); tick(); } }, speed);
  };
  step(); tick();
}

var _ep = document.getElementById("eraPlay");
if (_ep) _ep.onclick = toggleEraPlay;

/* ── PWA 离线徽标：SW 接管即点亮，断网时实时提示 ── */
(function(){
  const el = document.getElementById("swstate");
  if (!el || !("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  const paint = ok => {
    if (!ok){ el.style.display = "none"; return; }
    el.style.display = "";
    const upd = () => { el.textContent = navigator.onLine ? "◼ 离线可用" : "◼ 离线中 · 全书可读"; };
    upd();
    addEventListener("online", upd);
    addEventListener("offline", upd);
  };
  navigator.serviceWorker.ready
    .then(() => paint(true))
    .catch(() => paint(false));
})();
