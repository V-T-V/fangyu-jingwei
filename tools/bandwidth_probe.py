# -*- coding: utf-8 -*-
"""带宽探针：python tools/bandwidth_probe.py

SW 带宽效益量化：同浏览器实例双访 index.html，
首访（SW 未接管）vs 再访（SW 接管）总传输字节对比。

口径注：本地 http.server 不压缩，首访字节为未压缩值；
生产 gzip 后首访约 1/3，但再访同样全免（SW 全命中）。
基线（2026-11-18）：首访 706KB/37 项 → 再访 0 字节 —— 100% 免流量。
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request as ur
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("FY_BASE", "http://127.0.0.1:9200/")
PORT = 9333

EDGE_CANDS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
]
EDGE = next((c for c in EDGE_CANDS if c and os.path.exists(c)), None)


def main():
    if not EDGE:
        print("X no browser"); sys.exit(2)
    prof = tempfile.mkdtemp(prefix="fybw_")
    proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
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
            print(json.dumps({"ok": False, "error": "CDP not ready"}, ensure_ascii=False)); sys.exit(2)
        req = ur.Request(base + "/json/new?" + urllib.parse.quote("about:blank", safe=""), method="PUT")
        tab = json.loads(ur.urlopen(req, timeout=5).read())
        ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
        sid = [0]
        def cmd(m, p=None):
            sid[0] += 1
            ws.send(json.dumps({"id": sid[0], "method": m, "params": p or {}}))
            while True:
                r = json.loads(ws.recv())
                if r.get("id") == sid[0]:
                    return r.get("result", r)
        def ev(e):
            return cmd("Runtime.evaluate", {"expression": e, "returnByValue": True}).get("result", {}).get("value")

        def visit():
            cmd("Page.navigate", {"url": BASE + "index.html"})
            for _ in range(50):
                if ev("document.readyState==='complete' && !!(window.map && window.map._loaded)"):
                    break
                time.sleep(.5)
            time.sleep(2)
            return json.loads(ev("""(function(){
              const rs = performance.getEntriesByType('resource');
              let net = 0, zero = 0;
              for (const r of rs) { if (r.transferSize > 0) net += r.transferSize; else zero++; }
              const nav = performance.getEntriesByType('navigation')[0] || {};
              return JSON.stringify({bytes: net + (nav.transferSize||0), cached: zero, n: rs.length,
                                     sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller)});
            })()"""))

        v1 = visit()
        v2 = visit()
        out = {
            "first": v1, "repeat": v2,
            "saved_pct": round((v1["bytes"] - v2["bytes"]) * 100 / max(v1["bytes"], 1), 1),
            "ok": v2["sw"] and v2["bytes"] == 0,
            "note": "本地未压缩口径；生产 gzip 首访约 1/3，再访同样全免",
        }
        print(json.dumps(out, ensure_ascii=False, indent=1))
        sys.exit(0 if out["ok"] else 1)
    finally:
        proc.terminate()


if __name__ == "__main__":
    main()
