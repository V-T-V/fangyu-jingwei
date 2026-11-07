# -*- coding: utf-8 -*-
"""
《方舆经纬》全文数据构建：data/volumes/*.txt → data/text/*.js（按需懒加载）
  每省一文件: FYTEXT["<pid>"] = { xu:"序全文", fu:{"武昌府":"全文", …} }
  形势一文件: FYTEXT["xingshi"] = [九卷全文…]
  川渎一文件: FYTEXT["chuandu"] = [七卷全文…]
运行: python build_text.py
"""
import re, os, glob

ROOT = os.path.dirname(os.path.abspath(__file__))
VOL = os.path.join(ROOT, "data", "volumes")
OUT = os.path.join(ROOT, "data", "text")
os.makedirs(OUT, exist_ok=True)

PROVINCES = [
    ("beizhi", "北直隶", "017_*.txt", 18, 26),
    ("nanzhi", "南直隶", "027_*.txt", 28, 38),
    ("shandong", "山东", "039_*.txt", 40, 48),
    ("shanxi", "山西", "049_*.txt", 50, 56),
    ("henan", "河南", "057_*.txt", 58, 63),
    ("shanxix", "陕西", "064_*.txt", 65, 78),
    ("sichuan", "四川", "079_*.txt", 80, 88),
    ("huguang", "湖广", "089_*.txt", 90, 97),
    ("jiangxi", "江西", "098_*.txt", 99, 104),
    ("zhejiang", "浙江", "105_*.txt", 106, 111),
    ("fujian", "福建", "112_*.txt", 113, 117),
    ("guangdong", "广东", "118_*.txt", 119, 124),
    ("guangxi", "广西", "125_*.txt", 126, 132),
    ("yunnan", "云南", "133_*.txt", 134, 140),
    ("guizhou", "贵州", "141_*.txt", 142, 145),
]

SPLIT_RE = re.compile(
    r"(属州|属县|属长|属所|属卫|今|与|隶|新改|东至|南至|西至|北至|东南至|东北至|西南至|西北至|[　\s，。、及]|大田所|领)")
KEEP_WEI = {"施州卫", "施州军民卫"}
BAD = re.compile(r"[A-Za-z\uff66-\uff9f\u3040-\u30ff]")

def read(fn):
    with open(os.path.join(VOL, fn), encoding="utf-8") as f:
        return f.read()

def vfile(n):
    g = glob.glob(os.path.join(VOL, "%03d_*.txt" % n))
    return os.path.basename(g[0]) if g else None

def clean_body(s):
    s = s.replace("\ufffd", "□")
    # 保留段落结构：源文件以“仅含空白的行”分段
    paras = [re.sub(r"^[　\s]+", "", p).strip() for p in re.split(r"\n", s)]
    paras = [p for p in paras if p and not p.startswith("#")]
    return "\n".join(paras)

def sec_name(head):
    segs = SPLIT_RE.split(head, maxsplit=1)
    cand = segs[0].strip().replace("\ufffd", "")
    # 前缀匹配：兼容“潮州府东、南至…”这类复合方位把名字切碎的头行
    m = re.match(r"^([\u4e00-\u9fff]{1,6}(?:军民府|军民卫|府|州|卫))", cand)
    name = m.group(1) if m else None
    if not name:
        return None
    if name == "式府":                     # 源站 GB2312 缺字：澂江府 → 乱码“式府”
        name = "澄江府"
    if any(w in name for w in ("宣慰", "安抚", "招讨", "长官司")):
        return None
    if name.endswith("卫") and name not in KEEP_WEI:
        return None
    return name

def build_province(pid, pname, xuglob, lo, hi):
    g = glob.glob(os.path.join(VOL, xuglob))
    xu = clean_body(read(os.path.basename(g[0]))) if g else ""
    fu = {}
    for n in range(lo, hi + 1):
        fn = vfile(n)
        if not fn:
            continue
        txt = read(fn)
        parts = re.split(r"(◇[^\n◇]+)", txt)
        for k in range(1, len(parts), 2):
            head = parts[k][1:].strip()
            body = parts[k + 1] if k + 1 < len(parts) else ""
            if len(body) < 250:          # 名录卷的府块不取
                continue
            name = sec_name(head)
            if not name:
                continue
            if len(body) > len(fu.get(name, "")):   # 同府跨页取最长
                fu[name] = clean_body(body)
    return {"xu": xu, "fu": fu}

def build_essays(nums):
    out = []
    for n in nums:
        fn = vfile(n)
        if not fn:
            out.append("")
            continue
        out.append(clean_body(read(fn)))
    return out

def dump(js_name, payload):
    import json
    body = "/* 《方舆经纬》全文 · build_text.py 生成 · 懒加载 */\nFYTEXT[%s]=%s;" % (
        json.dumps(js_name, ensure_ascii=False),
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    path = os.path.join(OUT, js_name + ".js")
    with open(path, "w", encoding="utf-8") as f:
        f.write(body)
    return os.path.getsize(path)

JUANSHOU = [
    ("魏禧叙", "000_*.txt"), ("彭士望叙", "001_*.txt"),
    ("总叙一", "002_*.txt"), ("总叙二", "003_*.txt"), ("总叙三", "004_*.txt"),
    ("凡例二十六则", "005_*.txt"), ("州域形势纪要序", "007_*.txt"),
]

def build_juanshou():
    out = []
    for title, pat in JUANSHOU:
        g = glob.glob(os.path.join(VOL, pat))
        out.append({"t": title, "x": clean_body(read(os.path.basename(g[0])))} if g
                   else {"t": title, "x": ""})
    return out

def main():
    total = 0
    for pid, pname, xuglob, lo, hi in PROVINCES:
        data = build_province(pid, pname, xuglob, lo, hi)
        size = dump(pid, data)
        total += size
        print(f"[{pname}] 府全文 {len(data['fu'])} 条 · 序 {'有' if data['xu'] else '无'} · {size//1024} KB")
    s0 = dump("juanshou", build_juanshou())
    s1 = dump("xingshi", build_essays(range(8, 17)))
    s2 = dump("chuandu", build_essays(range(147, 154)))
    total += s1 + s2
    print(f"[卷首] {s0//1024} KB  [形势] {s1//1024} KB  [川渎] {s2//1024} KB")
    print(f"→ data/text/ 共 {total//1024} KB（按需加载，首屏不含）")

if __name__ == "__main__":
    main()
