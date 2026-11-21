# -*- coding: utf-8 -*-
"""方舆经纬 · 反向互查桥构建（站际桥 · 霞客/寰宇两子页）

把姊妹站已建成的单向桥（XXK→HHH、TPHY→HHH）补成双向：从方舆（府）视角
重组两源，构建期烘焙进本站 data/xrev.js（前端不跨目录读姊妹站）。

  霞客（XXK 徐霞客游记）：
    - 读 D:/W_A_W/XXK/data/intermediate/trips.json（300 锚，只读）+ trips_raw.json（原文句）
    - 匹配法与姊妹站 tools/build_xref_fy.py 完全一致（同名基名 → 省域消歧 →
      同名异地 MAXD=250km 防线），构建期与姊妹站发布数对账（175/125 不一致即红）
    - 产出：每省 → 府 → 到访锚点数 + 篇名/原文句样例 + 明末行踪年份跨度；
      无到访的府不计
  寰宇（TPHY 太平寰宇记）：
    - 读 D:/W_A_W/TPHY/data/xref_fy.js（宋 361 州 → 明府 对应，只读）+
      TPHY site_data.js（道 id / 州沿革，只读）
    - 产出：每府 → 宋对应条目（同名/升府/改名/明属州/存疑 分档徽标）+
      宋明沿革对读样例 + 明侧无对应名单

深链（相对兄弟路径 ../XXK/ ../TPHY/ —— 本地父目录同根服务与 GitHub Pages
项目页两种场景皆成立，见 README「经纬互查」节）：
  ../XXK/#trip=<id>&d=<日序>   循程而读直达当日
  ../TPHY/#dao=<道id>&zhou=<州名>  直达宋州卡
输出: data/xrev.js —— window.FY_XREV（js/xrev.js 懒加载，仿 sjz_xref 模式）。
凡计数出自本脚本。姊妹站目录零写入。"""
import datetime
import json
import math
import os
import re
import sys
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XXK = r"D:/W_A_W/XXK"
TPHY = r"D:/W_A_W/TPHY"
MAXD = 250                          # 同名异地防线（km），与 XXK build_xref_fy.py 同值
SUF = ("宣慰司", "军民", "府", "州", "县", "卫")

REL_LABEL = {"same": "同名", "promo": "升府", "rename": "改名",
             "mzhou": "明属州", "near": "存疑", "none": "无对应"}
REL_RANK = {"same": 0, "promo": 1, "rename": 2, "mzhou": 3, "near": 4}   # 府徽标取最优档
CN_M = {1: "正", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六",
        7: "七", 8: "八", 9: "九", 10: "十", 11: "十一", 12: "十二"}


def base(n):
    n = str(n).strip()
    for s in SUF:
        if n.endswith(s) and len(n) > len(s):
            return n[:-len(s)]
    return n


