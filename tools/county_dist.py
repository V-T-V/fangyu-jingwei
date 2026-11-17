# -*- coding: utf-8 -*-
"""县治距府治直线距离——论文 §三 数字之源（新数据复算）"""
import json, re, math
src = open('data/site_data.js', encoding='utf-8').read()
FY = json.loads(re.search(r'const FY = (.+);$', src, re.S).group(1))
ds, zj = [], []
for p in FY['provinces']:
    for u in p['fu']:
        if not u.get('c'): continue
        for nm, d in (u.get('xianc') or {}).items():
            if d.get('type') == '附郭': continue
            la1, lo1 = d['c']; la2, lo2 = u['c']
            dx = (lo2 - lo1) * math.cos(math.radians((la1 + la2) / 2)) * 111.32
            dy = (la2 - la1) * 110.57
            km = math.hypot(dx, dy)
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
            dx = (lo2 - lo1) * math.cos(math.radians((la1 + la2) / 2)) * 111.32
            dy = (la2 - la1) * 110.57
            hg.append(math.hypot(dx, dy))
hg.sort(); print(f"{hg[len(hg)//2]:.0f} km")
print(f"中位明里 ≈ {ds[n//2] / 0.62:.0f} 里（驿路系数 0.62）")

# 原书里程中位（论文「中位 150 里」口径）
CN = {'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9}
def cn2num(s):
    n = cur = 0
    for ch in s:
        if ch == '百': n += (cur or 1)*100; cur = 0
        elif ch == '十': n += (cur or 1)*10; cur = 0
        elif ch in CN: cur = CN[ch]
        else: return None
    return n + cur
lis = []
for p in FY['provinces']:
    for u in p['fu']:
        for nm, d in (u.get('xianc') or {}).items():
            if d.get('li') and d.get('type') != '附郭':
                v = cn2num(str(d['li']))
                if v and 2 <= v <= 500: lis.append(v)
lis.sort()
print(f"原书里程 n={len(lis)} 中位 {lis[len(lis)//2]} 里")
