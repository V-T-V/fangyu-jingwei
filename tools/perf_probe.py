# -*- coding: utf-8 -*-
"""性能探针：python tools/perf_probe.py [page]

冷缓存加载指定页（默认 index.html），经 CDP 采集：
  - 导航时序：responseStart / domContentLoaded / loadEventEnd
  - 绘制：first-contentful-paint
  - 资源瀑布：transferSize / duration Top15
数字出脚本，不作目测（数据纪律）。
"""
import json, os, subprocess, sys, tempfile, time
import urllib.request as ur

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # 兼容 python -I 调用
from fy_reap import reap_browser

BASE = os.environ.get("FY_BASE", "http://127.0.0.1:9200/")
PAGE = sys.argv[1] if len(sys.argv) > 1 else "index.html"
WAIT = sys.argv[2] if len(sys.argv) > 2 else None   # 可选：等待该 JS 表达式为真，报告达成时刻
PORT = int(os.environ.get("FY_CDP_PORT", "9333"))

CANDS = [
    os.environ.get("FY_BROWSER", ""),   # 显式指定优先（CI 注入）
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
]
def _ok(c):
    return c and (os.path.exists(c) if c[1] == ":" else os.access(c, os.X_OK))
EDGE = next((c for c in CANDS if _ok(c)), None)
if not EDGE:
    print("X 未找到浏览器（FY_BROWSER 可指定）"); sys.exit(2)

JS = r"""JSON.stringify((function(){
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const fcp = (performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint')||{}).startTime;
  const res = performance.getEntriesByType('resource').map(r=>({
    n: r.name.split('/').pop().slice(0,44),
    t: Math.round(r.transferSize/1024),
    d: Math.round(r.duration),
    init: r.initiatorType,
    _s: Math.round(r.startTime), _e: Math.round(r.responseEnd),
    dem: r.name.indexOf('terrarium') >= 0
  })).sort((a,b)=>b.t-a.t);
  const dem = res.filter(r=>r.dem);
  return { rs: Math.round(nav.responseStart), dcl: Math.round(nav.domContentLoadedEventEnd),
           load: Math.round(nav.loadEventEnd), fcp: fcp?Math.round(fcp):null,
           nres: res.length, top: res.slice(0,15),
           slow: res.slice().sort((a,b)=>b.d-a.d).slice(0,10),
           dem: dem.length ? { n: dem.length, first_start: Math.min(...dem.map(r=>r._s)),
                               last_end: Math.max(...dem.map(r=>r._e)) } : null };
})())"""

prof = tempfile.mkdtemp(prefix="fyperf_")
proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu",
    "--no-first-run", "--remote-debugging-port=%d" % PORT,
    "--user-data-dir=" + prof, "about:blank"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    base = "http://127.0.0.1:%d" % PORT
    for _ in range(75):
        try:
            ur.urlopen(base + "/json/version", timeout=1).read(); break
        except Exception:
            time.sleep(.2)
    req = ur.Request(base + "/json/new?" + BASE + PAGE, method="PUT")
    tab = json.loads(ur.urlopen(req, timeout=5).read())
    t0 = time.time()
    out = None
    wait_ms = None
    while time.time() - t0 < 45:
        time.sleep(1 if WAIT else 2)
        tabs = json.loads(ur.urlopen(base + "/json/list", timeout=5).read())
        ws = next((t.get("webSocketDebuggerUrl") for t in tabs if t.get("id") == tab["id"]), None)
        if not ws:
            continue
        try:
            import websocket  # pip install websocket-client（若缺则降级 title 协议）
            ws = websocket.create_connection(ws, timeout=5)
            expr = JS if not WAIT else f"({WAIT}) ? performance.now() : false"
            ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                                "params": {"expression": expr, "returnByValue": True}}))
            r = json.loads(ws.recv())
            v = r.get("result", {}).get("result", {}).get("value")
            if WAIT:
                if isinstance(v, (int, float)) and v:
                    # 达成后附带完整瀑布（--wait 成为超集视图）
                    ws.send(json.dumps({"id": 2, "method": "Runtime.evaluate",
                                        "params": {"expression": JS, "returnByValue": True}}))
                    full = json.loads(ws.recv()).get("result", {}).get("result", {}).get("value")
                    out = {"wait_ms": round(v)}
                    if full:
                        out.update(json.loads(full))
                    ws.close(); break
            elif v and json.loads(v).get("load"):
                out = json.loads(v); ws.close(); break
            ws.close()
        except ImportError:
            print("✗ 缺 websocket-client：pip install websocket-client"); sys.exit(2)
    if not out:
        print("X 45s 未完成加载" + (f"（{WAIT} 未达成）" if WAIT else "")); sys.exit(1)
    if WAIT:
        print(f"── {PAGE} · {WAIT} 达成于 {out['wait_ms']}ms ──")
    else:
        print(f"── {PAGE} 冷加载 ──")
    print(f"responseStart {out['rs']}ms · FCP {out['fcp']}ms · DOMContentLoaded {out['dcl']}ms · load {out['load']}ms · 资源 {out['nres']} 项")
    if out.get("dem"):
        dm = out["dem"]
        print(f"DEM 瓦片 {dm['n']} 张：首发于 {dm['first_start']}ms · 末张毕于 {dm['last_end']}ms")
    print(f"{'资源':<46}{'传输KB':>7}{'耗时ms':>8}  类型")
    for r in out["top"]:
        print(f"{r['n']:<46}{r['t']:>7}{r['d']:>8}  {r['init']}")
    print("── 按耗时 ──")
    for r in out["slow"]:
        print(f"{r['n']:<46}{r['t']:>7}{r['d']:>8}  {r['init']}")
finally:
    reap_browser(proc, PORT)   # 收尸共享版（教训 9）：terminate 只杀主进程
