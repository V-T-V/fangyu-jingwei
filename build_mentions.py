# -*- coding: utf-8 -*-
"""生成 data/mentions.js：192 府全书被引次数（供 3D 文柱）。
   取词规则与 js/wenxin.js 完全一致：简名计，单字/省名撞车退回全名。"""
import json, glob, re, os

ROOT = os.path.dirname(os.path.abspath(__file__))
raw = open(os.path.join(ROOT, "data", "site_data.js"), encoding="utf-8").read()
data = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
corpus = "".join(open(fn, encoding="utf-8").read()
                 for fn in glob.glob(os.path.join(ROOT, "data", "volumes", "*.txt")))

prov_names = {p["name"] for p in data["provinces"]}
def count(t, w):
    n, i = 0, t.find(w)
    while i >= 0:
        n += 1; i = t.find(w, i + len(w))
    return n

out, seen = {}, set()
for p in data["provinces"]:
    for u in p["fu"]:
        term = re.sub(r"(军民府|军民卫|州府|府|州|卫)$", "", u["n"])
        if len(term) < 2 or term in prov_names:
            term = u["n"]
        if term in seen:
            continue                      # 双太平府之类：简名撞车，合并计
        seen.add(term)
        out[p["id"] + "|" + u["n"]] = count(corpus, term)

js = ("/* 《方舆经纬》府名被引次数 · build_mentions.py 生成，勿手改 */\n"
      "window.FY_MENTIONS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";")
open(os.path.join(ROOT, "data", "mentions.js"), "w", encoding="utf-8").write(js)
print("mentions:", len(out), "条 ·", len(js) // 1024, "KB")
