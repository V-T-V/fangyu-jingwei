# -*- coding: utf-8 -*-
"""离线验证：python tools/offline_check.py

「首访后经 Service Worker 离线可用」的端到端实证：
  1. 正常加载 index.html，等 SW controller 接管；
  2. Network.emulateNetworkConditions 离线；
  3. 硬重载——断网状态下 SHELL 预存必须撑起完整启动；
  4. 断网驱动：府印章点击 → 面板开 → 读原文（TEXTS 懒存未暖属预期回退）。
任一关键步失败即非零退出。证据截图落 docs/evidence/offline-index.png。
"""
import base64
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

CANDS = [
    os.environ.get("FY_BROWSER", ""),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
]
EDGE = next((c for c in CANDS if c and os.path.exists(c)), None)
if not EDGE:
    print("X 未找到浏览器"); sys.exit(2)


def main():
    prof = tempfile.mkdtemp(prefix="fyoff_")
    proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu",
        "--no-first-run", f"--remote-debugging-port={PORT}",
        f"--user-data-dir={prof}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        import websocket
        base = f"http://127.0.0.1:{PORT}"
        ready = False
        for _ in range(120):
            try:
                ur.urlopen(base + "/json/version", timeout=1).read(); ready = True; break
            except Exception:
                time.sleep(.2)
        if not ready:
            print(json.dumps({"ok": False, "error": "CDP 30s 未就绪"}, ensure_ascii=False)); sys.exit(2)
        req = ur.Request(base + "/json/new?" + urllib.parse.quote(BASE + "index.html", safe=""), method="PUT")
        tab = json.loads(ur.urlopen(req, timeout=5).read())
        ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
        sid = [0]
        def cmd(method, params=None):
            sid[0] += 1
            ws.send(json.dumps({"id": sid[0], "method": method, "params": params or {}}))
            while True:
                r = json.loads(ws.recv())
                if r.get("id") == sid[0]:
                    return r.get("result", r)
        def ev(expr):
            return cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True}) \
                     .get("result", {}).get("value")

        cmd("Page.enable")
        cmd("Runtime.enable")
        report = {"steps": {}}
        def mark(name, ok, detail=""):
            report["steps"][name] = {"ok": bool(ok), **({"detail": detail} if detail else {})}
            print(("  [OK] " if ok else "  [X] ") + name + ("  " + detail if detail else ""))   # GBK 控制台安全记号

        # 1. 等真页就绪 + SW 接管（真信号，不 sleep 猜）
        controlled = False
        for _ in range(40):
            if ev("document.readyState==='complete' && !!(window.map && window.map._loaded) && !!navigator.serviceWorker.controller"):
                controlled = True; break
            time.sleep(.5)
        mark("sw-controlled", controlled)
        if not controlled:
            report["ok"] = False
            print(json.dumps(report, ensure_ascii=False)); sys.exit(1)

        ev("document.querySelector('#boot .go') && document.querySelector('#boot .go').click()")
        time.sleep(1)

        # 2. 断网
        cmd("Network.enable")
        r = cmd("Network.emulateNetworkConditions",
                {"offline": True, "latency": 0, "downloadThroughput": 0, "uploadThroughput": 0})
        mark("network-off", r == {})

        # 3. 硬重载（离线）
        cmd("Page.reload", {"ignoreCache": False})
        reloaded = False
        for _ in range(40):
            if ev("document.readyState==='complete' && !!(window.map && window.map._loaded)"):
                reloaded = True; break
            time.sleep(.5)
        mark("offline-boot", reloaded)

        # 4. 断网驱动：封面 → 府印章 → 面板
        ev("document.querySelector('#boot .go') && document.querySelector('#boot .go').click()")
        time.sleep(1.2)
        seals = ev("document.querySelectorAll('.fuseal').length")
        mark("fu-seals", seals and seals > 150, f"{seals} 枚")
        ev("document.querySelector('.fuseal') && document.querySelector('.fuseal').click()")
        time.sleep(1.5)
        panel_open = ev("document.getElementById('panel').classList.contains('open')")
        vname = ev("(document.getElementById('vname')||{}).textContent || ''")
        mark("fu-panel", panel_open, vname[:12])
        errs = ev("window.__offlineErrs")  # 未预埋属预期；以可见行为为准

        # 证据
        shot = cmd("Page.captureScreenshot", {"format": "png"})
        os.makedirs(os.path.join(ROOT, "docs", "evidence"), exist_ok=True)
        png = os.path.join(ROOT, "docs", "evidence", "offline-index.png")
        open(png, "wb").write(base64.b64decode(shot["data"]))

        report["ok"] = all(s["ok"] for s in report["steps"].values())
        report["evidence"] = png
        print(json.dumps(report, ensure_ascii=False, indent=1))
        sys.exit(0 if report["ok"] else 1)
    finally:
        proc.terminate()


if __name__ == "__main__":
    main()
