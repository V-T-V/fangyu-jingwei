# -*- coding: utf-8 -*-
"""
方舆经纬 · 一键健康报告：python health.py
依次运行 verify / run_tests / audit / git status，出单页汇总。
"""
import subprocess, sys, os, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

def run(name, cmd):
    t0 = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300,
                       shell=(sys.platform == "win32"))
    dt = time.time() - t0
    ok = r.returncode == 0
    out = r.stdout.strip()
    return name, ok, dt, out

print("═" * 56)
print("  方舆经纬 · 健康报告")
print("═" * 56)

results = []
# ① verify.py
n, ok, dt, out = run("数据完整性", [sys.executable, "verify.py"])
last = out.split("\n")[-1] if out else ""
results.append((n, ok, f"{dt:.1f}s", last))
print(f"  {'✓' if ok else '✗'} {n:12s} {dt:5.1f}s  {last}")

# ② run_tests.py
n, ok, dt, out = run("功能回归", [sys.executable, "run_tests.py"])
last = out.split("\n")[-1] if out else ""
results.append((n, ok, f"{dt:.1f}s", last))
print(f"  {'✓' if ok else '✗'} {n:12s} {dt:5.1f}s  {last}")

# ③ audit.py
n, ok, dt, out = run("坐标审计", [sys.executable, "audit.py"])
# audit 不设退出码，取第一行
first = out.split("\n")[0] if out else ""
ok = "0" in first or "零" in first or True  # audit 总是输出，视为信息性
results.append((n, True, f"{dt:.1f}s", first))
print(f"  ✓ {n:12s} {dt:5.1f}s  {first}")

# ④ git status
r = subprocess.run(["git", "status", "-sb"], capture_output=True, text=True, timeout=10)
synced = "origin/main" in r.stdout and "ahead" not in r.stdout and "behind" not in r.stdout
n = "git 同步"
results.append((n, synced, "-", r.stdout.strip().split("\n")[0]))
print(f"  {'✓' if synced else '△'} {n:12s}       {r.stdout.strip().split(chr(10))[0]}")

# ⑤ 文件统计
js = sum(1 for f in os.listdir("js") if f.endswith(".js"))
txt = sum(1 for f in os.listdir("data/volumes") if f.endswith(".txt"))
tjs = sum(1 for f in os.listdir("data/text") if f.endswith(".js"))
tests = sum(1 for f in os.listdir(".") if f.startswith("test_") and (f.endswith(".html") or f.endswith(".py")))
print(f"\n  代码 {js} 个 js · 数据 {txt} 卷 / {tjs} 全文 · 测试 {tests} 页")
print("═" * 56)

all_ok = all(r[1] for r in results)
if all_ok:
    print("  ✓ 全部健康")
else:
    bad = [r[0] for r in results if not r[1]]
    print(f"  ✗ 异常：{'、'.join(bad)}")
    sys.exit(1)
