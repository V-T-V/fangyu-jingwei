/* ═══════════ 方舆经纬 · 卷宗面板 ═══════════ */

const panel=document.getElementById("panel"),
      pbody=document.getElementById("pbody"),
      vname=document.getElementById("vname"),
      vseal=document.getElementById("vseal");
function showPanel(){panel.classList.add("open");document.body.classList.remove("nopanel");}
function hidePanel(){
  panel.classList.remove("open");document.body.classList.add("nopanel");
  /* 透视页等设置的内联尺寸一并清除，避免泄漏到后续面板 */
  panel.style.width="";panel.style.top="";panel.style.bottom="";
}
document.getElementById("pclose").onclick=()=>{
  hidePanel();
  if (typeof clearJurisdiction === "function") clearJurisdiction();
  if (typeof clearFuHull === "function") clearFuHull();
  if (typeof clearCountyTerritories === "function") clearCountyTerritories();
  if(mode==="舆图")selectProv(null);
};

function vset(name,seal){vname.textContent=name;vseal.textContent=seal||"纪要";}

function openIntro(){
  vset("方舆经纬","总叙");
  pbody.innerHTML = `
   <div class="p-kicker">读史方舆纪要 · 顾祖禹撰</div>
   <div class="quote qxu">据山河形胜，论古今兴废。自唐虞三代，迄于有明，凡历代州域形势九卷、十五省方舆一百十四卷、川渎异同六卷、分野一卷。</div>
   <div class="p-cap">全书之纲</div>
   <div class="ful">
     <li data-go="形势"><span class="fn">历代州域形势</span><span class="fnow">卷一至九</span><span class="fct">九卷</span><span class="arrow">➤</span></li>
     <li data-go="舆图"><span class="fn">十五省方舆纪要</span><span class="fnow">卷十至一二三</span><span class="fct">${ST.f}府条</span><span class="arrow">➤</span></li>
     <li data-go="川渎"><span class="fn">川渎异同 · 分野</span><span class="fnow">卷一二四至一三〇</span><span class="fct">七卷</span><span class="arrow">➤</span></li>
     <li id="tolink"><span class="fn">地名古今对照表</span><span class="fnow">府州治所 ${ST.f+ST.z} 行</span><span class="fct">可导出</span><span class="arrow">➤</span></li>
   </div>
   <div class="stat-strip">
     <div class="st"><b>${ST.pf}</b><span>布政司</span></div>
     <div class="st"><b>${ST.f}</b><span>府·直隶州</span></div>
     <div class="st"><b>${ST.z}</b><span>属州</span></div>
     <div class="st"><b>${ST.x}</b><span>县</span></div>
   </div>
   ${(()=>{ const last=BM.getLast();
      if(!last) return "";
      let name="—";
      if(last.kind==="fu") name=last.fu;
      else if(last.kind==="js") name=(FYTEXT.juanshou&&FYTEXT.juanshou[last.i]||{t:"卷首"}).t;
      else if(last.kind==="era") name=ERAS[last.i].label+"纪";
      else name=(FY.chuandu[last.i]||{title:"川渎"}).title.slice(0,6);
      return `<div class="p-cap">续读</div>
        <div class="chips"><span class="chip jschip" id="resumebtn">⟳ ${name}</span></div>`;
   })()}
   <div class="p-cap">我的书签</div>
   <div class="chips" id="bmlist"></div>
   <div class="p-cap">卷首文献</div>
   <div class="chips" id="jschips">
     <span class="chip jschip" data-i="0">魏禧叙</span><span class="chip jschip" data-i="1">彭士望叙</span>
     <span class="chip jschip" data-i="2">总叙一</span><span class="chip jschip" data-i="3">总叙二</span>
     <span class="chip jschip" data-i="4">总叙三</span><span class="chip jschip" data-i="5">凡例二十六则</span>
     <span class="chip jschip" data-i="6">州域形势纪要序</span>
   </div>
   <div class="p-cap">使用</div>
   <div class="hint">舆图模式点府治印鉴观四至八到与沿革，点空白处取消省选；形势模式历览九朝都城要地，←/→ 或底部卷轴翻卷；川渎模式循六大水系，点沿流要邑入其府。顶栏检索全书千余州县名（回车直达）。府详情可阅原卷全文，正文地名可点、卷内州县可跳，字号可调，全篇可存为文本或打印（Ctrl+P 存 PDF）。Esc 收面板，? 唤出关于·校勘记。</div>`;
  pbody.querySelectorAll("[data-go]").forEach(el=>el.onclick=()=>setMode(el.dataset.go));
  pbody.querySelectorAll(".jschip[data-i]").forEach(c=>c.onclick=()=>openJuanshou(+c.dataset.i));
  const tl2 = pbody.querySelector("#tolink");
  if (tl2) tl2.onclick = ()=>openTable();
  const rb = pbody.querySelector("#resumebtn");
  if (rb) rb.onclick = ()=>bmGo(BM.getLast());
  const bl = pbody.querySelector("#bmlist");
  if (bl){
    const list = BM.load();
    bl.innerHTML = list.length
      ? list.map((b,i)=>`<span class="chip jschip bmitem" data-i="${i}" title="${b.prov}${b.now?" · 今"+b.now:""}">${b.fu}<i class="bmdel" data-d="${i}">✕</i></span>`).join("")
      : `<span class="chip small">尚无书签 —— 府详情页点 ☆ 收藏</span>`;
    bl.querySelectorAll(".bmitem").forEach(el=>el.onclick=e=>{
      const b = BM.load()[+el.dataset.i];
      if(!b) return;
      if (e.target.classList.contains("bmdel")){ BM.remove(b.pid, b.fu); openIntro(); return; }
      const p = FY.provinces.find(x=>x.id===b.pid);
      const u = p && p.fu.find(x=>x.n===b.fu);
      if (p && u){ setMode("舆图"); selectProv(p.id); openFu(p,u); }
    });
  }
  showPanel();
}

