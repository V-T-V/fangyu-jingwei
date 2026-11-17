# -*- coding: utf-8 -*-
"""堆探针：python tools/heap_probe.py

长会话资源行为：强制 GC 后量 JSHeapUsedSize（Performance.getMetrics，
绕开 performance.memory 的旗门槛），驱动 180 轮「开府卡→关→切模式」，
看增量是否线性发散（泄漏信号）。

已知特性（2026-11-18 基线）：~20KB/交互 的温和线性残留
（panels/era 图层缓存），1000 次交互 ≈ 20MB，桌面可承受；
若某轮改动后增量显著抬升（>2MB/60轮），即回归信号。
"""
import json
import subprocess
import sys
import tempfile
import time
import urllib.request as ur
import urllib.parse

EDGE_CANDS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
]
import os
EDGE = next((c for c in EDGE_CANDS if c and os.path.exists(c)), None)

BASE = os.environ.get("FY_BASE", "http://127.0.0.1:9200/")
PORT = 9333
THRESH_MB = 2.0   # 每 60 轮增量阈值


def main():
    if not EDGE:
        print("X 未找到浏览器"); sys.exit(2)
    prof = tempfile.mkdtemp(prefix="fyheap_")
    proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu",
        "--js-flags=--expose-gc", "--no-first-run",
        f"--remote-debugging-port={PORT}", f"--user-data-dir={prof}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        import websocket
        base = f"http://127.0.0.1:{PORT}"
        ready = False
        for _ in range(150):
            try:
                ur.urlopen(base + "/json/version", timeout=1).read(); ready = True; break
            except Exception:
                time.sleep(.4)
        if not ready:
            print(json.dumps({"ok": False, "error": "CDP 60s 未就绪"}, ensure_ascii=False)); sys.exit(2)
        req = ur.Request(base + "/json/new?" + urllib.parse.quote(BASE + "index.html", safe=""), method="PUT")
        tab = json.loads(ur.urlopen(req, timeout=5).read())
        ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
        sid = [0]
        def cmd(m, p=None):
            sid[0] += 1
            ws.send(json.dumps({"id": sid[0], "method": m, "params": p or {}}))
            while True:
                r = json.loads(ws.recv())
                if r.get("id") == sid[0]:
                    return r
        def ev(e):
            r = cmd("Runtime.evaluate", {"expression": e, "returnByValue": True})
            res = r.get("result", {})
            if "exceptionDetails" in res:
                raise RuntimeError(str(res.get("exceptionDetails", {}).get("exception", {}))[:160])
            return res.get("value")
        cmd("Performance.enable")
        def heap():
            ev("window.gc()"); time.sleep(.4)
            for x in cmd("Performance.getMetrics").get("result", {}).get("metrics", []):
                if x["name"] == "JSHeapUsedSize":
                    return x["value"]
            raise RuntimeError("JSHeapUsedSize 缺失")
        for _ in range(60):
            try:
                if ev("document.readyState==='complete' && !!(window.map && window.map._loaded)"):
                    break
            except RuntimeError:
                pass
            time.sleep(.5)
        ev("document.querySelector('#boot .go') && document.querySelector('#boot .go').click()")
        time.sleep(1)
        def cycle(n):
            for i in range(n):
                ev("document.querySelectorAll('.fuseal')[0] && document.querySelectorAll('.fuseal')[0].click()")
                time.sleep(.1)
                ev("document.getElementById('pclose').click()")
                ev(f"document.querySelectorAll('#modes button')[{i%3}] ? document.querySelectorAll('#modes button')[{i%3}].click() : 0")
                time.sleep(.1)
        h = [heap()]
        for _ in range(3):
            cycle(60)
            h.append(heap())
        mb = lambda b: round(b / 1048576, 2)
        d1, d2 = h[2] - h[1], h[3] - h[2]
        out = {
            "heap_mb": [mb(x) for x in h],
            "delta_per_60": [mb(d1), mb(d2)],
            "verdict": "stable" if d1 < THRESH_MB * 1048576 and d2 <= d1 + 1048576 else "LEAK-SUSPECT",
        }
        out["ok"] = out["verdict"] == "stable"
        print(json.dumps(out, ensure_ascii=False, indent=1))
        sys.exit(0 if out["ok"] else 1)
    finally:
        proc.terminate()


if __name__ == "__main__":
    main()
