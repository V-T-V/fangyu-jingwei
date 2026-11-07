/* ═══════════ 方舆经纬 · 全书检索（府·州·县·朝·河） ═══════════ */

const IDX = (()=>{const a=[];
  FY.provinces.forEach(p=>{
    a.push({t:p.name,k:"省",ctx:"十五省",pid:p.id});
    p.fu.forEach(u=>{
      a.push({t:u.n,k:u.n.endsWith("州")?"州":"府",ctx:p.name,pid:p.id,fu:u.n});
      u.zhou.forEach(z=>a.push({t:z,k:"州",ctx:p.name+"·"+u.n,pid:p.id,fu:u.n}));
      u.xian.forEach(x=>{const nm=x.replace(/〔.*?〕/g,"");
        a.push({t:nm,k:"县",ctx:p.name+"·"+u.n,pid:p.id,fu:u.n});});
    });
  });
  ERAS.forEach(e=>a.push({t:e.label,k:"朝",ctx:e.time,era:e.i}));
  RIVERS.forEach(r=>a.push({t:r.key,k:"河",ctx:r.vols,river:r.key}));
  return a;
})();

const sinput=document.getElementById("search"), sres=document.getElementById("sresults");

function searchHits(q){
  return IDX.filter(x=>x.t.includes(q))
    .sort((a,b)=>(a.t===q?-1:0)-(b.t===q?-1:0)||a.t.indexOf(q)-b.t.indexOf(q)||a.t.length-b.t.length)
    .slice(0,14);
}
function renderHits(hits,q){
  const ftRow = `<div class="sr ftall" id="ftall">📖 在全书原文中检索「${q}」…</div>`;
  if(!hits.length){sres.innerHTML=`<div class="none">名录未见「${q}」</div>`+ftRow;}
  else sres.innerHTML=hits.map((h,i)=>`<div class="sr" data-i="${i}">
      <span class="tag t${h.k}">${h.k}</span><span>${h.t}</span><span class="ctx">${h.ctx}</span></div>`).join("")
    + ftRow;
  sres.classList.add("open");
  sres.querySelectorAll(".sr[data-i]").forEach(el=>el.onclick=()=>goHit(hits[+el.dataset.i]));
  const fa = sres.querySelector("#ftall");
  if (fa) fa.onclick = ()=>ftRun(q);
}
function goHit(h){
  sinput.value=h.t;sres.classList.remove("open");
  if(h.era!==undefined){setMode("形势");buildEra(h.era);openEra(h.era);
    setTimeout(()=>highlightRail("形势",h.era),0);}
  else if(h.river){setMode("川渎");const r=buildRivers(h.river);openRiver(r);
    setTimeout(()=>highlightRail("川渎",h.river),0);}
  else{setMode("舆图");const p=FY.provinces.find(x=>x.id===h.pid);
    const u=p.fu.find(x=>x.n===h.fu);
    selectProv(h.pid);openFu(p,u);}
}

sinput.addEventListener("input",()=>{
  const q=sinput.value.trim();
  if(!q){sres.classList.remove("open");return;}
  renderHits(searchHits(q),q);
});
/* 回车直达第一条 */
sinput.addEventListener("keydown",e=>{
  if(e.key!=="Enter") return;
  const q=sinput.value.trim();
  if(!q) return;
  const hits=searchHits(q);
  if(hits.length) goHit(hits[0]);
});
document.addEventListener("click",e=>{
  if(!e.target.closest("#searchwrap")) sres.classList.remove("open");
});
