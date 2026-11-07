/* ═══════════ 方舆经纬 · 书签与续读（localStorage 持久化） ═══════════ */

const BM = {
  KEY: "fybm", LAST: "fylast", MAX: 30,
  load(){ try{ return JSON.parse(localStorage.getItem(BM.KEY) || "[]"); }catch(e){ return []; } },
  save(a){ try{ localStorage.setItem(BM.KEY, JSON.stringify(a.slice(0, BM.MAX))); }catch(e){} },
  has(pid, fu){ return BM.load().some(b=>b.pid===pid && b.fu===fu); },
  toggle(p, u){
    let a = BM.load();
    const i = a.findIndex(b=>b.pid===p.id && b.fu===u.n);
    if (i >= 0) a.splice(i, 1);
    else a.unshift({pid:p.id, fu:u.n, prov:p.name, now:u.now||"", ts:Date.now()});
    BM.save(a);
    return i < 0;                       // 返回是否新增
  },
  remove(pid, fu){
    BM.save(BM.load().filter(b=>!(b.pid===pid && b.fu===fu)));
  },
  setLast(item){ try{ localStorage.setItem(BM.LAST, JSON.stringify(item)); }catch(e){} },
  getLast(){ try{ return JSON.parse(localStorage.getItem(BM.LAST) || "null"); }catch(e){ return null; } },
};

/* 续读/书签 → 打开目标 */
function bmGo(it){
  if (!it) return;
  if (it.kind === "fu"){
    const p = FY.provinces.find(x=>x.id===it.pid);
    const u = p && p.fu.find(x=>x.n===it.fu);
    if (p && u){ setMode("舆图"); selectProv(p.id); openFu(p,u); }
  } else if (it.kind === "js"){
    openJuanshou(it.i);
  } else if (it.kind === "era"){
    setMode("形势"); buildEra(it.i); openEra(it.i); highlightRail("形势", it.i);
  } else if (it.kind === "cd"){
    const c = FY.chuandu[it.i];
    const river = RIVERS.find(x=>c.title.includes(x.key)) || RIVERS[0];
    setMode("川渎"); openRiver(river); highlightRail("川渎", river.key);
  }
}
