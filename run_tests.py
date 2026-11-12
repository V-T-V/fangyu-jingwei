# -*- coding: utf-8 -*-
"""
一键无头回归套件：python run_tests.py
依次以无头 Edge 打开 test_*.html 断言页，解析 TESTLOG，
FAIL 行逐条列出；退出码 0=全过 / 1=有失败。
"""
import re, subprocess, sys, tempfile, os

CANDS = [
    os.environ.get("FY_BROWSER", ""),                      # 显式指定优先
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
    "/usr/bin/chromium-browser",                            # CI (ubuntu)
]
EDGE = next((c for c in CANDS if c and os.path.exists(c)), None)
if not EDGE:
    print("✗ 未找到浏览器（可用环境变量 FY_BROWSER 指定）"); sys.exit(1)
print("浏览器:", EDGE)

PAGES = ["test_auto.html", "test_filter.html", "test_events.html",
         "test_night.html", "test_tts.html", "test_counties.html",
         "test_journey.html", "test_gating.html", "test_sw.html",
         "test_wenxin.html", "test_bian.html", "test_basemap.html"]
BASE = "http://127.0.0.1:8613/"

fails = []
for page in PAGES:
    out = os.path.join(tempfile.gettempdir(), "fytest_%s.html" % page)
    prof = tempfile.mkdtemp(prefix="fyprof_")          # 每次全新 profile，杜绝 HTTP 缓存旧页
    r = subprocess.run(
        [EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
         "--user-data-dir=" + prof, "--virtual-time-budget=16000",
         "--dump-dom", BASE + page],
        capture_output=True, timeout=120)
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


# ── 3D 页（MapLibre 与虚拟时间不合）：CDP 真实时间 + 标题协议 ──
import json as _json, urllib.request as _ur, time as _time
def run_cdp_test(page):
    port, proc, out = 9333, None, None
    import subprocess as _sp, tempfile as _tf, os as _os
    prof = _tf.mkdtemp(prefix="fy3d_")
    proc = _sp.Popen([EDGE, "--headless=new", "--disable-gpu", "--use-angle=swiftshader",
        "--no-first-run", "--remote-debugging-port=%d" % port,
        "--user-data-dir=" + prof, "about:blank"],
        stdout=_sp.DEVNULL, stderr=_sp.DEVNULL)
    try:
        base = "http://127.0.0.1:%d" % port
        for _ in range(50):                      # 等调试端口就绪
            try:
                _ur.urlopen(base + "/json/version", timeout=1).read(); break
            except Exception:
                _time.sleep(.2)
        req = _ur.Request(base + "/json/new?" + BASE + page, method="PUT")
        tabinfo = _json.loads(_ur.urlopen(req, timeout=5).read())
        deadline = _time.time() + 75
        while _time.time() < deadline:
            _time.sleep(1.5)
            tabs = _json.loads(_ur.urlopen(base + "/json/list", timeout=5).read())
            tab = next((t for t in tabs if t.get("id") == tabinfo["id"]), None)
            title = (tab or {}).get("title", "")
            if title.startswith("R3D:"):
                out = title[4:]; break
        if out is None:
            out = "CDP-TIMEOUT FAIL"
    finally:
        proc.terminate()
    lines = [l.strip() for l in out.split(";") if l.strip()]
    bad = [l for l in lines if "FAIL" in l and "SKIP" not in l]
    print(("✓" if not bad else "✗") + " %-20s %d 项断言%s" % (page, len(lines), "" if not bad else "："))
    for l in bad: print("    FAIL  " + l)
    if bad: fails.append((page, bad))

run_cdp_test("test_3d.html")

# CLI 测试
import importlib.util
cli_test = os.path.join(os.path.dirname(__file__), "test_cli.py")
if os.path.exists(cli_test):
    r = subprocess.run([sys.executable, cli_test], capture_output=True, text=True, timeout=60)
    cli_ok = "全过" in r.stdout
    print(("✓" if cli_ok else "✗") + " test_cli.py       " + ("7 用例" if cli_ok else r.stdout.strip()[-60:]))
    if not cli_ok:
        fails.append(("test_cli.py", ["CLI 测试失败"]))

print()
if fails:
    print("回归未过：%d 个失败项" % sum(len(f[1]) for f in fails))
    sys.exit(1)
print("回归通过：%d 页 × 全部断言（%d 无头 + 1 CDP 三维）" % (len(PAGES)+1, len(PAGES)))
