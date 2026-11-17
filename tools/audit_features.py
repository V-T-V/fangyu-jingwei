# -*- coding: utf-8 -*-
"""功能地图维护审计（实施指南 §3.5）——三态：clean / changed / blocked

python tools/audit_features.py [--live|--no-live]

做法（只读产品代码，永不改）：
  1. 解析 references/features/*.md 里引用的锚点——`#dom-id` 选择器、
     `window.__x` / `window.x` 全局量、反引号文件路径；
  2. 逐一对源码核存在（index/3d/js/*.js/grep）；
  3. --live：以 run_tests.py 14 页作活体全功能驱动（默认开，--no-live 跳过）。

产出（stdout JSON）：
  clean   —— 锚点全在 + 活体绿
  changed —— 地图引了源码里已不存在的锚（列出；修的是地图不是产品）
  blocked —— 环境拦路（服务没起/浏览器缺失/回归红），点名阻塞物
"""
import glob
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEAT = os.path.join(ROOT, ".zcode", "skills", "verify-fy", "references", "features")
SRC_FILES = (["index.html", "3d.html"] + sorted(glob.glob(os.path.join(ROOT, "js", "*.js"))))


def read(p):
    return open(p, encoding="utf-8").read()


SRC = "\n".join(read(os.path.join(ROOT, f)) for f in SRC_FILES)


def audit_anchors(md_text):
    """从功能域文档提取三类锚点并在源码中核对。"""
    missing = []
    # DOM id 选择器：`#xxx`（反引号内、以 # 开头、含连字符/字母数字；排除颜色/路仓写法）
    for sel in set(re.findall(r"`(#[A-Za-z][\w-]*(?: [\w.-]+)?)`", md_text)):
        dom_id = sel.split()[0][1:]
        if not re.search(r'id="%s"' % re.escape(dom_id), SRC):
            missing.append({"kind": "dom-id", "ref": sel})
    # 全局量：window.__x / window.x（词边界）
    for g in set(re.findall(r"`(window\.[A-Za-z_][\w.]*)`", md_text)):
        base = g.split(".")[1]
        if not re.search(r"\b%s\b" % re.escape(base), SRC):
            missing.append({"kind": "global", "ref": g})
    # 文件路径：反引号内含 / 且带扩展名
    for f in set(re.findall(r"`([A-Za-z0-9_./-]+\.(?:html|py|js|css))`", md_text)):
        if not os.path.exists(os.path.join(ROOT, f)):
            missing.append({"kind": "file", "ref": f})
    return missing


def live_sweep():
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
    r = subprocess.run([sys.executable, "run_tests.py"], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=600, cwd=ROOT, env=env)
    return r.returncode == 0, (r.stdout or "").strip().splitlines()[-1]


def main():
    live = "--no-live" not in sys.argv
    report = {}
    for md in sorted(glob.glob(os.path.join(FEAT, "*.md"))):
        name = os.path.basename(md)
        if name == "README.md":
            continue
        miss = audit_anchors(read(md))
        report[name] = miss
    blocked = []
    if live:
        try:
            ok, last = live_sweep()
            if not ok:
                blocked.append(f"run_tests 红：{last}")
        except Exception as e:
            blocked.append(f"活体驱动失败：{e}")

    out = {"domains": {}, "generated_by": "tools/audit_features.py"}
    total_missing = 0
    for name, miss in report.items():
        total_missing += len(miss)
        out["domains"][name] = {"state": "changed" if miss else "clean",
                                **({"missing_anchors": miss} if miss else {})}
    if blocked:
        out["state"] = "blocked"
        out["blockers"] = blocked
    else:
        out["state"] = "changed" if total_missing else "clean"
    print(json.dumps(out, ensure_ascii=False, indent=1))
    sys.exit(0 if out["state"] == "clean" else 1)


if __name__ == "__main__":
    main()
