# -*- coding: utf-8 -*-
"""
《方舆经纬》数据完整性校验：python verify.py
  1. 文件齐备（154 卷 + 数据文件 + 全文文件）
  2. site_data 计数与坐标域（193 府 / 187 州 / ≥1000 县，坐标落中国框）
  3. 摘录洁净（无半/全角外来字符、无未替换缺字符）
  4. 全文覆盖（各府名录 → data/text 有对应全文，别名归一，白名单除外）
  5. 县治推算（≥700 点，坐标落域）
  6. 卷首七篇齐备
  7. JS 语法（node --check）
  8. 指纹对账（SHA256SUMS 逐行 sha256 实测；哈希不符/文件缺失/data 缺行即失败）
退出码 0=全过 / 1=有失败。
"""
import hashlib, json, os, re, glob, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
fails, warns = [], []

def check(ok, msg, warn=False):
    if ok:
        print(f"  ✓ {msg}")
    else:
        (warns if warn else fails).append(msg)
        print(f"  {'⚠' if warn else '✗'} {msg}")

BAD = re.compile(r"[A-Za-z\uff21-\uff3a\uff41-\uff5a\uff66-\uff9f\u3040-\u30ff\ufffd]")

print("── 1. 文件齐备")
vols = glob.glob("data/volumes/*.txt")
check(len(vols) == 154, f"分卷文本 154（实得 {len(vols)}）")
check(os.path.exists("data/site_data.js"), "data/site_data.js")
texts = glob.glob("data/text/*.js")
check(len(texts) >= 18, f"data/text/*.js ≥18（实得 {len(texts)}）")
# PWA / 自托管基建
check(all(os.path.exists(p) for p in
          ["sw.js", "manifest.json", "vendor/leaflet.js", "vendor/leaflet.css",
           "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"]),
      "PWA 基建（sw/manifest/vendor/icons）")
sw = open("sw.js", encoding="utf-8").read()
idx = open("index.html", encoding="utf-8").read()
m = re.search(r"\?v=(\d+)", idx)
check(bool(m) and sw.count("?v=" + m.group(1)) >= 10 and "VERSION = \"v" + m.group(1) + "\"" in sw,
      "sw.js 缓存清单与 index.html ?v= 同步")

print("── 2. site_data 计数与坐标域")
raw = open("data/site_data.js", encoding="utf-8").read()
data = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
fu_n = sum(len(p["fu"]) for p in data["provinces"])
zo_n = sum(len(f["zhou"]) for p in data["provinces"] for f in p["fu"])
xi_n = sum(len(f["xian"]) + sum(len(z["x"]) for z in f.get("zx", []))
           for p in data["provinces"] for f in p["fu"])
check(fu_n == 193, f"府级条目 193（实得 {fu_n}）")
check(zo_n == 187, f"属州 187（实得 {zo_n}）")
check(xi_n >= 1000, f"县 ≥1000（实得 {xi_n}）")
bad_coord = [(p["name"], f["n"], f["c"]) for p in data["provinces"] for f in p["fu"]
             if not f.get("c") or not (18 <= f["c"][0] <= 54 and 73 <= f["c"][1] <= 136)]
check(not bad_coord, f"府治坐标全部落域（异常 {len(bad_coord)}：{bad_coord[:3]}）")

print("── 3. 摘录洁净")
dirty = []
for p in data["provinces"]:
    for key in ("xu", "zhouyu"):
        if p.get(key) and BAD.search(p[key]):
            dirty.append(f'{p["name"]}.{key}')
    for f in p["fu"]:
        for key in ("yan", "zhi"):
            if f.get(key) and BAD.search(f[key]):
                dirty.append(f'{p["name"]}.{f["n"]}.{key}')
for t in data["xingshi"] + data["chuandu"]:
    if BAD.search(t["ex"]):
        dirty.append(t["title"][:10])
check(not dirty, f"摘录无外来/缺字符（脏 {len(dirty)}：{dirty[:5]}）")

print("── 4. 全文覆盖")
WHITE = {"向武州", "思陵州"}                      # 已知无独立成篇（附见泗城等叙事）
def load_text_block(fn):
    t = open(os.path.join("data", "text", fn), encoding="utf-8").read()
    return set(re.findall(r'"([\u4e00-\u9fff]{1,8}(?:军民府|军民卫|府|州|卫))":', t))