function openProv(p){
  vset(p.name,"方舆");
  const fuN=p.fu.length, zN=p.fu.reduce((s,u)=>s+u.zhou.length,0), xN=p.fu.reduce((s,u)=>s+u.xian.length,0);
  pbody.innerHTML = `
    <div class="p-kicker">${p.vols[0]}至${p.vols[p.vols.length-1]} · 凡${p.vols.length}卷</div>
    <div class="p-ju">${p.name}方舆纪要</div>
    <div class="stat-strip" style="margin:0 0 14px">
      <div class="st"><b>${fuN}</b><span>府·直隶州</span></div>
      <div class="st"><b>${zN}</b><span>属州</span></div>
      <div class="st"><b>${xN}</b><span>县</span></div>
    </div>
    <div class="p-cap">序</div>
    <div class="quote qxu">${p.xu}……</div>
    <div class="readrow"><button class="readfull" data-xu="1">阅序全文 ➤</button></div>
    <div class="p-cap">州域沿革</div>
    <div class="quote">${p.zhouyu}……</div>
    <div class="p-cap">府·直隶州</div>
    <ul class="ful">
      ${p.fu.map((u,i)=>`<li data-i="${i}">
        <span class="fn">${u.n}</span>
        <span class="fnow">${u.now?"今"+u.now:""}</span>
        <span class="fct">${u.zhou.length?"州"+u.zhou.length+" ":""}县${u.xian.length||u.xs}</span>
        <span class="arrow">➤</span></li>`).join("")}
    </ul>`;
  pbody.querySelectorAll(".ful li").forEach(li=>li.onclick=()=>{
    openFu(p,p.fu[+li.dataset.i]);
  });
  const xb = pbody.querySelector("[data-xu]");
  if (xb) xb.onclick = ()=>openXuText(p);
  showPanel();
}

