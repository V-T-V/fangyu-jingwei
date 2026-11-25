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

/* ── 版面同步：把页脚实际高度、面板实际占位写进 CSS 变量 ──
   贴边固定件（纲目 / 面板 / 时间轴 / 右缘控件列）的偏移一律读 --fh 与 --ctl-r，
   页脚换行、面板宽度变化、窗口缩放都自动跟上——不再靠各处手写的 52 / 58 / 64px。
   centered === true：仅由取景动画结束时调用（map.js safeFly）——手机低倍图 / 平板 z4 改以取景目标的中心对齐可见区。 */
function syncChrome(centered){
  const fh = document.querySelector("footer"), pn = document.getElementById("panel");
  const rt = document.documentElement.style;
  if (fh){
    const bottom = parseFloat(getComputedStyle(fh).bottom) || 0;
    rt.setProperty("--fh", (fh.offsetHeight + bottom).toFixed(1) + "px");
  }
  if (pn){
    const sheet = innerWidth <= 640;                 // 手机：面板是底部抽屉，控件列不必让位
    const base = innerWidth <= 1080 ? (sheet ? 8 : 10) : 24;
    const open = pn.classList.contains("open");
    rt.setProperty("--ctl-r", (!sheet && open ? Math.max(base, innerWidth - pn.offsetLeft + 18) : base) + "px");
    /* 手机低倍图：抽屉开着时量出「页眉底—抽屉顶」这条可见带，地图容器据此上移（见 css：body.z4:not(.z6) #map）——
       抽屉没开、或可见带太窄（不足 80px，抬了也看不见）都不移。平时上移到「容器中心」落在可见带正中；
       取景刚结束时则以取景目标（map._fyFocus）的中心为准，整段疆域 / 水道居中而不只是地图中心线居中。
       只在取景结束的那一刻对一次：用户随后手动拖动，不再跟着挪（否则拖了等于没拖） */
    let shift = 0;
    const hd = document.querySelector("header");
    if (sheet && open && hd){
      const top = hd.getBoundingClientRect().bottom, strip = pn.offsetTop - top;
      if (strip > 80){
        const cy = (centered === true && map._fyFocus) ? map.latLngToContainerPoint(map._fyFocus).y : innerHeight / 2;
        shift = Math.max(0, Math.round(cy - (top + strip / 2)));
      }
    }
    rt.setProperty("--sheet-shift", shift + "px");
    /* 平板 / 窄窗（≤1080，面板是右侧卷宗）的横向同理：z4 时地图中心钉在容器正中，形势、川渎的主体落到卷宗后面。
       卷宗开着、且卷宗左侧可见区够宽（> 120px）时，地图容器等宽左移，让取景目标落在可见区正中
       （见 css：body.z4:not(.z5) #map；z5 起横向已可自由平移，取景留白本就生效） */
    let sx = 0;
    if (!sheet && open && innerWidth <= 1080){
      const rr = document.getElementById("rail"), l = (rr ? rr.getBoundingClientRect().right : 0) + 12, r = pn.getBoundingClientRect().left - 12;
      if (r - l > 120){
        const fx = (centered === true && map._fyFocus) ? map.latLngToContainerPoint(map._fyFocus).x : innerWidth / 2;
        sx = Math.max(0, Math.round(fx - (l + r) / 2));
      }
    }
    rt.setProperty("--map-shift-x", sx + "px");
    /* 时间轴可用宽度不足（平板竖屏上夹在纲目与卷宗之间约 170px，九个朝代名叠成一团）时只留圆点 */
    const tl = document.getElementById("tl");
    if (tl) document.body.classList.toggle("tl-tight", tl.offsetWidth < 300);
    /* 容器因上面两项挪动过（.35s 过渡）：挪完重排一次地图标签，否则标签还按挪动前的位置避让界面
       （平板竖屏实录：南京的标签被卷宗切掉一半） */
    if (centered === true && (shift || sx) && typeof layoutLabels === "function") setTimeout(layoutLabels, 400);
  }
}
if (typeof ResizeObserver === "function" && document.querySelector("footer")){
  new ResizeObserver(() => syncChrome()).observe(document.querySelector("footer"));
}
addEventListener("resize", syncChrome);
syncChrome();

/* 封面统计行与底栏同源（此前写死「1096 县」——数据考古后早已不是这个数）。
   数字与单位、分隔点与前项之间用不断行空格：手机上折成两行时，断点落在分隔点之后，不会把「50」和「关隘」拆开 */
(function(){
  const bs = document.getElementById("bootstats");
  if (bs) bs.textContent = [ST.pf + "\u00a0省", ST.f + "\u00a0府", ST.x + "\u00a0县", PASSES.length + "\u00a0关隘", "260\u00a0万字全文", "三维山河"].join("\u00a0· ");
})();
/* 页脚图标占位 → 线性 SVG（图标定义在 config.js，单一来源） */
document.querySelectorAll("i.fico[data-ic]").forEach(el => { el.outerHTML = fyIcon(el.dataset.ic); });

/* 手机：纲目抽屉开关。抽屉滑完（.3s）后让地图标签重新避让——否则抽屉底下的标签在左缘露出半截字 */
var _rt = document.getElementById("railtoggle");
if (_rt) _rt.onclick = () => {
  document.body.classList.toggle("rail-open");
  setTimeout(() => { syncChrome(); layoutLabels(); }, 330);
};

/* 快捷键：Esc 收面板；形势模式 ←/→ 翻卷 */
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    hidePanel();
    if(mode==="舆图") selectProv(null);
    return;
  }
  if(e.key==="?" && e.target.tagName!=="INPUT"){ openAbout(); return; }
  if(e.key==="/" && e.target.tagName!=="INPUT"){
    e.preventDefault();
    const si = document.getElementById("search");
    if (si){ si.focus(); si.select(); }
    return;
  }
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
if (_ana) _ana.onclick = function(){ if (typeof openAnalytics === "function") openAnalytics(); };   /* 裸引后加载模块 = 加载即崩，101 行后全灭（2026-11-18 案：透视/九边/底图/播放键齐死） */

var _wx = document.getElementById("wenxinlink");
if (_wx) _wx.onclick = function(){ if (typeof openWenxin === "function") openWenxin(); };

var _bl = document.getElementById("bianlink");
if (_bl) _bl.onclick = function(){ if (typeof openBian === "function") openBian(); };

var _xr = document.getElementById("xrevlink");
if (_xr) _xr.onclick = function(){ if (typeof openXrev === "function") openXrev(); };

var _td = document.getElementById("tdlink");
if (_td) _td.onclick = function(){
  /* 携上下文：正在看府 → 飞该府；形势模式 → 带朝代；否则入山河全景 */
  let h = "";
  if (typeof __curFu !== "undefined" && __curFu)
    h = "#p=" + __curFu.pid + "&fu=" + encodeURIComponent(__curFu.fu);
  else if (mode === "形势")
    h = "#era=" + curEra;
  location.href = "3d.html" + h;
};

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
