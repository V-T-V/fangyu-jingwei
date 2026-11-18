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
print(f"中位明里 ≈ {ds[n//2] / 0.62:.0f} 里（驿路系数 0.62）")

# 原书里程中位（论文「中位 120 里」口径·勘误后）——cn2num 见 fy_geo
lis = []
for p in FY['provinces']:
    for u in p['fu']:
        for nm, d in (u.get('xianc') or {}).items():
            if d.get('li') and d.get('type') != '附郭':
                v = cn2num(str(d['li']))
                if v and 2 <= v <= 500: lis.append(v)
lis.sort()
print(f"原书里程 n={len(lis)} 中位 {lis[len(lis)//2]} 里")
