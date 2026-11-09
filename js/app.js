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
document.getElementById("boot").onclick=()=>dismissBoot(()=>openIntro());

/* 快捷键：Esc 收面板；形势模式 ←/→ 翻卷 */
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    hidePanel();
    if(mode==="舆图") selectProv(null);
    return;
  }
  if(e.key==="?" && e.target.tagName!=="INPUT"){ openAbout(); return; }
  if(mode!=="形势") return;
  if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
    const d=e.key==="ArrowRight"?1:-1;
    const ei=Math.min(Math.max(curEra+d,0),ERAS.length-1);
    buildEra(ei);openEra(ei);highlightRail("形势",ei);
  }
});

var _al = document.getElementById("aboutlink"); if (_al) _al.onclick = openAbout;

var _tl = document.getElementById("tablelink"); if (_tl) _tl.onclick = openTable;