function openFu(p,u){
  vset(u.n.replace(/(军民府|府|卫)$/,""),p.name.replace(/隶|省/g,"").slice(0,2));
  vseal.textContent = u.n.endsWith("州")?"直隶州":(u.n.endsWith("卫")?"卫":"府");
  let zhiRows="";
  if(u.zhi){
    const re=/(东南|东北|西南|西北|东|南|西|北)至([^，。]+?)([一二三四五六七八九十百零]+里)/g;
    let m;const rows=[];
    while((m=re.exec(u.zhi))) rows.push([m[1],m[2],m[3]]);
    zhiRows = rows.map(r=>`<div class="zhi"><span class="d">${r[0]}</span><span class="p">${r[1]}</span><span class="l">${r[2]}</span></div>`).join("");
  }
  const zchips = u.zhou.map(z=>`<span class="chip zhou">${z}</span>`).join("");
  const xchips = u.xian.filter(x=>x!==u.fg).slice(0,40).map(x=>`<span class="chip">${x}</span>`).join("")
    + (u.xian.length>40?`<span class="chip small">……余${u.xian.length-40}县</span>`:"");
  pbody.innerHTML = `
    <div class="p-kicker">${p.name} · ${p.vols[0]}至${p.vols[p.vols.length-1]}</div>
    <div>${u.now?`<div class="p-now">治今 ${u.now}</div>`:""}</div>
    ${u.note?`<div class="p-ju">${u.note}</div>`:""}
    <div class="readrow" style="margin:0 0 4px"><button class="readfull" data-ft="1">阅原卷全文 ➤</button><button class="star${BM.has(p.id,u.n)?' on':''}" data-st="1">${BM.has(p.id,u.n)?'★':'☆'} 书签</button></div>
    ${zhiRows?`<div class="p-cap">四至八到</div>${zhiRows}`:""}
    ${u.yan?`<div class="p-cap">沿革</div><div class="quote">${u.yan}……</div>`:""}
    <div class="p-cap">领属</div>
    <div class="chips">${u.fg?`<span class="chip fg" title="府郭附县">${u.fg} · 附郭</span>`:""}${zchips}</div>
    <div class="chips" style="margin-top:7px">${xchips||'<span class="chip small">无直领县</span>'}</div>
    ${u.zx.map(z=>`<div class="chips" style="margin-top:6px"><span class="chip zhou">${z.n}</span>${z.x.map(x=>`<span class="chip small">${x}</span>`).join("")}</div>`).join("")}
    <div class="p-cap">出处</div>
    <div class="hint">《读史方舆纪要》${p.name}方舆纪要 · ${p.vols.join("、")}。县名后〔今废〕〔新改〕等注记皆原书自注。</div>`;
  const fb = pbody.querySelector("[data-ft]");
  if (fb) fb.onclick = ()=>openFuText(p,u);
  const sb = pbody.querySelector("[data-st]");
  if (sb) sb.onclick = ()=>{
    const added = BM.toggle(p,u);
    sb.classList.toggle("on", added);
    sb.textContent = (added?"★":"☆") + " 书签";
  };
  if(u.c) safeFlyTo(u.c,7,{duration:1.1});
  if (typeof showJurisdiction === "function") showJurisdiction(p, u);
  if (typeof showFuHull === "function") showFuHull(p, u);
  if (typeof clearCountyTerritories === "function") clearCountyTerritories();
  if (typeof showCountyTerritories === "function") showCountyTerritories(p, u);
  syncHash("舆图", "p=" + p.id + "&fu=" + encodeURIComponent(u.n));
  showPanel();
}

