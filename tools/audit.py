# -*- coding: utf-8 -*-
"""
坐标方位审计：以原书「四至八到」交叉验证整编坐标。
对每条 可解析的 至X府/州N里：
  · 距离比 = 球面距离(km) / (N里 × 0.576km)   —— 明里约 576m
  · 方位差 = 实际方位角 与 所载方向 的偏差
列出 距离比 > 2.2 或 < 0.45 的条目供人工复核。
"""
import json, re, math

import os as _os
_os.chdir(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
raw = open("data/site_data.js", encoding="utf-8").read()
data = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])

# 坐标总表（府 + 属州）
COORD = {}
for p in data["provinces"]:
    for u in p["fu"]:
        if u.get("c"):
            COORD[(p["id"], u["n"])] = u["c"]
        for z in u.get("zx", []):
            if z.get("c"):
                COORD[(p["id"], z["n"])] = z["c"]
NAME2 = {}
for (pid, n), c in COORD.items():
    NAME2.setdefault(n, []).append((pid, c))

DIRS = {"东": 90, "南": 180, "西": 270, "北": 0,
        "东南": 135, "西南": 225, "东北": 45, "西北": 315}

def hav(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2*R*math.asin(math.sqrt(h))

def bearing(a, b):
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    y = math.sin(lo2-lo1)*math.cos(la2)
    x = math.cos(la1)*math.sin(la2)-math.sin(la1)*math.cos(la2)*math.cos(lo2-lo1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360

def angdiff(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)

CN_NUM = "一二三四五六七八九十百"

def _cn(s):
    # 简易中文数字（覆盖 一~九十九/百 量级）
    tokens = {"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9}
    total, num = 0, 0
    i = 0
    while i < len(s):
        ch = s[i]
        if ch in tokens:
            num = tokens[ch]
            if i + 1 < len(s) and s[i+1] == "百":
                total += num * 100; num = 0; i += 2; continue
            i += 1
        elif ch == "百":
            total += 100; i += 1
        elif ch == "十":
            total += (num or 1) * 10; num = 0; i += 1
        else:
            i += 1
    return str(total + num)

rows = []
allr = []
for p in data["provinces"]:
    for u in p["fu"]:
        if not u.get("c") or not u.get("zhi"):
            continue
        for m in re.finditer(r"(东南|东北|西南|西北|东|南|西|北)至([^，。]{2,12}?)([一二三四五六七八九十百]+)里", u["zhi"]):
            d, tgt, li = m.group(1), m.group(2), m.group(3)
            # 目标解析：优先本省府/州名，其次裸名
            key = (p["id"], tgt)
            if key not in COORD:
                cands = [c for n2, lst in NAME2.items() for c in lst if n2 in tgt]
                key2 = None
                for n2 in (tgt, tgt.replace("府", ""), tgt.replace("州", "")):
                    if (p["id"], n2) in COORD:
                        key2 = (p["id"], n2); break
                if key2:
                    key = key2
                elif cands:
                    continue                      # 他省同名，歧义跳过
                else:
                    continue
            km_li = len(li) and int(_cn(li)) * 0.576
            dist = hav(u["c"], COORD[key])
            ratio = dist / km_li if km_li else None
            dev = angdiff(bearing(u["c"], COORD[key]), DIRS[d])
            if ratio:
                allr.append(ratio)
                if (ratio > 2.2 or ratio < 0.45) and dist > 30:
                    rows.append((ratio, dev, p["name"], u["n"], d, tgt, m.group(3), round(dist)))

allr.sort()
med = allr[len(allr)//2] if allr else 0
print(f"可解析四至 {len(allr)} 条 · 距离比（直线/载里）中位数 {med:.2f}")
print(f"—— 原书载驿路里程，直线≈其 {med:.0%}，系统一致；方位偏差小者坐标可信")
print(f"可疑条目 {len(rows)} 条（比值离谱且>30km，供人工复核）：\n")
print(f"{'比值':>5} {'方位差':>5}  条目")
for r in rows[:40]:
    print(f"{r[0]:5.1f} {r[1]:5.0f}°  {r[2]}{r[3]} {r[4]}至{r[5]}{r[6]}里 (实距{r[7]}km)")