def hav(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * \
        math.sin(math.radians(b[1] - a[1]) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def load_hhh():
    raw = open(os.path.join(ROOT, "data", "site_data.js"), encoding="utf-8").read()
    fy = json.loads(re.search(r"const FY = (\{.*\});", raw, re.S).group(1))
    idx, fus, fus_now = {}, [], []
    for p in fy["provinces"]:
        for u in p["fu"]:
            if u.get("c"):
                fus.append((u["c"], p["id"], p["name"], u["n"]))
            e0 = {"pid": p["id"], "prov": p["name"], "fu": u["n"], "kind": "府", "c": u.get("c")}
            idx.setdefault(base(u["n"]), []).append(e0)
            if u.get("now"):
                fus_now.append(dict(e0, _now=u["now"]))
            for z in (u.get("zx") or []):
                idx.setdefault(base(z["n"]), []).append(
                    {"pid": p["id"], "prov": p["name"], "fu": u["n"], "kind": "属州", "c": z.get("c")})
                for x in z.get("x", []):
                    idx.setdefault(base(x), []).append(
                        {"pid": p["id"], "prov": p["name"], "fu": u["n"], "kind": "县", "c": None})
            for x in (u.get("xian") or []):
                idx.setdefault(base(x), []).append(
                    {"pid": p["id"], "prov": p["name"], "fu": u["n"], "kind": "县", "c": None})
            for x, dd in (u.get("xianc") or {}).items():
                c = dd if isinstance(dd, list) else dd.get("c")
                idx.setdefault(base(x), []).append(
                    {"pid": p["id"], "prov": p["name"], "fu": u["n"], "kind": "县", "c": c})
    return fy, idx, fus, fus_now


def match_anchor(a, idx, fus, fus_now):
    """与 XXK tools/build_xref_fy.py 同法：同名/今名 → 省域消歧 → MAXD 防线"""
    nm = base(a["name"])
    cands = list(idx.get(nm, []))
    how = "同名"
    if not cands:
        tod = re.sub(r"(县城|府城|市区|城区)$", "", a["today"])
        if len(tod) >= 2:
            for e in fus_now:
                if e["_now"] and (tod.startswith(e["_now"]) or e["_now"].startswith(tod)):
                    cands.append(e)
            how = "今名"
    if not cands:
        return None
    npid = min(fus, key=lambda f: hav(a["pos"], f[0]))[1]
    for c in cands:
        if c["pid"] == npid:
            return c
    pick = min(cands, key=lambda c: hav(a["pos"], c["c"]) if c.get("c") else 1e9)
    if pick.get("c") and hav(a["pos"], pick["c"]) <= MAXD:
        return pick
    return None


def context_sentence(raw_pieces, num, di, name):
    """当日正文找含锚名句（跳过编者括号注段）；取不到回退全篇搜索（同 XXK 法）"""
    days = None
    for p in raw_pieces:
        if p["num"] == num:
            days = p["days"]
            break
    if not days:
        return ""
    order = [di] + [i for i in range(len(days)) if i != di]
    for i in order:
        if i >= len(days):
            continue
        for para in days[i]["paras"]:
            t = para.strip()
            if not t or t.startswith(("(", "（")):
                continue
            if name in t:
                frag = next((s for s in re.split(r"[。！？]", t) if name in s), "")
                frag = frag.strip()
                if not frag:
                    frag = t[:60]
                return ("…" if len(frag) > 64 else "") + frag[:64]
    return ""


def date_label(dd):
    y, m, d = dd.get("y"), dd.get("m"), dd.get("d")
    s = f"{y}年" if y else ""
    if m:
        s += (CN_M.get(m, str(m)) if 1 <= (m or 0) <= 12 else str(m)) + "月"
    if d:
        s += f"{d}日"
    return s


def build_xk(fy, idx, fus, fus_now):
    trips = json.load(open(os.path.join(XXK, "data", "intermediate", "trips.json"), encoding="utf-8"))
    raw = json.load(open(os.path.join(XXK, "data", "intermediate", "trips_raw.json"), encoding="utf-8"))
    total = matched = 0
    provs = {}                                  # pid → {prov, n, y0, y1, tids, fus{fu→rec}}
    for t in trips["trips"]:
        for di, dd in enumerate(t["days"]):
            a = dd.get("anchor")
            if not a:
                continue
            total += 1
            hit = match_anchor(a, idx, fus, fus_now)
            if not hit:
                continue
            matched += 1
            pv = provs.setdefault(hit["pid"], {"prov": hit["prov"], "n": 0, "y0": 9999, "y1": 0,
                                               "tids": [], "fus": {}})
            pv["n"] += 1
            y0 = t.get("year0") or 0
            pv["y0"] = min(pv["y0"], y0)
            pv["y1"] = max(pv["y1"], y0)
            if t["id"] not in pv["tids"]:
                pv["tids"].append(t["id"])
            rec = pv["fus"].setdefault(hit["fu"], {"n": 0, "y0": 9999, "y1": 0,
                                                   "visits": [], "ex": [], "seen_trip": set()})
            rec["n"] += 1
            rec["y0"] = min(rec["y0"], y0)
            rec["y1"] = max(rec["y1"], y0)
            if t["id"] not in rec["seen_trip"]:
                rec["seen_trip"].add(t["id"])
                rec["visits"].append({"id": t["id"], "t": t["title"], "y": t["year"],
                                      "d": di, "date": date_label(dd)})
            if len(rec["ex"]) < 2:
                ctx = context_sentence(raw["pieces"], t["num"], di, a["name"])
                if ctx:
                    rec["ex"].append({"name": a["name"], "ctx": ctx, "t": t["title"],
                                      "href": f'../XXK/#trip={t["id"]}&d={di}'})

    by_prov = []
    for pid, pv in provs.items():
        fus_list = []
        for fu, rec in pv["fus"].items():
            rec.pop("seen_trip", None)
            rec["fu"] = fu
            fus_list.append(rec)
        fus_list.sort(key=lambda r: -r["n"])
        by_prov.append({"pid": pid, "prov": pv["prov"], "n": pv["n"],
                        "y0": pv["y0"], "y1": pv["y1"], "trips": len(pv["tids"]),
                        "fus": fus_list})
    by_prov.sort(key=lambda x: -x["n"])
    out = {"site": "../XXK/", "total": total, "matched": matched,
           "unmatched": total - matched, "fusHit": sum(len(x["fus"]) for x in by_prov),
           "provsHit": len(by_prov), "byProv": by_prov}

    # 构建期对账：与姊妹站发布数一致（xxk 数据变而匹配漂移 → 红，人工复核两站）
    xr = open(os.path.join(XXK, "data", "xref_fy.js"), encoding="utf-8").read()
    pub = json.loads(re.search(r"window\.XXK_FYXREF\s*=\s*(\{.*\});", xr, re.S).group(1))
    if (pub["total"], pub["matched"], pub["unmatched"]) != (total, matched, total - matched):
        print(f"✗ 霞客对账失败：本侧 {total}/{matched} vs 姊妹站 {pub['total']}/{pub['matched']}——两站匹配法需同步",
              file=sys.stderr)
        sys.exit(1)
    return out


def build_hy(fy):
    hy_raw = open(os.path.join(TPHY, "data", "site_data.js"), encoding="utf-8").read()
    hy = json.loads(re.search(r"const HY = (\{.*\});", hy_raw, re.S).group(1))
    dao_id = {d["name"]: d["id"] for d in hy["daos"]}
    zhou_yz = {z["n"]: (z.get("yz") or "") for z in hy["zhou"]}
    xr = open(os.path.join(TPHY, "data", "xref_fy.js"), encoding="utf-8").read()
    hx = json.loads(re.search(r"const HYXREF = (\{.*\});", xr, re.S).group(1))
    st = hx["stats"]

    # 姊妹站内部对账：rows 分档计数 == stats 口径
    from collections import Counter
    cnt = Counter(r["rel"] for r in hx["rows"])
    for k in ("same", "promo", "rename", "mzhou", "near", "none"):
        assert cnt[k] == st[k], f"TPHY rows/{k}={cnt[k]} != stats/{k}={st[k]}"

    # 明侧重组：每府 ← 宋对应条目（按 (mp,mf) 归并）
    mfu = {}
    for r in hx["rows"]:
        if not (r.get("mf") and r.get("mp")):
            continue
        song = {"z": r["z"], "rel": r["rel"], "ev": r.get("ev") or "",
                "href": f'../TPHY/#dao={dao_id[r["dao"]]}&zhou={quote(r["z"])}',
                "yz": zhou_yz.get(r["z"], "")[:80]}
        mfu.setdefault((r["mp"], r["mf"]), []).append(song)

    provs = {}
    for p in fy["provinces"]:
        pv = {"pid": p["id"], "prov": p["name"], "fus": [], "none": []}
        for u in p["fu"]:
            songs = mfu.get((p["id"], u["n"]))
            if not songs:
                pv["none"].append(u["n"])
                continue
            songs.sort(key=lambda s: REL_RANK.get(s["rel"], 9))
            pv["fus"].append({"fu": u["n"], "rel": songs[0]["rel"], "songs": songs,
                              "yan": (u.get("yan") or "")[:56]})
        pv["fus"].sort(key=lambda f: (-len(f["songs"]), f["fu"]))
        if pv["fus"] or pv["none"]:
            provs[p["id"]] = pv
    by_prov = sorted(provs.values(), key=lambda x: -len(x["fus"]))
    hit = sum(len(x["fus"]) for x in by_prov)
    miss = sum(len(x["none"]) for x in by_prov)
    assert hit == st["ming_fu_hit"] and hit + miss == st["ming_fu"], \
        f"明府归并 {hit}/{hit+miss} != stats {st['ming_fu_hit']}/{st['ming_fu']}"
    return {"site": "../TPHY/", "song": st, "ming": {"fu": st["ming_fu"], "hit": hit, "miss": miss},
            "byProv": by_prov}


def main():
    fy, idx, fus, fus_now = load_hhh()
    xk = build_xk(fy, idx, fus, fus_now)
    hy = build_hy(fy)
    out = {"built": datetime.date.today().isoformat(), "xk": xk, "hy": hy}
    with open(os.path.join(ROOT, "data", "xrev.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("/* 方舆经纬 · 经纬互查（霞客/寰宇 反向桥）· tools/build_xrev.py 生成，勿手改 */\n")
        f.write("window.FY_XREV = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")

    print(f"霞客：锚 {xk['total']}（入方舆 {xk['matched']} · 无对应 {xk['unmatched']}）"
          f"· {xk['provsHit']} 省 {xk['fusHit']} 府有游踪")
    for pv in xk["byProv"]:
        top = pv["fus"][0]
        print(f"  {pv['prov']} {pv['n']} 锚 · {pv['trips']} 篇（{pv['y0']}–{pv['y1']}）"
              f"· 首 {top['fu']} {top['n']}")
    hst, mst = hy["song"], hy["ming"]
    print(f"寰宇：宋 {hst['song_zhou']} 州 → 明对 {hst['matched']}"
          f"（同名 {hst['same']} · 升府 {hst['promo']} · 改名 {hst['rename']}"
          f" · 明属州 {hst['mzhou']} · 存疑 {hst['near']} · 无对应 {hst['none']}）")
    print(f"  明侧 {mst['fu']} 府：有宋源 {mst['hit']} · 无宋源 {mst['miss']}")
    print("→ data/xrev.js")


if __name__ == "__main__":
    main()
