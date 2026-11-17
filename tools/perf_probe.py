# -*- coding: utf-8 -*-
"""性能探针：python tools/perf_probe.py [page]

冷缓存加载指定页（默认 index.html），经 CDP 采集：
  - 导航时序：responseStart / domContentLoaded / loadEventEnd
  - 绘制：first-contentful-paint
  - 资源瀑布：transferSize / duration Top15
数字出脚本，不作目测（数据纪律）。
"""
import json, subprocess, sys, tempfile, time
import urllib.request as ur

BASE = "http://127.0.0.1:9200/"
PAGE = sys.argv[1] if len(sys.argv) > 1 else "index.html"
PORT = 9333

CANDS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
]
import os
def _ok(c):
    return c and (os.path.exists(c) if c[1] == ":" else os.access(c, os.X_OK))
EDGE = next((c for c in CANDS if _ok(c)), None)

JS = r"""JSON.stringify((function(){
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const fcp = (performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint')||{}).startTime;
  const res = performance.getEntriesByType('resource').map(r=>({
    n: r.name.split('/').pop().slice(0,44),
    t: Math.round(r.transferSize/1024),
    d: Math.round(r.duration),
    init: r.initiatorType
  })).sort((a,b)=>b.t-a.t);
  return { rs: Math.round(nav.responseStart), dcl: Math.round(nav.domContentLoadedEventEnd),
           load: Math.round(nav.loadEventEnd), fcp: fcp?Math.round(fcp):null,
           nres: res.length, top: res.slice(0,15),
           slow: res.slice().sort((a,b)=>b.d-a.d).slice(0,10) };
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
    while time.time() - t0 < 45:
        time.sleep(2)
        tabs = json.loads(ur.urlopen(base + "/json/list", timeout=5).read())
        ws = next((t.get("webSocketDebuggerUrl") for t in tabs if t.get("id") == tab["id"]), None)
        if not ws:
            continue
        try:
            import websocket  # pip install websocket-client（若缺则降级 title 协议）
            ws = websocket.create_connection(ws, timeout=5)
            ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                                "params": {"expression": JS, "returnByValue": True}}))
            r = json.loads(ws.recv())
            v = r.get("result", {}).get("result", {}).get("value")
            if v and json.loads(v).get("load"):
                out = json.loads(v); ws.close(); break
            ws.close()
        except ImportError:
            print("✗ 缺 websocket-client：pip install websocket-client"); sys.exit(2)
    if not out:
        print("✗ 45s 未完成加载"); sys.exit(1)
    print(f"── {PAGE} 冷加载 ──")
    print(f"responseStart {out['rs']}ms · FCP {out['fcp']}ms · DOMContentLoaded {out['dcl']}ms · load {out['load']}ms · 资源 {out['nres']} 项")
    print(f"{'资源':<46}{'传输KB':>7}{'耗时ms':>8}  类型")
    for r in out["top"]:
        print(f"{r['n']:<46}{r['t']:>7}{r['d']:>8}  {r['init']}")
    print("── 按耗时 ──")
    for r in out["slow"]:
        print(f"{r['n']:<46}{r['t']:>7}{r['d']:>8}  {r['init']}")
finally:
    proc.terminate()
