# -*- coding: utf-8 -*-
"""S5 生成：python tools/build_s5.py

县治距府治直线距离全量底账（n=962，论文 §三 / 表 1 之源）。
列：省, 府, 县, 直线km, 原书方位, 原书里程(里)。
UTF-8-BOM，Excel 中文直开；口径唯一来源 tools/fy_geo.py（county_dist.py 同源）。
"""
import csv
import json
import os
import re

from fy_geo import cn2num, county_km

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "supplementary", "S5_county_distances.csv")

src = open(os.path.join(ROOT, "data", "site_data.js"), encoding="utf-8").read()
FY = json.loads(re.search(r"const FY = (.+);$", src, re.S).group(1))

rows = []
for p in FY["provinces"]:
    for u in p["fu"]:
        if not u.get("c"):
            continue
        for nm, d in (u.get("xianc") or {}).items():
            if d.get("type") == "附郭":
                continue
            la1, lo1 = d["c"]; la2, lo2 = u["c"]
            km = county_km(la1, lo1, la2, lo2)
            li = cn2num(str(d.get("li", ""))) if d.get("li") else None
            rows.append([p["name"], u["n"], nm, round(km, 2), d.get("dir", ""), li if li else ""])

rows.sort(key=lambda r: r[3])
with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["省", "府", "县", "直线km", "原书方位", "原书里程(里)"])
    w.writerows(rows)
mid = rows[len(rows) // 2][3]
print(f"S5 → {OUT}")
print(f"n={len(rows)} · 中位 {mid} km（论文 §三 口径）")
