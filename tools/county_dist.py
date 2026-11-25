# -*- coding: utf-8 -*-
"""县治距府治直线距离——论文 §三 数字之源（新数据复算）
口径唯一来源 tools/fy_geo.py（与 build_s5.py 同源，勿在此另写公式）"""
import json, re
from fy_geo import county_km, cn2num
src = open('data/site_data.js', encoding='utf-8').read()
FY = json.loads(re.search(r'const FY = (.+);$', src, re.S).group(1))
ds, zj = [], []
for p in FY['provinces']:
    for u in p['fu']:
        if not u.get('c'): continue
        for nm, d in (u.get('xianc') or {}).items():
            if d.get('type') == '附郭': continue
            la1, lo1 = d['c']; la2, lo2 = u['c']
            km = county_km(la1, lo1, la2, lo2)
            ds.append(km)
            if p['name'] == '浙江': zj.append(km)
ds.sort()
n = len(ds)
print(f"n={n} 中位 {ds[n//2]:.1f} km · Q3 {ds[int(n*.75)]:.0f} · P90 {ds[int(n*.9)]:.0f}")
print(f"浙江中位 {sorted(zj)[len(zj)//2]:.0f} km · 湖广中位 ", end='')
hg = []
for p in FY['provinces']:
    if p['name'] != '湖广': continue
    for u in p['fu']:
        if not u.get('c'): continue
        for nm, d in (u.get('xianc') or {}).items():
            if d.get('type') == '附郭': continue
            la1, lo1 = d['c']; la2, lo2 = u['c']
            hg.append(county_km(la1, lo1, la2, lo2))
hg.sort(); print(f"{hg[len(hg)//2]:.0f} km")
# 直线 → 驿路路程（÷ 驿路系数 0.62：tools/audit.py 以 277 条四至标定的「直线 / 驿路」比）
#      → 折算明里（1 明里 = 0.576 km，与 audit.py、站点量距工具及「透视」面板同口径）。
# 此前把「÷ 0.62」的结果直接标成「中位明里 ≈ 87 里」：87 是公里，不是里（2026-11-24 更正）。
_road_km = ds[n//2] / 0.62
print(f"驿路路程 ≈ {_road_km:.0f} km（直线 ÷ 驿路系数 0.62）· 折算明里 ≈ {_road_km / 0.576:.0f} 里")

# 原书自载里程中位（论文「原书里程中位 120 里」口径——直接引自原书，与上面的坐标推算口径不同）——cn2num 见 fy_geo
lis = []
for p in FY['provinces']:
    for u in p['fu']:
        for nm, d in (u.get('xianc') or {}).items():
            if d.get('li') and d.get('type') != '附郭':
                v = cn2num(str(d['li']))
                if v and 2 <= v <= 500: lis.append(v)
lis.sort()
print(f"原书里程 n={len(lis)} 中位 {lis[len(lis)//2]} 里")
