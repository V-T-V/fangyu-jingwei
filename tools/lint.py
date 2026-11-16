# -*- coding: utf-8 -*-
"""方舆经纬 Lint——把 19 条工程教训从「文字规则」升格为「确定性检查」。
   Lauren Tan 信任金字塔实践：修 agent 不加规则，变成 lint。
   python tools/lint.py  →  0 = 全过 / 1 = 有违规"""
import os, re, sys, glob, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
fails = []

def check(ok, msg):
    if ok:
        print(f"  ✓ {msg}")
    else:
        fails.append(msg)
        print(f"  ✗ {msg}")

print("═══ 方舆经纬 Lint · 教训→确定性 ═══")

# ── L1: 版本一致性（教训 11/13：?v= 必须全站同号）──
print("── 1. 版本一致性")
idx = open('index.html', encoding='utf-8').read()
sw = open('sw.js', encoding='utf-8').read()
m = re.search(r'\?v=(\d+)', idx)
idx_v = m.group(1) if m else "?"
m2 = re.search(r'VERSION = "v(\d+)"', sw)
sw_v = m2.group(1) if m2 else "?"
check(idx_v == sw_v, f"index ?v={idx_v} == sw VERSION v{sw_v}")
# 全站检查（教训 13：用 glob 不用清单）
all_v = set(re.findall(r'\?v=(\d+)', idx))
check(len(all_v) <= 1, f"index.html 版本唯一（实得 {all_v}）")
for f in ['3d.html'] + glob.glob('tests/*.html'):
    c = open(f, encoding='utf-8').read()
    fv = set(re.findall(r'\?v=(\d+)', c))
    bad = fv - {idx_v}
    check(not bad, f"{f} 版本对齐（杂散 {bad or '无'}）")

# ── L2: 目录结构（教训：仓库理整后的约定）──
print("── 2. 目录结构")
for f in glob.glob('test_*.html'):
    check(False, f"根目录残留测试页 {f} → 应在 tests/")
for f in glob.glob('js/ftworker.js'):
    check(True, f"Worker 在 js/ ✓")
check(os.path.exists('tools/'), "tools/ 目录存在")
check(os.path.exists('docs/supplementary/'), "配套数据目录存在")

# ── L3: 数据完整性计数（教训 14：口径纪律）──
print("── 3. 数据完整性")
raw = open('data/site_data.js', encoding='utf-8').read()
sd = json.loads(raw[raw.find('{'): raw.rfind('}')+1])
fu = sum(len(p['fu']) for p in sd['provinces'])
check(fu == 193, f"府数 193（实得 {fu}）")
zx = sum(len(u.get('zx') or []) for p in sd['provinces'] for u in p['fu'])
check(zx == 187, f"属州 187（实得 {zx}）")
xian = sum(len(u.get('xianc') or {}) for p in sd['provinces'] for u in p['fu'])
check(xian >= 1090, f"县治 ≥1090（实得 {xian}）")
# 富对象格式（教训：县卡需要 dir/li/type）
rich = sum(1 for p in sd['provinces'] for u in p['fu']
           for d in (u.get('xianc') or {}).values() if isinstance(d, dict))
check(rich >= xian * 0.99, f"县治富对象格式 ≥99%（实得 {rich}/{xian}）")

# ── L4: 哨兵锚数下限（教训 19：数字要被守护）──
print("── 4. 哨兵覆盖")
sent = open('tools/check_stats.py', encoding='utf-8').read()
anchor_count = sent.count('assert') + sent.count('("',)
check(anchor_count >= 25, f"数字哨兵 ≥25 锚（实得 {anchor_count}）")

# ── L5: 跨文件引用安全（教训 17：闭包量不经 window）──
print("── 5. 闭包安全")
for f in glob.glob('js/*.js'):
    c = open(f, encoding='utf-8').read()
    # window._xxx 赋值（let 闭包量不在 window 上）
    wlet = re.findall(r'window\._ftw\b', c)
    if wlet:
        check(False, f"{f}: window._ftw 是 let 闭包量（教训 17）→ 用存取函数")

# ── L6: SW 缓存清单覆盖（教训 13：清单式变更）──
print("── 6. SW 覆盖")
shell_files = re.findall(r'"(\./[^"]+)"', sw)
check(len(shell_files) >= 20, f"SW SHELL ≥20 文件（实得 {len(shell_files)}）")

# ── L7: 文档同步（教训：md 改了 PDF 忘排）──
print("── 7. 文档同步")
import subprocess
r = subprocess.run([sys.executable, 'tools/check_docs_sync.py'], capture_output=True, text=True, timeout=30)
check('✓' in r.stdout, "md↔PDF 同步")

# ── L8: JS 语法（教训：静默失败）──
print("── 8. JS 语法")
bad_js = []
for f in sorted(glob.glob('js/*.js')):
    r2 = subprocess.run(['node', '--check', f], capture_output=True, timeout=10)
    if r2.returncode:
        bad_js.append(f)
check(not bad_js, f"js/*.js 语法（坏 {bad_js}）")

# ── L9: 大文件预警（教训：API 截断→拆文件）──
print("── 9. 大文件预警")
for f in glob.glob('js/*.js'):
    n = len(open(f, encoding='utf-8').readlines())
    if n > 700:
        check(False, f"{f} {n} 行 > 700（考虑拆分，教训：API 截断）")

print()
if fails:
    for f_ in fails:
        print(f"✗ {f_}")
    print(f"Lint：{len(fails)} 项违规")
    sys.exit(1)
print(f"Lint：全过 ✓")
