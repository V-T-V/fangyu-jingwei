"""方舆经纬 · 《水经注》互查数据构建（水道经纬 v1.2 站际桥）
扫描本书语料（data/text/*.js）中全部《水经注》引用：
  - 按省计数 + 每省样例引文（≤6 条，上下文 ±70 字）
  - 引文语境匹配水道名 → 深链目标（水道经纬 #r=<水id>）
输出: data/sjz_xref.js —— window.FY_SJZ（wenxin.js 懒加载，仿 mentions.js 模式）
坐标库来自姊妹项目 D:/W_A_W/SDJW（若目录不存在则深链退化为站首页）。
"""
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FY_TEXT = os.path.join(ROOT, "data", "text")
SDJW = r"D:/W_A_W/SDJW"
SDJW_SITE = "https://v-t-v.github.io/shuidao-jingwei/"

PROV = {
    "beizhi": "北直隶", "nanzhi": "南直隶", "shandong": "山东", "shanxi": "山西",
    "henan": "河南", "shanxix": "陕西", "sichuan": "四川", "huguang": "湖广",
    "jiangxi": "江西", "zhejiang": "浙江", "fujian": "福建", "guangdong": "广东",
    "guangxi": "广西", "yunnan": "云南", "guizhou": "贵州",
    "chuandu": "川渎", "xingshi": "形势", "juanshou": "卷首",
}

# 水道经纬分节水名 → 深链 id（长名优先）
water_ids = {}
riv_path = os.path.join(SDJW, "data", "intermediate", "rivers.json")
if os.path.exists(riv_path):
    riv = json.load(io.open(riv_path, encoding="utf-8"))
    names = sorted({r["name"] for r in riv["rivers"] if r["type"] == "water"}, key=len, reverse=True)
    # 同名跨卷分节取首节 id（水道经纬合并主键，深链 #r=<首节id> 才有效）
    id_by_name = {}
    for r in riv["rivers"]:
        id_by_name.setdefault(r["name"], r["id"])
else:
    names, id_by_name = [], {}


def match_water(ctx):
    for nm in names:
        if nm in ctx:
            return nm, id_by_name.get(nm)
    return None, None


def main():
    total = 0
    by_prov = {}
    for fn in sorted(os.listdir(FY_TEXT)):
        if not fn.endswith(".js"):
            continue
        pid = fn[:-3]
        raw = io.open(os.path.join(FY_TEXT, fn), encoding="utf-8").read()
        text = "".join(re.findall(r'"((?:[^"\\]|\\.)*)"', raw))
        n = text.count("《水经注》")
        if not n:
            continue
        prov = PROV.get(pid, pid)
        cites = []
        for m in re.finditer("《水经注》", text):
            total += 1
            if len(cites) < 6:
                ctx = text[max(0, m.start() - 70):m.start() + 90].replace("\n", "")
                water, wid = match_water(ctx)
                cites.append({
                    "ctx": ctx[:200],
                    "water": water or "",
                    "href": (SDJW_SITE + "#r=" + wid) if wid else SDJW_SITE,
                })
        by_prov[prov] = {"n": n, "cites": cites}

    out = {
        "site": SDJW_SITE,
        "total": total,
        "byProv": dict(sorted(by_prov.items(), key=lambda kv: -kv[1]["n"])),
    }
    with io.open(os.path.join(ROOT, "data", "sjz_xref.js"), "w", encoding="utf-8") as f:
        f.write("/* 方舆经纬 · 引水经注互查数据 · build_sjz_xref.py 生成，勿手改 */\n")
        f.write("window.FY_SJZ = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"《水经注》被引 {total} 次 · {len(by_prov)} 省 → data/sjz_xref.js")
    for p, v in list(out["byProv"].items())[:5]:
        print(f"  {p}: {v['n']}")


if __name__ == "__main__":
    main()