missing = []
for p in data["provinces"]:
    def norm(n):
        n = n.replace("军民", "").replace("御夷", "").replace("州府", "府")
        return re.sub(r"[府州卫]$", "", n)
    got = {norm(k) for k in load_text_block(p["id"] + ".js")}
    for f in p["fu"]:
        nm = norm(f["n"])
        if nm not in got and f["n"] not in WHITE:
            missing.append(f'{p["name"]}.{f["n"]}')
check(not missing, f"各府均有全文（缺 {len(missing)}：{missing[:6]}）", warn=True)

print("── 5. 县治推算")
n_xc = sum(len(u.get("xianc", {})) for p_ in data["provinces"] for u in p_["fu"])
bad_xc = [nm for p_ in data["provinces"] for u in p_["fu"]
          for nm, d in (u.get("xianc") or {}).items()
          for pos in [d if isinstance(d, list) else d.get("c", [])]
          if not (18 < pos[0] < 54 and 73 < pos[1] < 136)]
check(n_xc >= 700, f"县治推算 ≥700（实得 {n_xc}）")
check(not bad_xc, f"县点全落域（越界 {len(bad_xc)}）")

print("── 6. 卷首七篇")
js = open("data/text/juanshou.js", encoding="utf-8").read()
J = json.loads(js[js.find("=") + 1: js.rfind(";")])
check(len(J) == 7 and all(len(it["x"]) > 300 for it in J), f"卷首 7 篇齐备（实得 {len(J)}）")

print("── 7. JS 语法")
bad_js = []
for f in sorted(glob.glob("js/*.js")):
    r = subprocess.run(["node", "--check", f], capture_output=True)
    if r.returncode:
        bad_js.append(f)
check(not bad_js, f"js/*.js 语法（坏 {bad_js}）")

print("── 8. 指纹对账（SHA256SUMS）")
# 静态指纹账本（sha256sum 格式：hash␣␣相对路径）。拦静默漂移：不符即失败，不做 warning。
if not os.path.exists("SHA256SUMS"):
    check(False, "SHA256SUMS 账本存在（仓库根）")
else:
    lines = [l for l in open("SHA256SUMS", encoding="utf-8-sig").read().splitlines() if l.strip()]   # utf-8-sig：容忍 Windows 编辑器 BOM（无 BOM 行为不变）
    check(len(lines) > 0, f"SHA256SUMS 非空（{len(lines)} 行）")
    fmt_bad, gone, hash_bad, listed = [], [], [], set()
    for i, line in enumerate(lines, 1):
        parts = line.split("  ", 1)
        rel = parts[1].strip().replace("\\", "/") if len(parts) == 2 else ""
        if len(parts) != 2 or not re.fullmatch(r"[0-9a-f]{64}", parts[0]) or not rel:
            fmt_bad.append(f"第{i}行格式"); continue
        if rel in listed:
            fmt_bad.append(f"第{i}行重复 {rel}"); continue
        listed.add(rel)
        if not os.path.isfile(rel):
            gone.append(rel); continue
        h = hashlib.sha256()
        with open(rel, "rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
        if h.hexdigest() != parts[0]:
            hash_bad.append(f"{rel}（重算更行：sha256sum {rel}）")
    check(not fmt_bad, f"账本行格式（坏 {len(fmt_bad)}：{fmt_bad[:3]}）")
    check(not gone, f"账上文件俱在（失 {len(gone)}：{gone[:3]}）")
    check(not hash_bad, f"指纹全符 {len(listed) - len(hash_bad)}/{len(listed)}"
                        f"（不符 {len(hash_bad)}：{hash_bad[:2]}）")
    off_books = sorted(
        rel for rel in (os.path.relpath(os.path.join(dp, fn)).replace("\\", "/")
                        for dp, _, fns in os.walk("data") for fn in fns)
        if rel not in listed)
    check(not off_books, f"data/ 全目录在账（缺行 {len(off_books)}：{off_books[:3]}）")

print()
for w in warns:
    print(f"⚠ 警告：{w}")
if fails:
    for f_ in fails:
        print(f"✗ 失败：{f_}")
    print(f"校验未过：{len(fails)} 项失败，{len(warns)} 项警告")
    sys.exit(1)
print(f"校验通过：{len(warns)} 项警告")
