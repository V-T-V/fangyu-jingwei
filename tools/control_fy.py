# -*- coding: utf-8 -*-
"""方舆经纬 · 控制 CLI —— Lauren Tan 验证技能的「Agent 之手」（实施指南 §3.3）

用法：python tools/control_fy.py <子命令> [参数]

  serve {start|stop|status} [--dry-run]      拉起/收掉本地服务（默认 9200）
  doctor                                     健康自检——每次使用前先跑
  drive <page> [--wait EXPR] [--timeout S]   驱动页面；--wait 等待 JS 表达式为真
  screenshot <page> <out.png> [--wait EXPR]  证据截图（默认等 Leaflet 就绪）
  perf <page>                                冷加载瀑布（时序 + 资源榜）
  cleanup [--dry-run]                        收尾：清无头浏览器残留（不动证据文件）

设计红线（六条全守）：子命令少而可组合 · 破坏性必带 --dry-run ·
报错给下一步 · --help 详尽 · 输出一律 JSON（stderr 走诊断）。
证据形态约定：截图 PNG / drive 断言标题 / perf JSON——存 docs/evidence/，
cleanup 不触碰该目录（证据必须在清理后仍然存在，SKILL.md 验收门槛）。
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request as ur

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PID_FILE = os.path.join(ROOT, ".fyserve.pid")
BASE = os.environ.get("FY_BASE", "http://127.0.0.1:9200/")
PORT = int(BASE.rstrip("/").rsplit(":", 1)[1])
CDP_PORT = 9333
EVIDENCE_DIR = os.path.join(ROOT, "docs", "evidence")

CANDS = [
    os.environ.get("FY_BROWSER", ""),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
]
EDGE = next((c for c in CANDS if c and os.path.exists(c)), None)


def out(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=1))
    sys.exit(obj.get("_code", 0) if isinstance(obj, dict) else 0)


def fail(msg, next_step):
    out({"ok": False, "error": msg, "next": next_step, "_code": 1})


# ── serve ─────────────────────────────────────────────
def http_up():
    try:
        ur.urlopen(BASE + "index.html", timeout=2).read(64)
        return True
    except Exception:
        return False


def cmd_serve(action, dry=False):
    if action == "status":
        out({"ok": True, "serving": http_up(), "base": BASE})
    if action not in ("start", "stop"):
        fail(f"未知动作 {action}", "用 serve start|stop|status")
    if action == "start":
        if http_up():
            out({"ok": True, "already": True, "base": BASE})
        if dry:
            out({"ok": True, "dry_run": True, "would": f"http.server {PORT}"})
        p = subprocess.Popen(
            [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
            cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0))
        open(PID_FILE, "w").write(str(p.pid))
        for _ in range(30):
            if http_up():
                out({"ok": True, "pid": p.pid, "base": BASE})
            time.sleep(.3)
        fail("服务 9s 未就绪", f"查端口占用：netstat -ano | findstr {PORT}（Windows 保留段会吞 8115-9140，换 FY_BASE）")
    if action == "stop":
        pid = open(PID_FILE).read().strip() if os.path.exists(PID_FILE) else ""
        if not pid:
            out({"ok": True, "note": "无 PID 记录（非本 CLI 所起则手动关闭）"})
        if dry:
            out({"ok": True, "dry_run": True, "would_kill_pid": int(pid)})
        try:
            subprocess.run(["taskkill", "/PID", pid, "/T", "/F"], capture_output=True)
        except FileNotFoundError:
            subprocess.run(["kill", pid], capture_output=True)
        os.remove(PID_FILE)
        out({"ok": True, "stopped": int(pid)})


# ── doctor ────────────────────────────────────────────
def cmd_doctor():
    checks = []

    def add(name, ok, detail, nxt):
        checks.append({"name": name, "ok": ok, "detail": detail, **({"next": nxt} if not ok else {})})

    add("server", http_up(), BASE, "python tools/control_fy.py serve start")
    add("browser", bool(EDGE), EDGE or "未找到 Edge/Chrome", "装 Edge 或设 FY_BROWSER 指向可执行文件")
    try:
        import websocket  # noqa: F401
        add("websocket-client", True, "CDP 通道可用", "")
    except ImportError:
        add("websocket-client", False, "缺包", "pip install websocket-client")
    sd = os.path.join(ROOT, "data", "site_data.js")
    add("site_data", os.path.exists(sd),
        f"{os.path.getsize(sd)//1024}KB" if os.path.exists(sd) else "缺 data/site_data.js",
        "python build_data.py 重建")
    sw = open(os.path.join(ROOT, "sw.js"), encoding="utf-8").read()
    idx = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    import re
    v_sw = re.search(r'VERSION = "v(\d+)"', sw)
    v_idx = set(re.findall(r"\?v=(\d+)", idx))
    add("version", bool(v_sw) and v_idx == {v_sw.group(1)},
        f"sw=v{v_sw and v_sw.group(1)} index=v{sorted(v_idx)}",
        "按 AGENTS.md「版本 bump」sed 全站")
    n_tests = len([f for f in os.listdir(os.path.join(ROOT, "tests")) if f.startswith("test_")])
    add("tests", n_tests >= 14, f"{n_tests} 个断言页", "git 恢复 tests/ 目录")
    out({"ok": all(c["ok"] for c in checks), "checks": checks,
         "_code": 0 if all(c["ok"] for c in checks) else 1})


# ── CDP 通道 ──────────────────────────────────────────
class CDP:
    def __init__(self, page, wait_expr=None, timeout=45):
        self.page, self.wait_expr, self.timeout = page, wait_expr, timeout
        self.port = CDP_PORT
        self.proc = None
        self.tab = None

    def __enter__(self):
        if not EDGE:
            fail("未找到浏览器", "装 Edge 或设 FY_BROWSER")
        prof = tempfile.mkdtemp(prefix="fyctl_")
        self.proc = subprocess.Popen(
            [EDGE, "--headless=new", "--disable-gpu", "--window-size=1440,900",
             "--no-first-run", f"--remote-debugging-port={self.port}",
             f"--user-data-dir={prof}", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        base = f"http://127.0.0.1:{self.port}"
        for _ in range(75):
            try:
                ur.urlopen(base + "/json/version", timeout=1).read()
                break
            except Exception:
                time.sleep(.2)
        else:
            self.__exit__(None, None, None)
            fail("CDP 15s 未就绪", "重跑一次；仍失败查是否有残留无头进程占用 9333（control_fy.py cleanup）")
        req = ur.Request(base + "/json/new?" + BASE + self.page, method="PUT")
        self.tab = json.loads(ur.urlopen(req, timeout=5).read())
        return self

    def eval(self, expr):
        import websocket
        ws = websocket.create_connection(self.tab["webSocketDebuggerUrl"], timeout=10)
        try:
            ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                               "params": {"expression": expr, "returnByValue": True}}))
            return json.loads(ws.recv()).get("result", {}).get("result", {}).get("value")
        finally:
            ws.close()

    def screenshot(self, path):
        import websocket
        ws = websocket.create_connection(self.tab["webSocketDebuggerUrl"], timeout=15)
        try:
            ws.send(json.dumps({"id": 2, "method": "Page.captureScreenshot",
                                "params": {"format": "png"}}))
            b64 = json.loads(ws.recv())["result"]["data"]
            open(path, "wb").write(base64.b64decode(b64))
        finally:
            ws.close()

    def wait_ready(self):
        t0 = time.time()
        while time.time() - t0 < self.timeout:
            if self.wait_expr:
                if self.eval(f"!!({self.wait_expr})"):
                    return round((time.time() - t0) * 1000)
            else:
                if self.eval("document.readyState === 'complete'"):
                    return round((time.time() - t0) * 1000)
            time.sleep(.5)
        return None

    def __exit__(self, *a):
        if self.proc:
            self.proc.terminate()


# ── drive / screenshot / perf / cleanup ───────────────
def cmd_drive(page, wait_expr, timeout):
    with CDP(page, wait_expr, timeout) as c:
        ms = c.wait_ready()
        if ms is None:
            fail(f"{timeout}s 内 {'表达式未达成：' + wait_expr if wait_expr else '页面未完成'}",
                 "加 --timeout 或换 --wait 表达式；看 console：control_fy.py drive 后人查 DevTools")
        title = c.eval("document.title")
        log = c.eval("(document.getElementById('testlog')||{}).textContent || ''")
        out({"ok": True, "page": page, "wait_ms": ms, "title": title,
             "testlog": log.strip()[:2000]})


def cmd_screenshot(page, path, wait_expr, click_sel=None):
    if not os.path.isabs(path):
        os.makedirs(EVIDENCE_DIR, exist_ok=True)
        path = os.path.join(EVIDENCE_DIR, path)
    expr = wait_expr or "document.readyState === 'complete'"
    with CDP(page, expr, 45) as c:
        ms = c.wait_ready()
        if ms is None:
            fail("等待超时，未截图", f"换 --wait 表达式（当前：{expr}）")
        if click_sel:
            hit = c.eval(f"!!document.querySelector('{click_sel}')")
            if not hit:
                fail(f"--click 选择器未命中：{click_sel}", "查 DOM（drive 后人看 DevTools）或换选择器")
            c.eval(f"document.querySelector('{click_sel}').click()")
            time.sleep(1.6)   # 过场动画落定
        time.sleep(1.2)   # 让瓦片/图层落定
        c.screenshot(path)
        out({"ok": True, "page": page, "png": path, "wait_ms": ms,
             "size_kb": os.path.getsize(path) // 1024})


def cmd_perf(page):
    r = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "tools", "perf_probe.py"), page],
                       capture_output=True, text=True, timeout=120)
    out({"ok": r.returncode == 0, "probe": r.stdout.strip().splitlines()[-8:],
         "next": "" if r.returncode == 0 else "先 control_fy.py serve start"})


def cmd_cleanup(dry):
    """收尾：只清无头浏览器残留进程；证据目录 docs/evidence/ 永不触碰。"""
    marker = "remote-debugging-port"
    if sys.platform == "win32":
        query = (f"Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | "
                 f"Where-Object {{$_.CommandLine -like '*{marker}*'}}")
        if dry:
            r = subprocess.run(["powershell", "-NoProfile", "-Command",
                                query + " | Select-Object -ExpandProperty ProcessId"],
                               capture_output=True, text=True, timeout=30)
            out({"ok": True, "dry_run": True, "would_kill": r.stdout.split()})
        subprocess.run(["powershell", "-NoProfile", "-Command",
                        query + " | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"],
                       capture_output=True, timeout=30)
        out({"ok": True, "killed": "headless msedge (marker: " + marker + ")",
             "evidence_kept": EVIDENCE_DIR})
    if dry:
        out({"ok": True, "dry_run": True, "would_kill": f"pkill -f {marker}"})
    subprocess.run(["pkill", "-f", marker], capture_output=True, timeout=15)
    out({"ok": True, "killed": f"pkill -f {marker}", "evidence_kept": EVIDENCE_DIR})


HELP = __doc__


def main():
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        print(HELP)
        return
    cmd, rest = a[0], a[1:]
    dry = "--dry-run" in rest
    rest = [x for x in rest if x != "--dry-run"]
    if cmd == "serve":
        cmd_serve(rest[0] if rest else "status", dry)
    elif cmd == "doctor":
        cmd_doctor()
    elif cmd == "drive":
        page = rest[0] if rest else "index.html"
        w = rest[rest.index("--wait") + 1] if "--wait" in rest else None
        t = int(rest[rest.index("--timeout") + 1]) if "--timeout" in rest else 45
        cmd_drive(page, w, t)
    elif cmd == "screenshot":
        if len(rest) < 2:
            fail("参数不足", "screenshot <page> <out.png> [--wait EXPR] [--click CSS选择器]")
        w = rest[rest.index("--wait") + 1] if "--wait" in rest else None
        k = rest[rest.index("--click") + 1] if "--click" in rest else None
        cmd_screenshot(rest[0], rest[1], w, k)
    elif cmd == "perf":
        cmd_perf(rest[0] if rest else "index.html")
    elif cmd == "cleanup":
        cmd_cleanup(dry)
    else:
        fail(f"未知子命令 {cmd}", "看 --help；六个子命令：serve doctor drive screenshot perf cleanup")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        fail(f"{type(e).__name__}: {e}", "看 --help 或 SKILL.md（.zcode/skills/verify-fy/）")
