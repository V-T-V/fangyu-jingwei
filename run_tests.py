# -*- coding: utf-8 -*-
"""
一键无头回归套件：python run_tests.py
依次以无头 Edge 打开 test_*.html 断言页，解析 TESTLOG，
FAIL 行逐条列出；退出码 0=全过 / 1=有失败。
"""
import re, subprocess, sys, tempfile, os

EDGE = None
for p in [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
          r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
          r"C:\Program Files\Google\Chrome\Application\chrome.exe"]:
    if os.path.exists(p):
        EDGE = p
        break
if not EDGE:
    print("✗ 未找到 Edge/Chrome"); sys.exit(1)

PAGES = ["test_auto.html", "test_filter.html", "test_events.html",
         "test_night.html", "test_tts.html"]
BASE = "http://127.0.0.1:8613/"

fails = []
for page in PAGES:
    out = os.path.join(tempfile.gettempdir(), "fytest_%s.html" % page)
    prof = tempfile.mkdtemp(prefix="fyprof_")          # 每次全新 profile，杜绝 HTTP 缓存旧页
    r = subprocess.run(
        [EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
         "--user-data-dir=" + prof, "--virtual-time-budget=16000",
         "--dump-dom", BASE + page],
        capture_output=True, timeout=90)
    html = r.stdout.decode("utf-8", errors="replace")
    m = re.search(r'id="testlog"[^>]*>([^<]*)<', html)
    if not m or "TESTLOG" not in (m.group(1) or ""):
        fails.append((page, ["脚本未产出 TESTLOG"]))
        print("✗ %-20s 无日志产出" % page)
        continue
    lines = [l.strip() for l in m.group(1).splitlines()
             if l.strip() and l.strip() not in ("TESTLOG", "ENDLOG")]
    bad = [l for l in lines if "FAIL" in l]
    status = "✓" if not bad else "✗"
    print("%s %-20s %d 项断言%s" % (status, page, len(lines), "" if not bad else "："))
    for l in bad:
        fails.append((page, [l]))
        print("    FAIL  " + l)

print()
if fails:
    print("回归未过：%d 个失败项" % sum(len(f[1]) for f in fails))
    sys.exit(1)
print("回归通过：%d 页 × 全部断言" % len(PAGES))
