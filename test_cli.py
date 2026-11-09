"""CLI query.py 测试：python test_cli.py"""
import subprocess, sys, os
ROOT = os.path.dirname(os.path.abspath(__file__))
Q = os.path.join(ROOT, "query.py")

CASES = [
    (["武昌府"], "武昌府", "30.55"),
    (["桃源县"], "桃源县", "推算"),
    (["山海关"], "山海关", "九边"),
    (["大散关"], "大散关", "川陕"),
    (["剑门"], "剑门关", "蜀道"),
    (["开封"], "开封府", "34.80"),
    (["不存在的地名xyz"], "未找到", None),
]
fails = 0
for args, expect, coord in CASES:
    r = subprocess.run([sys.executable, Q] + args, capture_output=True, text=True, timeout=15)
    out = r.stdout
    ok = expect in out and (coord is None or coord in out) and r.returncode == 0
    status = "✓" if ok else "✗"
    if not ok: fails += 1
    print(f"  {status} query {' '.join(args)} → {expect} {'(coord ✓)' if coord and coord in out else ''}")

if fails:
    print(f"\n✗ {fails} 个失败"); sys.exit(1)
print(f"\n✓ {len(CASES)} 个 CLI 用例全过")
