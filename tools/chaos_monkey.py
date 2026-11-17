# -*- coding: utf-8 -*-
"""混沌猴：python tools/chaos_monkey.py [次数] [间隔ms]

对真页随机点击可见可点元素（按钮/标签/面板内件/地图容器），
错误采集器前置注入（同 boot_smoke）。任何 onerror/unhandledrejection
即红。Phase 5 fuzz 思想的单页轻量版：狂点之下不崩。
"""
import base64
import json
import os
import random
import subprocess
import sys
import tempfile
import time
import urllib.request as ur
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("FY_BASE", "http://127.0.0.1:9200/")
TARGET = BASE + "index.html"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 200
GAP = int(sys.argv[2]) if len(sys.argv) > 2 else 60
PORT = 9333
random.seed(42)   # 可复现混沌

EDGE_CANDS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
]
EDGE = next((c for c in EDGE_CANDS if c and os.path.exists(c)), None)

TRAP = """window.__errs = [];
window.onerror = function(m, s, l, c, e){ window.__errs.push((e && e.name || 'Error') + ': ' + m + ' @' + (l||0)); return false; };
window.addEventListener('unhandledrejection', function(e){ window.__errs.push('Rejection: ' + (e.reason && e.reason.message || e.reason)); });"""


def main():
    if not EDGE:
        print("X no browser"); sys.exit(2)
    prof = tempfile.mkdtemp(prefix="fychaos_")
    proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--window-size=1440,900",
        "--no-first-run", f"--remote-debugging-port={PORT}",
        f"--user-data-dir={prof}", "about:blank"],
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
            return cmd("Runtime.evaluate", {"expression": e, "returnByValue": True}) \
                     .get("result", {}).get("value")

        cmd("Page.enable"); cmd("Runtime.enable")
        cmd("Page.addScriptToEvaluateOnNewDocument", {"source": TRAP})
        cmd("Page.navigate", {"url": TARGET})
        for _ in range(60):
            if ev("document.readyState==='complete' && !!(window.map && window.map._loaded)"):
                break
            time.sleep(.5)
        time.sleep(.5)
        ev("document.querySelector('#boot .go') && document.querySelector('#boot .go').click()")
        time.sleep(.8)

        CLICK_JS = """(function(){
          const els = [...document.querySelectorAll('button, .ftool, .fuseal, .sr, .chip, #modes button, .evg, .rt')]
            .filter(e => { const b = e.getBoundingClientRect(); return b.width > 4 && b.height > 4; });
          if (!els.length) return 0;
          const el = els[Math.floor(Math.random() * els.length)];
          const b = el.getBoundingClientRect();
          el.dispatchEvent(new MouseEvent('click', {
            clientX: b.left + b.width/2, clientY: b.top + b.height/2, bubbles: true}));
          return els.length;
        })()"""

        clicks = errs_snapshot = 0
        for i in range(N):
            ev(CLICK_JS)
            clicks += 1
            if i % 20 == 19:   # 段间喘息，让过渡动画落地
                time.sleep(.4)
            time.sleep(GAP / 1000)
        time.sleep(1.5)
        errs = ev("window.__errs.slice()") or []
        shot = cmd("Page.captureScreenshot", {"format": "png"})
        os.makedirs(os.path.join(ROOT, "docs", "evidence"), exist_ok=True)
        png = os.path.join(ROOT, "docs", "evidence", "chaos-after.png")
        open(png, "wb").write(base64.b64decode(shot["data"]))
        out = {"clicks": clicks, "errors": errs[:10], "n_errors": len(errs),
               "alive": bool(ev("!!(window.map && window.map._loaded)")),
               "evidence": png, "ok": len(errs) == 0}
        print(json.dumps(out, ensure_ascii=False, indent=1))
        sys.exit(0 if out["ok"] else 1)
    finally:
        proc.terminate()


if __name__ == "__main__":
    main()
