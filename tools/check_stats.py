# -*- coding: utf-8 -*-
"""数字哨兵：锚定论文（ANALYSIS.md / PDF）全部关键数字。
   node paper_stats.js 输出 → 逐数断言。语料/管线变动致漂移即红。"""
import subprocess, sys, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

r = subprocess.run(["node", "paper_stats.js"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
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
assert "东: 29294" in out, "方向偏好漂移"
print("  ✓ 东 29294")
assert "三门: 100" in out, "门数漂移"
assert "攻·金人: 31" in out, "攻守漂移"
print("  ✓ 金人 31")
assert "陷·台城: 21" in out, "围城漂移"
print("  ✓ 台城 21")
assert "旱: 201" in out, "灾害漂移"
assert "马: 3410" in out, "战略资源漂移"
print("  ✓ 马 3410")
assert "鼓角: 858" in out, "声景漂移"
assert "元: 8102" in out, "断代漂移"
print("  ✓ 元 8102")
assert "长城: 178" in out, "长城漂移"
assert "判断之冠: 山东 31.66" in out, "判断漂移"
print("  ✓ 山东判断 31.66")
print("  ✓ 长城 178")
print("  ✓ 鼓角 858")
print("  ✓ 旱 201")
print("  ✓ 三门 100")
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

# ── 空间锚（2026-11-18 补：数据考古新数字此前裸奔无守）──
import subprocess as _sp, re as _re2, os as _os2
ROOT2 = _os2.path.dirname(_os2.path.dirname(_os2.path.abspath(__file__)))
NODE_COV = (
    'const s = require("fs").readFileSync("data/site_data.js", "utf8");'
    'const FY = new Function(s + "; return FY;")();'
    'let tot = 0, have = 0;'
    'for (const p of FY.provinces) for (const u of p.fu) {'
    '  for (const nm of [...(u.xian||[]), ...(u.zx||[]).flatMap(z=>z.x||[])]) {'
    '    tot++;'
    '    if ((u.xianc||{})[nm.split("\u3014")[0]]) have++;'
    '  }'
    '}'
    'console.log(have + " " + tot);'
)
try:
    _r = _sp.run(["node", "-e", NODE_COV], capture_output=True, text=True, encoding="utf-8", errors="replace",
                 timeout=60, cwd=ROOT2)
    _have, _tot = map(int, _r.stdout.split())
    if _have == 1109 and _tot == 1111:
        print("  ✓ 县治覆盖 1109/1111（空间锚）")
    else:
        fails.append(f"县治覆盖 1109/1111（空间锚）: 实得 {_have}/{_tot}——build_data 回归即红")
except Exception as _e:
    fails.append(f"空间锚不可执行: {_e}")
_env2 = dict(_os2.environ, PYTHONIOENCODING="utf-8")   # 子进程输出统一 UTF-8（-I 会无视此变量——教训 22 同族）
_r2 = _sp.run([sys.executable, "tools/county_dist.py"], capture_output=True, text=True, encoding="utf-8", errors="replace",
              timeout=120, cwd=ROOT2, env=_env2)
_m = _re2.search(r"中位 ([\d.]+)", _r2.stdout or "")
if _m and abs(float(_m.group(1)) - 53.9) < 0.05:
    print("  ✓ 县距中位 53.9 km（空间锚）")
else:
    fails.append(f"县距中位 53.9 km（空间锚）: 实得 {_m.group(1) if _m else '无'}")
_m2 = _re2.search(r"里程 n=\d+ 中位 (\d+) 里", _r2.stdout or "")
if _m2 and int(_m2.group(1)) == 120:
    print("  ✓ 原书里程中位 120 里（空间锚·勘误口径）")
else:
    fails.append(f"原书里程中位 120 里（空间锚）: 实得 {_m2.group(1) if _m2 else '无'}")

print()
if fails:
    for f_ in fails: print("✗", f_)
    print(f"数字哨兵：{len(fails)} 项漂移 —— 论文数字与语料不一致，请复核 ANALYSIS.md")
    sys.exit(1)
print(f"数字哨兵：{len(CHECKS)}+3 项锚定全部一致 ✓")
