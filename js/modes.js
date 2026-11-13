/* ═══════════ 方舆经纬 · 模式切换 + 深链 ═══════════
   加载顺序在最末：app.js 已完成 buildFu/railYutu 初始化。 */

let mode="舆图";
function setMode(m){
  mode=m;
  document.body.className = document.body.className.replace(/m-\S+/g,"").trim();
  document.body.classList.add("m-"+m);document.body.classList.add("nopanel");
  document.querySelectorAll("#modes button").forEach(b=>b.classList.toggle("on",b.dataset.m===m));
  document.getElementById("modelabel").textContent=m;
  document.getElementById("modenote").textContent=NOTE[m];
  fuLayer.remove();eraLayer.remove();riverLayer.remove();
  zhouLayer.remove();countyLayer.remove();passLayer.remove();   // 分级图层随主层摘除
  if (typeof hideProvHull === "function") hideProvHull();
  if (typeof clearCountyTerritories === "function") clearCountyTerritories();
  if (typeof clearJurisdiction === "function") clearJurisdiction();
  if (typeof clearFuHull === "function") clearFuHull();
  if (typeof clearFuHeat === "function") clearFuHeat();   // 文心被引着色随模式摘除
  selPid=null;document.body.classList.remove("selprov");
  if (typeof __curFu !== "undefined") __curFu = null;   // 换模式弃置 3D 上下文
  if(m==="舆图") setFuLabels(null);
  hidePanel();
  if (typeof stopTTS === "function") stopTTS();
  if (typeof eraPlaying !== "undefined" && eraPlaying) toggleEraPlay();
  syncHash(m, null);
  if(m==="舆图"){fuLayer.addTo(map);applyZoomGates();railYutu();safeFly([[17,96],[44,129]],{duration:1});}
  if(m==="形势"){eraLayer.addTo(map);railXingshi();buildEra(0);openEra(0);highlightRail("形势",0);}
  if(m==="川渎"){riverLayer.addTo(map);railChuandu();const r=buildRivers("大江");openRiver(r);highlightRail("川渎","大江");}
}
document.querySelectorAll("#modes button").forEach(b=>b.onclick=()=>setMode(b.dataset.m));

/* 深链：#mode=舆图&p=huguang&fu=武昌府 | #mode=形势&era=8 | #mode=川渎&r=大江 */
(function deeplink(){
  const q=new URLSearchParams(location.hash.replace(/^#/,""));
  if(![...q.keys()].length) return;
  dismissBoot();
  if(q.get("search")){
    setTimeout(()=>{
      const si=document.getElementById("search");
      si.value=q.get("search");
      si.dispatchEvent(new Event("input"));
      si.focus();
    }, 700);
    return;
  }
  const m=q.get("mode")||"舆图";
  if(!["舆图","形势","川渎"].includes(m)) return;
  setMode(m);
  if(m==="舆图"&&q.get("p")){
    const p=FY.provinces.find(x=>x.id===q.get("p"));
    if(p){
      selectProv(p.id);
      if(q.get("fu")){const u=p.fu.find(x=>x.n===q.get("fu"));
        if(u)setTimeout(()=>openFu(p,u),600);}
    }
  }
  if(m==="形势"&&q.get("era")!==null){
    const ei=Math.min(Math.max(+q.get("era")||0,0),8);
    buildEra(ei);openEra(ei);highlightRail("形势",ei);
  }
  if(m==="川渎"&&q.get("r")){
    const r=buildRivers(q.get("r"));openRiver(r);highlightRail("川渎",q.get("r"));
  }
})();