function openEra(ei){
  const e=ERAS[ei], xs=FY.xingshi[ei];
  vset(e.label,"形势");
  pbody.innerHTML = `
    <div class="p-kicker">${xs.title} · ${xs.f.replace(".txt","")}</div>
    <div class="p-ju">${e.time}</div>
    <div class="p-cap">都城（朱印）</div>
    <div class="chips">${e.caps.map(c=>`<span class="chip fg">${c[0]}</span>`).join("")}</div>
    <div class="p-cap">要地</div>
    <div class="chips">${e.plcs.map(c=>`<span class="chip">${c[0]}</span>`).join("")}</div>
    <div class="hint" style="margin:2px 0 0">图上朱晕为疆域<b>示意</b>——以本卷所载都邑凸包外扩而成，非考证边界；虚线为王迹。</div>
    <div class="p-cap">纪要原文</div>
    <div class="quote">${xs.ex}……</div>
    <div class="p-cap">大事</div>
    ${e.evs.map((v,i)=>`<div class="ev${v[2]?' evg':''}" data-i="${i}"><span class="y">${v[0]}</span><span class="t">${v[1]}${v[2]?' <span class="evgo">➤</span>':''}</span></div>`).join("")}
    <div class="readrow"><button class="readfull" data-et="1">读本卷全文 ➤</button></div>`;
  const eb = pbody.querySelector("[data-et]");
  if (eb) eb.onclick = ()=>openEraText(ei);
  pbody.querySelectorAll(".evg").forEach(el=>{
    el.onclick = ()=>{
      const v = ERAS[ei].evs[+el.dataset.i];
      safeFlyTo(v[2], 6, {duration:1.1});
      const ring = L.circleMarker(v[2], {radius:16, weight:2.4, color:"#b23a2e",
        opacity:.9, fill:false, className:"evring"}).addTo(eraLayer);
      setTimeout(()=>eraLayer.removeLayer(ring), 3200);
    };
  });
  if (typeof tlSync === "function") tlSync(ei);
  syncHash("形势", "era=" + ei);
  showPanel();
}

function openRiver(r){
  const xs = FY.chuandu.find(c=>c.title.includes(r.key)) || {title:"川渎 · "+r.key,ex:""};
  vset(r.key,"川渎");
  pbody.innerHTML = `
    <div class="p-kicker">${xs.title.replace(/\u3000/g," · ")} · ${r.vols}</div>
    <div class="rv-meta">
      <span class="p-ju" style="margin:0">水道</span>
    </div>
    <div class="quote">${r.note}</div>
    ${xs.ex?`<div class="p-cap">纪要原文</div><div class="quote" >${xs.ex}……</div>`:""}
    <div class="p-cap">图式</div>
    <div class="hint">河线依今地图近似绘出；明季大河自开封以东夺泗入淮，与今行河异。漕河虚线为运河。点击诸水可循流观之。</div>
    <div class="readrow"><button class="readfull" data-rt="1">读原卷全文 ➤</button></div>`;
  const rb = pbody.querySelector("[data-rt]");
  if (rb) rb.onclick = ()=>openRiverText(r);
  syncHash("川渎", "r=" + encodeURIComponent(r.key));
  showPanel();
}

/* 关于 · 校勘记 */
function openAbout(){
  vset("关于","校勘");
  pbody.innerHTML = `
    <div class="p-kicker">方舆经纬 · 数据与体例</div>
    <div class="stat-strip" style="margin-top:2px">
      <div class="st"><b>130</b><span>卷</span></div>
      <div class="st"><b>${ST.f}</b><span>府级</span></div>
      <div class="st"><b>${ST.z}</b><span>属州</span></div>
      <div class="st"><b>${ST.x}</b><span>县</span></div>
      <div class="st"><b>50</b><span>关隘</span></div>
    </div>
    <div class="p-cap">源流</div>
    <div class="hint">文本取自国学导航分卷页面（GB2312 转 UTF-8），凡 130 卷并卷首；机器解析 193 府、187 属州、1104 县，整编 380 处治所今地坐标、50 处关隘；另有量距工具（Shift+两点）与 GeoJSON/KML 导出。底图 Esri World Physical，断网自动兜底。</div>
    <div class="p-cap">校勘约定</div>
    <div class="hint">损坏句淡显点线而不删原文；句内外来字符代以 □；县名〔今废〕〔新改〕等注皆原书自注；同地异写（军民府／州府）归一匹配。</div>
    <div class="p-cap">已知之阙</div>
    <div class="hint">向武、思陵二州未独立成篇（附见统辖州叙事）；土州坐标为近似；源站缺字以 □ 存疑。本地静态站点，管线 build_data / build_text，校验 verify.py。</div>`;
  showPanel();
}

