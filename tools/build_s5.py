# -*- coding: utf-8 -*-
"""S5 生成：python tools/build_s5.py

县治距府治直线距离全量底账（n=962，论文 §三 / 表 1 之源）。
列：省, 府, 县, 直线km, 原书方位, 原书里程(里)。
UTF-8-BOM，Excel 中文直开；与 tools/county_dist.py 同一口径。
"""
import csv
import json
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "supplementary", "S5_county_distances.csv")

src = open(os.path.join(ROOT, "data", "site_data.js"), encoding="utf-8").read()
FY = json.loads(re.search(r"const FY = (.+);$", src, re.S).group(1))

CN = {"零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
      "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}

def cn2num(s):
    n = cur = 0
    for ch in s:
        if ch == "百":
            n += (cur or 1) * 100; cur = 0
        elif ch == "十":
            n += (cur or 1) * 10; cur = 0
        elif ch in CN:
            cur = CN[ch]
        else:
            return None
    return n + cur

rows = []
for p in FY["provinces"]:
    for u in p["fu"]:
        if not u.get("c"):
            continue
        for nm, d in (u.get("xianc") or {}).items():
            if d.get("type") == "附郭":
                continue
            la1, lo1 = d["c"]; la2, lo2 = u["c"]
            dx = (lo2 - lo1) * math.cos(math.radians((la1 + la2) / 2)) * 111.32
            dy = (la2 - la1) * 110.57
            km = math.hypot(dx, dy)
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
