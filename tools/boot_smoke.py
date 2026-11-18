# -*- coding: utf-8 -*-
"""开机冒烟：python tools/boot_smoke.py [url]

在页面任何脚本执行**之前**注入错误采集器（addScriptToEvaluateOnNewDocument），
随后逐步驱动全部入口（封面 · 底栏五键 · 三模式 · 翻卷 · 府面板），
捕获 window.onerror + unhandledrejection。任何错误即非零退出。
与断言页互补：断言页是复刻品，本工具给真页装心电图。
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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # 兼容 python -I 调用
from fy_reap import reap_browser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("FY_BASE", "http://127.0.0.1:9200/")
TARGET = sys.argv[1] if len(sys.argv) > 1 else BASE + "index.html"
PORT = int(os.environ.get("FY_CDP_PORT", "9334"))   # 缺省 9334（现状）：与其余探针 9333 错峰

CANDS = [
    os.environ.get("FY_BROWSER", ""),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
]
EDGE = next((c for c in CANDS if c and os.path.exists(c)), None)
if not EDGE:
    print("X 未找到浏览器（FY_BROWSER 可指定）"); sys.exit(2)

TRAP = """window.__errs = [];
window.onerror = function(m, s, l, c, e){ window.__errs.push((e && e.name || 'Error') + ': ' + m + ' @' + (l||0)); return false; };
window.addEventListener('unhandledrejection', function(e){ window.__errs.push('Rejection: ' + (e.reason && e.reason.message || e.reason)); });"""

STEPS = [
    ("boot-cover-dismiss", "document.querySelector('#boot .go') ? document.querySelector('#boot .go').click() : 0", 1200),
    ("footer-analytics",   "document.getElementById('analyticslink').click()", 1500),
    ("footer-wenxin",      "document.getElementById('wenxinlink').click()", 2500),
    ("footer-bian",        "document.getElementById('bianlink').click()", 1200),
    ("footer-wander",      "document.getElementById('wanderlink').click()", 1500),
    ("panel-close",        "document.getElementById('pclose').click()", 600),
    ("mode-xingshi",       "document.querySelector('#modes button[data-m=形势]').click()", 1200),
    ("mode-chuandu",       "document.querySelector('#modes button[data-m=川渎]').click()", 1500),
    ("mode-yutu",          "document.querySelector('#modes button[data-m=舆图]').click()", 800),
    ("fu-open",            "document.querySelector('.fuseal') ? document.querySelector('.fuseal').click() : 0", 1500),
]


STEPS_3D = [
    ("scene-fly",       "const s=document.getElementById('scenes'); if(s && s.options[1]){s.selectedIndex=1; s.dispatchEvent(new Event('change'));} 0", 3000),
    ("era-wall",        "const e=document.getElementById('erarange'); if(e){e.value='3'; e.dispatchEvent(new Event('input'));} 0", 2000),
    ("ment-toggle",     "const m=document.getElementById('mentbtn'); if(m) m.click(); 0", 1000),
    ("tour-start",      "const t=document.getElementById('tourbtn'); if(t) t.click(); 0", 2500),
    ("tour-stop",       "const t=document.getElementById('tourbtn'); if(t) t.click(); 0", 800),
]

def pick_steps(target):
    return STEPS_3D if "3d.html" in target else STEPS

def main():
    prof = tempfile.mkdtemp(prefix="fysmoke_")
    size = os.environ.get("FY_SIZE", "1440,900")   # 移动靶：FY_SIZE=390,844 python tools/boot_smoke.py
    proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--window-size=" + size,
        "--no-first-run", f"--remote-debugging-port={PORT}",
        f"--user-data-dir={prof}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        import websocket
        base = f"http://127.0.0.1:{PORT}"
        for _ in range(75):
            try:
                ur.urlopen(base + "/json/version", timeout=1).read(); break
            except Exception:
                time.sleep(.2)
        else:
            print(json.dumps({"ok": False, "error": "CDP 15s 未就绪"}, ensure_ascii=False)); sys.exit(2)

        req = ur.Request(base + "/json/new?" + urllib.parse.quote("about:blank", safe=""), method="PUT")
        tab = json.loads(ur.urlopen(req, timeout=5).read())
        ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=20)
        sid = [0]
        def send(method, params=None):
            sid[0] += 1
            ws.send(json.dumps({"id": sid[0], "method": method, "params": params or {}}))
            while True:
                r = json.loads(ws.recv())
                if r.get("id") == sid[0]:
                    return r.get("result", r)
        def ev(expr):
            return send("Runtime.evaluate", {"expression": expr, "returnByValue": True}) \
                     .get("result", {}).get("value")

        send("Page.enable")
        send("Runtime.enable")
        send("Page.addScriptToEvaluateOnNewDocument", {"source": TRAP})
        send("Page.navigate", {"url": TARGET})

        for _ in range(60):
            if ev("document.readyState === 'complete' && !!(window.map && window.map._loaded)"):
                break
            time.sleep(.5)
        time.sleep(1)

        errs = ev("window.__errs.slice()") or []
        report = {"target": TARGET, "boot": list(errs), "steps": {}}
        for name, expr, wait in pick_steps(TARGET):
            before = len(errs)
            ev(expr)
            time.sleep(wait / 1000)
            errs = ev("window.__errs.slice()") or errs
            report["steps"][name] = errs[before:]

        shot = send("Page.captureScreenshot", {"format": "png"})
        os.makedirs(os.path.join(ROOT, "docs", "evidence"), exist_ok=True)
        png = os.path.join(ROOT, "docs", "evidence", "smoke-index.png")
        open(png, "wb").write(base64.b64decode(shot["data"]))
        report["total_errors"] = len(errs)
        report["ok"] = len(errs) == 0
        report["evidence"] = png
        print(json.dumps(report, ensure_ascii=False, indent=1))
        sys.exit(0 if report["ok"] else 1)
    finally:
        reap_browser(proc, PORT)   # 收尸共享版（教训 9）：terminate 只杀主进程


if __name__ == "__main__":
    main()
