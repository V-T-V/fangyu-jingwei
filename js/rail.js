/* ═══════════ 方舆经纬 · 左列纲目 + 省选择 ═══════════ */

const rail = document.getElementById("raillist");
const railtitle = document.getElementById("railtitle");

function railYutu(){
  railtitle.innerHTML = `十五省纲目<small>府一百九十三</small>`;
  rail.innerHTML = FY.provinces.map(p=>
    `<div class="ri" data-p="${p.id}">
      <span class="dot" style="color:${PCOLORS[p.id]}"></span>
      <span><span class="nm">${p.name}</span><span class="ju">${p.vols[0]}起</span></span>
      <span class="ct">${p.fu.length}府</span></div>`).join("");
  rail.querySelectorAll(".ri").forEach(el=>el.onclick=()=>selectProv(el.dataset.p));
}
function railXingshi(){
  railtitle.innerHTML = `历代州域形势<small>凡九卷</small>`;
  rail.innerHTML = ERAS.map(e=>
    `<div class="ri" data-e="${e.i}"><span class="dot" style="color:#b23a2e"></span>
     <span><span class="nm">${e.label}</span><span class="ju">${e.time}</span></span></div>`).join("");
  rail.querySelectorAll(".ri").forEach(el=>el.onclick=()=>{
    highlightRail("形势",+el.dataset.e);
    buildEra(+el.dataset.e);openEra(+el.dataset.e);
  });
}
function railChuandu(){
  railtitle.innerHTML = `川渎异同<small>水道六卷附海道 · 分野一卷</small>`;
  const items = RIVERS.map(r=>
    `<div class="ri" data-r="${r.key}"><span class="dot" style="color:${r.color}"></span>
     <span><span class="nm">${r.key}</span><span class="ju">${r.vols}</span></span></div>`).join("")
    + `<div class="ri" data-r="分野"><span class="dot" style="color:#8b8069"></span>
     <span><span class="nm">分野</span><span class="ju">卷一百三十</span></span></div>`;
  rail.innerHTML = items;
  rail.querySelectorAll(".ri").forEach(el=>el.onclick=()=>{
    highlightRail("川渎",el.dataset.r);
    if(el.dataset.r==="分野"){openFenye();return;}
    const r=buildRivers(el.dataset.r);openRiver(r);
  });
}
function openFenye(){
  const xs=FY.chuandu[6];
  vset("分野","卷终");
  pbody.innerHTML=`
    <div class="p-kicker">${xs.title} · 卷一百三十</div>
    <div class="quote">${xs.ex}……</div>
    <div class="hint">分野者，以十二次配十二域，观天察地之术。此卷为全书之终。</div>`;
  showPanel();
}
function highlightRail(m,key){
  rail.querySelectorAll(".ri").forEach(el=>{
    const v = m==="形势"?el.dataset.e:el.dataset.p||el.dataset.r;
    el.classList.toggle("on",String(v)===String(key));
  });
}

/* ── 省选择：高亮本省印章，淡出他省，飞至省域 ── */
let selPid=null;
function selectProv(pid){
  selPid=pid;
  document.body.classList.toggle("selprov",!!pid);
  for(const id in fuMarkers){
    fuMarkers[id].forEach(m=>{
      const el=m.getElement&&m.getElement();
      if(el){
        const f=el.querySelector(".fuseal"); if(f)f.classList.toggle("dim",!!pid&&id!==pid);
        const z=el.querySelector(".zseal"); if(z)z.classList.toggle("dim",!!pid&&id!==pid);
      }
    });
  }
  setFuLabels(pid);
  if(pid){
    const p=FY.provinces.find(x=>x.id===pid);
    highlightRail("舆图",pid);
    const b=L.latLngBounds(p.fu.filter(u=>u.c).map(u=>u.c)).pad(.22);
    safeFly(b,{duration:1.1});
    syncHash("舆图", "p=" + pid);
    openProv(p);
  }else{
    highlightRail("舆图",null);
    syncHash("舆图", null);
  }
}
