# -*- coding: utf-8 -*-
"""
方舆经纬 CLI 查询：python query.py 地名 [地名…]
  python query.py 桃源县
  python query.py 武昌府 应天府 山海关
  python query.py 大散关
"""
import json, sys, re, os

ROOT = os.path.dirname(os.path.abspath(__file__))
raw = open(os.path.join(ROOT, "data", "site_data.js"), encoding="utf-8").read()
data = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])

# 索引
IDX = {}
for p in data["provinces"]:
    for u in p["fu"]:
        IDX[u["n"]] = (u["n"], "府/直隶州", p["name"], p["name"], u.get("now", ""),
                        tuple(u.get("c", [])), p["vols"][0])
        for z in (u.get("zx") or []):
            IDX[z["n"]] = (z["n"], "属州", p["name"], u["n"], z.get("now", ""),
                            tuple(z.get("c", [])), p["vols"][0])
        for nm, pos in (u.get("xianc") or {}).items():
            IDX[nm] = (nm, "县（推算）", p["name"], u["n"], "", tuple(pos), p["vols"][0])

# 关隘（从 config.js 中提取 PASSES）
import re as _re
cfg = open(os.path.join(ROOT, "js", "config.js"), encoding="utf-8").read()
_pm = _re.search(r"const PASSES = (\[.*?\]);", cfg, _re.S)
if _pm:
    for q in json.loads(_pm.group(1)):
        IDX[q["n"]] = (q["n"], q.get("type", "关隘"), "", q.get("fu", ""), q.get("now", ""),
                        tuple(q["c"]), "")

def query(name):
    # 精确 → 前缀 → 包含
    for name2, info in IDX.items():
        if name2 == name:
            return info
    for name2, info in IDX.items():
        if name2.startswith(name):
            return info
    hits = [(n2, i) for n2, i in IDX.items() if name in n2]
    return hits[0][1] if len(hits) == 1 else (None, hits[:5] if hits else None)

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    for name in sys.argv[1:]:
        r = query(name)
        if r is None or (isinstance(r, tuple) and r[0] is None):
            print(f"  ✗ 「{name}」未找到")
            if isinstance(r, tuple) and r[1]:
                print(f"    近似：{'、'.join(h[0] for h in r[1])}")
            continue
        nm, tp, prov, fu, now, c, vol = r
        loc = f"[{c[0]:.2f}, {c[1]:.2f}]" if c else "—"
        now_s = f" 今{now}" if now else ""
        prov_s = f"{prov}·" if prov and prov != fu else ""
        vol_s = f" {vol}" if vol else ""
        print(f"  {nm}  {tp}  {prov_s}{fu}{now_s}  {loc}{vol_s}")

if __name__ == "__main__":
    main()