/* 地名古今对照表：府州 380 行 / 县 1104 行 双页签 */
let tblLevel = "fu";
function openTable(level){
  if(level) tblLevel = level;
  vset("对照", "表");
  const rows = [];
  const isFu = tblLevel === "fu";
  if (isFu){
    FY.provinces.forEach(p=>p.fu.forEach(u=>{
      rows.push({a:u.n, b:u.n.endsWith("卫")?"卫":(u.n.endsWith("州")?"直隶州":"府"),
        c:p.name, d:u.fg||"", e:u.now||"", vol:p.vols[0], pid:p.id, fu:u.n, sub:false});
      (u.zx||[]).forEach(z=>{ if(z.c) rows.push({a:z.n, b:"属州", c:p.name, d:"", e:z.now||"",
        vol:p.vols[0], pid:p.id, fu:u.n, sub:true}); });
    }));
  } else {
    FY.provinces.forEach(p=>p.fu.forEach(u=>{
      u.xian.forEach(x=>rows.push({a:x, b:"县", c:p.name, d:u.n, vol:p.vols[0], pid:p.id, fu:u.n, sub:false}));
      (u.zx||[]).forEach(z=>z.x.forEach(x=>rows.push({a:x, b:"县", c:p.name, d:u.n+"·"+z.n, vol:p.vols[0], pid:p.id, fu:u.n, sub:true})));
    }));
  }
  rows.sort((r1,r2)=>r1.c===r2.c ? r1.a.localeCompare(r2.a,"zh") : r1.c.localeCompare(r2.c,"zh"));
  const head = isFu ? ["名","类","省","附郭","治今","卷"] : ["县","类","省","隶属","卷"];
  const body = rows.map((r,i)=>
    `<tr data-i="${i}" class="${r.sub?"sub":""}">
      <td class="tn">${r.a}</td><td>${r.b}</td><td class="tp2">${r.c}</td>
      <td class="tf">${r.d}</td>${isFu?`<td class="tw">${r.e}</td>`:""}<td class="tv">${r.vol}</td></tr>`).join("");
  pbody.innerHTML = `
    <div class="p-kicker">地名明今对照 · ${rows.length} 行</div>
    <div class="tabbar">
      <button class="tb ${isFu?"on":""}" data-l="fu">府州 ${isFu?rows.length:""}</button>
      <button class="tb ${!isFu?"on":""}" data-l="xian">县 ${!isFu?rows.length:""}</button>
      <button class="readfull" id="kmldl" style="margin-left:auto" title="Google Earth 格式">⤓ KML</button>
      <button class="readfull" id="geojsondl" title="全部治所点位（府/州/县）">⤓ GeoJSON</button>
      <button class="readfull" id="csvdl">⤓ CSV</button>
    </div>
    <input id="tfilter" type="text" placeholder="表内筛选：县名 / 省名 / 隶属…" autocomplete="off">
    <div class="tfcount" id="tfcount">${rows.length} 行</div>
    <div class="fywrap"><table class="fytable">
      <thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${body}</tbody></table></div>
    <div class="hint" style="margin-top:10px">${isFu
      ? "属州灰字；点击行入该府。今地为明治所当今位置，土州从近似。"
      : "州属县灰字、隶属列注其府与州；点击行入其府。〔今废〕〔新改〕等注为原书自注。"}</div>`;
  pbody.querySelectorAll(".tb").forEach(b=>b.onclick=()=>openTable(b.dataset.l));
  const fi = pbody.querySelector("#tfilter");
  if (fi) fi.oninput = ()=>{
    const q = fi.value.trim();
    let shown = 0;
    pbody.querySelectorAll(".fytable tbody tr").forEach(tr=>{
      const hit = !q || tr.innerText.includes(q);
      tr.style.display = hit ? "" : "none";
      if (hit) shown++;
    });
    pbody.querySelector("#tfcount").textContent = q ? shown + " / " + rows.length + " 行" : rows.length + " 行";
  };
  pbody.querySelectorAll("tr[data-i]").forEach(tr=>tr.onclick=()=>{
    const r = rows[+tr.dataset.i];
    const p = FY.provinces.find(x=>x.id===r.pid);
    const u = p.fu.find(x=>x.n===r.fu);
    if(mode!=="舆图") setMode("舆图");
    selectProv(p.id); openFu(p,u);
  });
  document.getElementById("kmldl").onclick = ()=>{
    let pins = "";
    FY.provinces.forEach(p=>p.fu.forEach(u=>{
      const mk = (nm, lat, lng, desc)=>{
        pins += `<Placemark><name>${nm}</name><description>${desc}</description>`
             +  `<Point><coordinates>${lng},${lat},0</coordinates></Point></Placemark>`;
      };
      if (u.c) mk(u.n, u.c[0], u.c[1], p.name + (u.now?" 今"+u.now:""));
      (u.zx||[]).forEach(z=>{ if(z.c) mk(z.n, z.c[0], z.c[1], p.name+"·"+u.n); });
      const xc = u.xianc || {};
      Object.keys(xc).forEach(nm=>{
        const dd = xc[nm];
        const pos = Array.isArray(dd) ? dd : dd.c;
        if (pos) mk(nm, pos[0], pos[1], p.name+"·"+u.n+"（"+(Array.isArray(dd)?"推算":(dd.type||"推算"))+"）");
      });
    }));
    const kml = `<?xml version="1.0" encoding="UTF-8"?>`
      + `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>`
      + `<name>方舆经纬·治所点位</name>`
      + `<Style id="fu"><IconStyle><color>ff2e5d6f</color><scale>1.2</scale></IconStyle></Style>`
      + pins + `</Document></kml>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([kml], {type:"application/vnd.google-earth.kml+xml"}));
    a.download = "方舆经纬-治所点位.kml";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
  };
  document.getElementById("geojsondl").onclick = ()=>{
    const feats = [];
    FY.provinces.forEach(p=>p.fu.forEach(u=>{
      if (u.c) feats.push({type:"Feature",
        geometry:{type:"Point",coordinates:[u.c[1], u.c[0]]},
        properties:{名:u.n, 类:u.n.endsWith("卫")?"卫":(u.n.endsWith("州")?"直隶州":"府"),
          省:p.name, 附郭:u.fg||"", 今地:u.now||"", 起始卷:p.vols[0], 依据:"整编"}});
      (u.zx||[]).forEach(z=>{ if(z.c) feats.push({type:"Feature",
        geometry:{type:"Point",coordinates:[z.c[1], z.c[0]]},
        properties:{名:z.n, 类:"属州", 省:p.name, 隶:u.n, 今地:z.now||"", 起始卷:p.vols[0], 依据:"整编"}}); });
      const xc = u.xianc || {};
      Object.keys(xc).forEach(nm=>{
        const d = xc[nm];
        const pos = Array.isArray(d) ? d : d.c;
        const typ = Array.isArray(d) ? "推算" : (d.type || "推算");
        const dir = Array.isArray(d) ? "" : (d.dir || "");
        const li = Array.isArray(d) ? "" : (d.li || "");
        feats.push({type:"Feature",
          geometry:{type:"Point",coordinates:[pos[1], pos[0]]},
          properties:{名:nm, 类:"县", 省:p.name, 隶:u.n, 今地:"", 起始卷:p.vols[0],
            依据:typ, 方位:dir, 原载里程:li ? li + "里" : ""}});
      });
    }));
    const gj = JSON.stringify({type:"FeatureCollection", features:feats});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([gj], {type:"application/geo+json"}));
    a.download = "方舆经纬-治所点位.geojson";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
  };
  document.getElementById("csvdl").onclick = ()=>{
    const NL = String.fromCharCode(10);
    const BOM = String.fromCharCode(0xFEFF);
    const csv = BOM + head.join(",") + NL +
      rows.map(r=>[r.a,r.b,r.c,r.d,r.e,r.vol].join(",")).join(NL);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    a.download = (isFu?"方舆经纬-府州对照":"方舆经纬-县对照") + ".csv";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
  };
  showPanel();
}


/* ── 县级信息卡 ── */
/* 汉数字 → 数值（一~百位："六十"→60，"一百二十三"→123） */
function cnNum(s){
  const D = {零:0,一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9}, U = {十:10,百:100};
  let n = 0, cur = 0;
  for (const ch of String(s)){
    if (D[ch] !== undefined) cur = D[ch];
    else if (U[ch]) { n += (cur || 1) * U[ch]; cur = 0; }
  }
  return n + cur;
}
function openCountyCard(p, u, nm, d, latlng){
  vset(nm.replace(/县$/,""), "县");
  vseal.textContent = "县";
  const isObj = !Array.isArray(d);
  const pos = isObj ? d.c : d;
  const typ = isObj ? (d.type || "推算") : "推算";
  const dir = isObj && d.dir ? d.dir : "";
  const li = isObj && d.li ? d.li : "";
  // 原文段首：优先已缓存，否则懒加载后补入
  let excerpt = "";
  const tryExcerpt = bag => {
    const fuTxt = bag && bag.fu && bag.fu[u.n];
    if (!fuTxt) return "";
    const i = fuTxt.indexOf(nm + "府");
    const j = i >= 0 ? i : fuTxt.indexOf("○" + nm);
    return j >= 0 ? fuTxt.slice(j, j + 160).split(String.fromCharCode(10)).join("") : "";
  };
  if (typeof FYTEXT !== "undefined" && FYTEXT[p.id]){
    excerpt = tryExcerpt(FYTEXT[p.id]);
  }
  if (!excerpt && typeof loadTextFile === "function"){
    loadTextFile(p.id, ok=>{
      if (ok && FYTEXT[p.id]){
        const e2 = tryExcerpt(FYTEXT[p.id]);
        if (e2){
          const q = pbody.querySelector(".quote");
          if (q) q.innerHTML = e2 + "……";
          else {
            // 插入到"操作"之前
            const cap = pbody.querySelector(".p-cap:nth-of-type(2)");
            if (cap) cap.insertAdjacentHTML("beforebegin",
              '<div class="p-cap">原文段首</div><div class="quote">' + e2 + '……</div>');
          }
        }
      }
    });
  }
  const km = li ? Math.round(cnNum(li) * 0.357) : null;
  pbody.innerHTML = `
    <div class="p-kicker">${p.name} · ${u.n}</div>
    <div class="stat-strip" style="margin-top:2px">
      <div class="st"><b>${typ}</b><span>定位类型</span></div>
      <div class="st"><b>${dir || "—"}</b><span>方位</span></div>
      <div class="st"><b>${li ? li + "里" : "—"}</b><span>原载里程</span></div>
      <div class="st"><b>${km !== null ? km + "km" : "—"}</b><span>折合直线</span></div>
    </div>
    ${excerpt ? `<div class="p-cap">原文段首</div><div class="quote">${excerpt}……</div>` : ""}
    <div class="p-cap">操作</div>
    <div class="readrow">
      <button class="readfull" id="gotoFu">➤ 入 ${u.n} 详情</button>
      ${typeof loadTextFile === "function" ? '<button class="readfull" id="readXian" style="margin-left:8px">📖 读原文</button>' : ""}
    </div>
    <div class="hint" style="margin-top:10px">坐标由原书「${dir ? `府${dir}${li}里` : "附郭"}」推算${km ? `，折合直线约 ${km} km` : ""}。</div>`;
  document.getElementById("gotoFu").onclick = ()=>openFu(p,u);
  const rb = document.getElementById("readXian");
  if (rb) rb.onclick = ()=>{
    renderText._q = nm;
    loadTextFile(p.id, ok=>{
      const bag = FYTEXT[p.id];
      const t = ok && bag && bag.fu && bag.fu[u.n];
      if (t) renderText(u.n, p.name+"方舆纪要", t, ()=>openCountyCard(p,u,nm,d,latlng), p.id,
        [u.fg,...u.zhou,...u.xian].filter(Boolean).map(x=>x.replace(/〔.*?〕/g,"")));
      else textFallback(u.n, ()=>openCountyCard(p,u,nm,d,latlng));
    });
  };
  if (typeof showJurisdiction === "function") showJurisdiction(p, u);
  showPanel();
  if(latlng) map.flyTo(latlng, 8, {duration:.8});
}
