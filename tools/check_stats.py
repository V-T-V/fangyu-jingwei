# -*- coding: utf-8 -*-
"""数字哨兵：锚定论文（ANALYSIS.md / PDF）全部关键数字。
   node paper_stats.js 输出 → 逐数断言。语料/管线变动致漂移即红。"""
import subprocess, sys, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

r = subprocess.run(["node", "paper_stats.js"], capture_output=True, text=True, timeout=120)
out = r.stdout
if r.returncode:
    print("✗ paper_stats.js 执行失败"); sys.exit(1)

def val(pattern, cast=float):
    m = re.search(pattern, out)
    return cast(m.group(1)) if m else None

# (描述, 抓取式, 期望值, 容差)  —— 与 ANALYSIS.md §三/四 一一对应
CHECKS = [
    # 卷帙与语汇（表 3）
    ("南直隶卷帙 35.5万",        r"南直隶 \| (\d+\.\d) \|",        35.5, 0.05),
    ("浙江语汇密度 10.47",       r"浙江 \| 15\.\d \| \d+ \| (\d+\.\d+)", 10.47, 0.05),
    ("山东语汇密度 2.89",        r"山东 \| 12\.\d \| \d+ \| (\d+\.\d+)", 2.89, 0.05),
    # 引书榜（§4.4）
    ("水经注 924",               r"水经注: (\d+)",              924, 0),
    ("左传 351",                 r"左传: (\d+)",                351, 0),
    ("城邑考 216",               r"城邑考: (\d+)",              216, 0),
    # 时代层（§4.5）
    ("明初 1499",                r"明初:(\d+)",                 1499, 0),
    ("五代 893",                 r"五代:(\d+)",                 893, 0),
    # 里程（§4.6）
    ("方位里程中位 35",          r"中位 (\d+) 里 · 均值",        35, 0),
    ("里程 P95 150",             r"P95 (\d+)",                  150, 0),
    # 山河（§4.7）
    ("太行 225",                 r"山·太行: (\d+)",             225, 0),
    ("大江 829",                 r"水·大江: (\d+)",             829, 0),
    # 城周（§4.7）
    ("城周中位 5",               r"城周金字塔（n=\d+） ---\n中位 (\d+) 里", 5, 0),
    # 动词（§4.8）
    ("河南动词 105.17",          r"攻守动词密度 TOP6[\s\S]*?河南 (\d+\.\d+)", 105.17, 0.05),
    ("广东动词 40.99",           r"攻守动词密度 TOP6[\s\S]*?垫底3[\s\S]*?广东 (\d+\.\d+)", 40.99, 0.05),]

# 山河密度（§4.7）
assert "水之冠 南直隶 26.5" in out, "水之冠漂移"
print("  ✓ 水之冠 南直隶 26.5")
assert "山之冠 河南 7.9" in out, "山之冠漂移"
assert "洪武: 1678" in out, "年号漂移"
print("  ✓ 洪武 1678")
assert "嘉靖: 1450" in out, "年号漂移"
print("  ✓ 嘉靖 1450")
assert "水经注: 山东 8.9" in out, "引书×地域漂移"
print("  ✓ 水经注·山东 8.9")
print("  ✓ 山之冠 河南 7.9")

fails = []
for name, pat, exp, tol in CHECKS:
    v = val(pat)
    if v is None:
        fails.append(f"{name}: 未匹配（输出格式变？）")
    elif abs(v - exp) > tol:
        fails.append(f"{name}: 得 {v} 期望 {exp}±{tol}")
    else:
        print(f"  ✓ {name} = {v}")

print()
if fails:
    for f_ in fails: print("✗", f_)
    print(f"数字哨兵：{len(fails)} 项漂移 —— 论文数字与语料不一致，请复核 ANALYSIS.md")
    sys.exit(1)
print(f"数字哨兵：{len(CHECKS)} 项锚定全部一致 ✓")
