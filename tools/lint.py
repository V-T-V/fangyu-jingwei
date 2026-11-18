# -*- coding: utf-8 -*-
"""方舆经纬 Lint——把 19 条工程教训从「文字规则」升格为「确定性检查」。
   Lauren Tan 信任金字塔实践：修 agent 不加规则，变成 lint。
   python tools/lint.py  →  0 = 全过 / 1 = 有违规"""
import os, re, sys, glob, json
FIX = "--fix" in sys.argv

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
    if bad and FIX:
        # 自愈：对齐到 index.html 版本
        c = open(f, encoding='utf-8').read()
        c2 = re.sub(r'\?v=\d+', f'?v={idx_v}', c)
        open(f, 'w', encoding='utf-8').write(c2)
        print(f"  🔧 {f}: 版本对齐 → v={idx_v}")
    elif bad:
        check(False, f"{f} 版本对齐（杂散 {bad}）— try --fix")
    else:
        check(True, f"{f} 版本对齐")

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
r = subprocess.run([sys.executable, 'tools/check_docs_sync.py'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30)
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


# ── L10: 危险 API 禁用（Lauren Tan 实践 1：useEffect 等价物）──
print("── 10. 危险 API")
DANGEROUS = [
    # (pattern, file_glob, message)
    (r'map\.fire\("click"', 'tests/*.html',
     'map.fire("click") 委托分发不可靠（§4 排档档）→ canvas.dispatchEvent'),
    (r'innerHTML\.indexOf\("mode=', 'tests/*.html',
     'innerHTML 含 &amp; 序列化（教训：&→&amp;）→ 用 href 或 textContent'),
    (r'git mv -q', 'tools/*.py',
     'git mv -q 不存在 → 去掉 -q'),
]
for pat, fglob, msg in DANGEROUS:
    hits = []
    import glob as _g
    for f in _g.glob(fglob):
        if 'lint.py' in f: continue
        c = open(f, encoding='utf-8').read()
        if re.search(pat, c):
            hits.append(f)
    check(not hits, f"API 禁用：{msg[:30]}...（违 {hits[:3] or '无'}）")

# ── L11: Worker 无 DOM（Lauren Tan 实践 2：目录即上下文）──
print("── 11. 架构约束")
w = open('js/ftworker.js', encoding='utf-8').read()
dom_refs = re.findall(r'(?:document|window)\.', w)
# postMessage 的 self 不算
check(len(dom_refs) == 0, f"Worker 不引用 DOM（实得 {len(dom_refs)} 处 {dom_refs[:3]}）")

# 核心模块不引用特性模块的 DOM ID
core = open('js/map.js', encoding='utf-8').read() + open('js/panels.js', encoding='utf-8').read()
feature_ids = re.findall(r'id="(?:wxheat|densbtn|tourbtn|cambmk)"', 
                         open('js/wenxin.js', encoding='utf-8').read() + open('js/map3d.js', encoding='utf-8').read())
check(not feature_ids or not any(fid in core for fid in feature_ids),
      f"核心模块不含特性模块 DOM ID（{feature_ids[:3]}）")

# 脚本加载顺序（defer 依赖链）
scripts = re.findall(r'<script src="js/(\w+)\.js', idx)
expected_order = ['config', 'map', 'panels', 'rail', 'search', 'reader',
                  'bookmarks', 'ft_core', 'fulltext', 'app', 'modes', 'analytics', 'wenxin', 'bian']
actual_order = [s for s in scripts if s in expected_order]
check(actual_order == expected_order[:len(actual_order)],
      f"脚本 defer 顺序符合依赖链（{actual_order}）")

# 核心→特性裸引用（app.js:101 案：裸引后加载模块 = 加载即崩，101 行后绑定全灭）
CORE_FILES = ['js/config.js', 'js/map.js', 'js/panels.js', 'js/rail.js', 'js/search.js',
              'js/reader.js', 'js/bookmarks.js', 'js/fulltext.js', 'js/app.js', 'js/modes.js']
bare_feature = []
for f in CORE_FILES:
    src = re.sub(r'/\*.*?\*/', '', open(f, encoding='utf-8').read(), flags=re.S)   # 剥块注释（禁令文档表述不算）
    src = re.sub(r'//[^\n]*', '', src)                                             # 剥行注释
    for m in re.finditer(r'(?<![\w"\'])(openAnalytics|openWenxin|openBian)\b', src):
        pre = src[max(0, m.start() - 120):m.start()]
        if pre.endswith('typeof '):              # typeof 操作数位置豁免
            continue
        if ('typeof ' + m.group(1)) in pre:      # 守卫窗内调用豁免
            continue
        if ('function ' + m.group(1)) in pre:        # 定义处豁免
            continue
        bare_feature.append(f + ':' + m.group(1))
check(not bare_feature, f"核心链无特性函数裸引用（实得 {bare_feature}）——一律 typeof 守卫（AGENTS 架构分层）")

# done() 完成判定必须 FAIL 反查（v118 教训：正向 PASS 包含遇 SKIP-PASS/局部失败即假绿，
# 本轮 11 页改反向判定，此检查防复发；R3D 标题协议两页豁免——协议不同，同 run_tests.py CDP_PAGES）
# 同条扩展（I2）：catch 里裸 log.push("…ERR…"+e) 不含 FAIL——异常吞行同样过 done() 假绿，一律 P(x,false)
R3D_PAGES = {'tests/test_3d.html', 'tests/test_ft_worker.html'}
POS_PASS = re.compile(r'\.(?:in' + r'cludes|in' + r'dexOf)\(\s*["\']P' + r'ASS["\']\s*\)')
BARE_ERR_PUSH = re.compile(r'log\s*\.\s*' + r'push\s*\(\s*[`"\'][^`"\']*E' + r'RR')   # 拼接防自指
pos_pass = [f for f in sorted(glob.glob('tests/*.html'))
            if f not in R3D_PAGES and POS_PASS.search(open(f, encoding='utf-8').read())]
err_push = [f + ':' + str(i + 1) for f in sorted(glob.glob('tests/*.html'))
            for i, ln in enumerate(open(f, encoding='utf-8').read().splitlines())
            if BARE_ERR_PUSH.search(ln)]
check(not pos_pass and not err_push,
      f"完成判定 FAIL 反查＋异常行 P 化（正向包含违 {pos_pass[:3]}，裸 ERR push 违 {err_push[:3]}）"
      "——正向包含遇 SKIP 即假绿，catch 裸 ERR push 无 FAIL 同假绿（v118 教训）")

# 数据全局加载一致性（「文柱空转」教训：js 引用数据全局，载它的入口页必须同载对应
# data 脚本——test_3d 自载语料曾致测试恒绿而生产断链；引用与加载必须同页成对）
DATA_PAIRS = [(r'FY_' + 'MENTIONS', 'data/me' + 'ntions.js'),             # 拼接：规则字面量不自指
              (r'(?<![A-Za-z0-9_])FY(?![A-Za-z0-9_])', 'data/site_' + 'data.js')]
missing_data = []
for page in ('index.html', '3d.html'):
    html = open(page, encoding='utf-8').read()
    for jf in re.findall(r'<script src="js/([\w.-]+\.js)', html):
        if not os.path.exists('js/' + jf):
            continue
        src = open('js/' + jf, encoding='utf-8').read()
        for gpat, dscript in DATA_PAIRS:
            if re.search(gpat, src) and dscript not in html:
                missing_data.append(f"{page} 载 {jf} 缺 {dscript}")
check(not missing_data, f"数据全局与入口加载成对（缺 {missing_data[:3]}）——FY_MENTIONS→mentions.js · FY→site_data.js（文柱空转教训）")

# ── L12: 借口注释（Lauren Tan 实践 3 的温和版）──
print("── 12. 借口注释")
import glob as _g2
todo_hits = []
for f in sorted(_g2.glob('js/*.js') + _g2.glob('tools/*.py')):
    for i, line in enumerate(open(f, encoding='utf-8'), 1):
        # TODO/FIXME/HACK = 借口（ Lauren Tan：agent 把它当「这事很难所以我不做对」的通行证）
        if re.search(r'(?:TODO|FIXME|HACK)', line, re.I):
            todo_hits.append(f"{f}:{i}")
        # 超 3 行连续注释（可能是用注释代替代码）
check(len(todo_hits) <= 3, f"TODO/FIXME/HACK ≤3（实得 {len(todo_hits)}：{todo_hits[:3]}）")

# ── L13: 吞错禁用（教训 20：竖线竖线 true 把「确定坏了」变「随机坏」——镜像迁移日全灭根因）──
print("── 13. 吞错禁用（CI + Python 工具）")
SW1 = '||' + ' true'                        # 拼接写法：规则字面量不自指（同「竖线竖线 true」表述案）
SW2 = '||' + ' exit 0'
PY_OT = re.compile(r'\bor\s+Tr' + r'ue\b')  # or True 恒真分支；拼接同上（两段都 raw，\b 才是词边界）
swallow, py_swallow = [], []
for f in sorted(glob.glob('.github/workflows/*.yml')):
    for i, line in enumerate(open(f, encoding='utf-8'), 1):
        code = line.split('#')[0]        # 剥注释：禁止令的文档表述不算违规（git mv -q 自指案同款）
        if SW1 in code or SW2 in code:
            swallow.append(f"{f}:{i}")
check(not swallow, f"workflows 无吞错兜底（实得 {swallow}）")
# 工具层曾是盲区（health.py 恒真案）：Python 源码同检——恒真分支 + subprocess shell 串里的吞错
for f in sorted(glob.glob('tools/*.py')) + ['run_tests.py', 'verify.py', 'build_data.py',
                                            'build_text.py', 'build_mentions.py', 'scrape.py', 'query.py']:
    for i, line in enumerate(open(f, encoding='utf-8'), 1):
        code = line.split('#')[0]        # 剥注释：同上
        if PY_OT.search(code) or SW1 in code or SW2 in code:
            py_swallow.append(f"{f}:{i}")
check(not py_swallow, f"py 工具无恒真吞错兜底（实得 {py_swallow}）")

# ── L14: CSS !important 棘轮（附录 A：specificity 军备竞赛）──
print("── 14. CSS !important")
imp = 0
for f in sorted(glob.glob('css/*.css')):
    imp += open(f, encoding='utf-8').read().count('!important')
check(imp <= 25, f"!important ≤25 棘轮（实得 {imp}，按出现次数计）——新增样式用特异性/媒体块；压厂商样式集中在允许区，只减不增")

# ── L15: subprocess 显式编码（教训 22：cp936 默认解码遇非 GBK 字符崩读线程 → 孤儿雪崩）──
print("── 15. subprocess 编码")
bare_sub = []
for f in ['run_tests.py', 'verify.py', 'tests/test_cli.py'] + sorted(glob.glob('tools/*.py')):
    for i, line in enumerate(open(f, encoding='utf-8'), 1):
        if 'text=True' in line and 'encoding' not in line:
            bare_sub.append(f"{f}:{i}")
check(not bare_sub, f"text=True 同行须显式 encoding（实得 {bare_sub}）——教训 22：Windows 默认 cp936 解码子输出遇非 GBK 字符即崩")

# ── L16: Python 工具可编译（教训 23：重复 kwarg 曾入库无人拦——CI 不跑审计器，碎文件出不了门）──
print("── 16. 工具编译")
import tempfile as _tf
broken_py = []
for f in sorted(glob.glob('tools/*.py')) + ['run_tests.py', 'verify.py', 'tests/test_cli.py']:
    import py_compile
    try:
        py_compile.compile(f, doraise=True, cfile=os.path.join(_tf.gettempdir(), 'fy_lint.pyc'))
    except Exception as e:
        broken_py.append(f"{f}: {str(e)[:60]}")
check(not broken_py, f"工具脚本可编译（实得 {broken_py}）")

print()
if fails:
    for f_ in fails:
        print(f"✗ {f_}")
    print(f"Lint：{len(fails)} 项违规")
    sys.exit(1)
# 自愈：尾空格 + 文件末尾换行
if FIX:
    fixed = 0
    for f in glob.glob('js/*.js') + glob.glob('tools/*.py') + glob.glob('tests/*.html'):
        c = open(f, encoding='utf-8').read()
        c2 = c.rstrip() + chr(10) if c.strip() else c
        if not c2.endswith(chr(10)):
            c2 += chr(10)
        if c != c2:
            open(f, 'w', encoding='utf-8').write(c2)
            fixed += 1
    if fixed:
        print(f"  🔧 尾空格/末行自愈 ×{fixed}")

print(f"Lint：全过 ✓" + ("（含自愈）" if FIX else ""))
