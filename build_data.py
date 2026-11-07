# -*- coding: utf-8 -*-
"""
《方舆经纬》数据构建脚本
从 data/volumes/*.txt 解析全书结构 → data/site_data.js

解析内容：
  1. 十五省：序文摘录 + 州域总论 + ◇府条目（府名/属州数/县数/今领注记/附郭县/州县名录）
            + 后续卷中该府的「四至八到」与沿革摘录
  2. 历代州域形势（卷一~九）：卷题 + 摘录
  3. 川渎异同（卷一二四~一三〇）：卷题 + 摘录
府治坐标由 COORDS 表人工整理（明府治 → 今地经纬度）。
"""
import re, os, json, glob

ROOT = os.path.dirname(os.path.abspath(__file__))
VOL = os.path.join(ROOT, "data", "volumes")
OUT = os.path.join(ROOT, "data", "site_data.js")

def read(fn):
    with open(os.path.join(VOL, fn), encoding="utf-8") as f:
        return f.read()

def clean(s):
    s = re.sub(r"\s+", "", s)
    return s.strip()

def desalt(s):
    return s.replace("�", "□")

# 源站 GB2312 损坏特征：缺字符、混入拉丁字母/假名
BAD_SENT = re.compile(r"[A-Za-z\uff21-\uff3a\uff41-\uff5a\uff66-\uff9f\u3040-\u30ff□]")

def clean_excerpt(s, n):
    """按句剔除编码损坏句（含□/外字），拼接干净句子后截 n 字"""
    s = desalt(s)
    parts = re.split(r"(?<=[。；：])", s)
    keep = [p for p in parts if not BAD_SENT.search(p)]
    out = "".join(keep)
    if len(out) < 40:
        out = s                      # 极端全坏：退回原切片
    return out[:n]

def clean_zhi(s):
    """四至八到：按逗号分句剔除损坏方位句"""
    s = desalt(s)
    cl = [c for c in s.split("，") if not BAD_SENT.search(c)]
    out = "，".join(cl)
    return out if len(out.rstrip("，。")) >= 20 else s

def excerpt(s, n=200):
    """取正文摘录：按行去头注（# 标题 / 来源行 / ◎卷号），返回 n 字"""
    lines = [l for l in s.split("\n")
             if not l.strip().startswith("#") and "来源:" not in l]
    s = re.sub(r"◎\S+", "", "".join(lines))
    return clean_excerpt(re.sub(r"\s+", "", s), n)

# ── 十五省定义：id, 名, 序文件, 卷文件范围 ─────────────────
PROVINCES = [
    ("beizhi", "北直隶", "017_北直方舆纪要序.txt", 18, 26),
    ("nanzhi", "南直隶", "027_南直方舆纪要序.txt", 28, 38),
    ("shandong", "山东",    "039_山东方舆纪要序.txt", 40, 48),
    ("shanxi", "山西",      "049_山西方舆纪要序.txt", 50, 56),
    ("henan", "河南",       "057_河南方舆纪要序.txt", 58, 63),
    ("shanxix", "陕西",     "064_陕西方舆纪要序.txt", 65, 78),
    ("sichuan", "四川",     "079_四川方舆纪要叙.txt", 80, 88),
    ("huguang", "湖广",     "089_湖广方舆纪要序.txt", 90, 97),
    ("jiangxi", "江西",     "098_江西方舆纪要叙.txt", 99, 104),
    ("zhejiang", "浙江",    "105_浙江方舆纪要叙.txt", 106, 111),
    ("fujian", "福建",      "112_福建方舆纪要叙.txt", 113, 117),
    ("guangdong", "广东",   "118_广东方舆纪要叙.txt", 119, 124),
    ("guangxi", "广西",     "125_广西方舆纪要叙.txt", 126, 132),
    ("yunnan", "云南",      "133_云南方舆纪要序.txt", 134, 140),
    ("guizhou", "贵州",     "141_贵州方舆纪要叙.txt", 142, 145),
]

def vol_files(lo, hi):
    out = []
    for n in range(lo, hi + 1):
        g = glob.glob(os.path.join(VOL, "%03d_*.txt" % n))
        if g:
            out.append(os.path.basename(g[0]))
    return out

NAME_RE = re.compile(r"[一-鿿]{1,5}?(?:府|州|县|卫)")

def parse_county_block(block):
    """解析 ◇府 后的州县名录块 → 附郭县, 州[{名,县[]}], 县[名]
    名录行以全角空格分格（每格一个州/县词条）；沿革散文无分格、成超长段落，
    以「格长 > 8 字」整体判弃。"""
    fuguoo = None
    zhou, xian = [], []
    cur_zhou = None
    for l in block.split("\n"):
        l = l.strip()
        if not l or l.startswith("#"):
            continue
        if re.search(r"[。：《》]|曰|也|者|焉|矣|按|详见|盖|谓", l):
            cur_zhou = None
            continue                       # 文气句读 → 散文段
        for cell in re.split(r"[\s\u3000]+", l):
            cell = cell.strip()
            if not cell:
                continue
            if re.match(r"^(今领县|领县|属县)[一二三四五六七八九十]*$", cell):
                continue                   # 计数短语，非词条
            if len(cell) > 9:              # 名录词条至多「XX县〔今废〕」；超长即散文
                cur_zhou = None
                break
            # 州行: "通州属县四" / "遵化州新改" / "保安州今改属山西"
            mz = re.match(r"^([一-鿿]{1,4}州)(.*)$", cell)
            if mz and (not mz.group(2) or re.match(r"^(属县[一二三四五六七八九十]+|新改|今废|今领县[一二三四五六七八九十]+|今)", mz.group(2))):
                names = [mz.group(1)]
                if mz.group(1) == "开州广顺州":     # 源文粘连：开州 + 广顺州
                    names = ["开州", "广顺州"]
                if mz.group(1) == "程番附州":         # 附郭注记粘连
                    names = ["程番州"]
                names = [re.sub(r"^(直隶|附)", "", n) for n in names]
                for nm in names:
                    if nm not in [z["n"] for z in zhou]:
                        zhou.append({"n": nm, "x": []})
                cur_zhou = zhou[-1] if zhou else None
                continue
            # 县词条: "XX县(附郭|今废|...)?"（含"永清县东安县"粘连）
            for m in re.finditer(r"([一-鿿]{1,4})县(附郭|今废|新改|今省|改属)?", cell):
                raw, tag = m.group(1), m.group(2) or ""
                raw = re.sub(r"^(亦见|俱在|即|亦|见|在|及|与|又|其|俱|自)", "", raw)
                if not raw or len(raw) > 3 or re.search(r"[府州卫司]", raw):
                    continue
                nm = raw + "县"
                entry = nm + (f"〔{tag}〕" if tag and tag != "附郭" else "")
                bucket = cur_zhou["x"] if cur_zhou else xian
                if entry not in bucket:
                    if tag == "附郭" and fuguoo is None:
                        fuguoo = nm
                    bucket.append(entry)
    return fuguoo, zhou, xian

def parse_province(pid, pname, xu_file, lo, hi):
    files = vol_files(lo, hi)
    first = read(files[0])
    xu = read(xu_file)

    # 首卷: 州域总论（◎ 之后、第一个 ◇ 之前）
    m0 = re.search(r"◎\S+", first)
    i1 = first.find("◇")
    zhouyu = excerpt(first[i1 - 4000:i1] if i1 > 0 else first, 320) if i1 > 0 else ""
    # 更稳妥：◎ 之后到首个 ◇ 之间的正文
    seg = first[m0.end():i1] if (m0 and i1 > 0) else ""
    zhouyu = clean_excerpt(re.sub(r"\s+", "", seg), 320)

    # ◇府条目（首卷内的名录）
    # 名字 = 头行在第一个「续接词」之前的部分；续接词之后再解析属州/县数
    SPLIT_RE = re.compile(r"(属州|属县|属长|属所|属卫|今|与|隶|新改|东至|南至|西至|北至|东南至|东北至|西南至|西北至|[　\s，。、及]|大田所|领)")
    KEEP_WEI = {"施州卫", "施州军民卫"}       # 卫级但实为疆土单元者保留
    fus = []
    parts = re.split(r"(◇[^\n◇]+)", first)
    for k in range(1, len(parts), 2):
        head = parts[k][1:].strip()
        body = parts[k + 1] if k + 1 < len(parts) else ""
        if "同城" in head or "同上" in head or "隶湖广" in head:
            continue                            # 卫与府同城等注记，非独立政区
        segs = SPLIT_RE.split(head, maxsplit=1)
        name = segs[0].strip().replace("\ufffd", "")
        # 源站 GB2312 缺字（澂→乱码）修正
        if pid == "yunnan" and name == "式府":
            name = "澄江府"
        rest = "".join(segs[1:]) if len(segs) > 1 else ""
        if not name or not re.search(r"(府|州|卫)$", name):
            continue
        if any(w in name for w in ("宣慰", "安抚", "招讨", "长官司")):
            continue                            # 司级土司不入府表
        if name.endswith("卫") and name not in KEEP_WEI:
            continue
        cs = re.search(r"属州([一二三四五六七八九十]+)", head)
        xs = re.search(r"县([一二三四五六七八九十百]+)", head)
        note = re.sub(r"(属州|属县|属长|属所|属卫)?[州县][一二三四五六七八九十百]+", "", clean(rest)).strip("属州县　 ")[:36]
        fuguoo, zhou, xian = parse_county_block(body)
        fus.append({
            "n": name,
            "cs": cs.group(1) if cs else "", "xs": xs.group(1) if xs else "",
            "note": note,
            "fg": fuguoo or "", "zhou": [z["n"] for z in zhou],
            "xian": xian, "zx": zhou,
        })

    # 后续卷：府的「四至八到」+ 沿革摘录
    detail = {}
    for f in files[1:]:
        txt = read(f)
        segs = re.split(r"(◇[^\n◇]+)", txt)
        for k in range(1, len(segs), 2):
            head = segs[k][1:].strip()
            body = segs[k + 1] if k + 1 < len(segs) else ""
            dsegs = SPLIT_RE.split(head, maxsplit=1)
            fname = dsegs[0].strip()
            if not fname or not re.search(r"(府|州|卫)$", fname):
                continue
            # 四至八到：◇行内 "东至…东北至……里。"（取到第一个句号为止）
            mzi = re.search(r"(东至.*?里。)", head)
            d = detail.setdefault(fname, {"zhi": "", "yan": ""})
            if mzi and not d["zhi"]:
                d["zhi"] = clean_zhi(clean(mzi.group(1)))[:220]
            if not d["yan"]:
                yb = clean_excerpt(re.sub(r"\s+", "", body), 260)
                d["yan"] = yb if isinstance(yb, str) else yb
    for fu in fus:
        if fu["n"] in detail:
            fu["zhi"] = detail[fu["n"]]["zhi"]
            fu["yan"] = detail[fu["n"]]["yan"]
        else:
            fu["zhi"], fu["yan"] = "", ""

    vols = []
    for f in files:
        mn = re.search(r"卷[一二三四五六七八九十百]+", f)
        vols.append(mn.group(0) if mn else f)

    return {
        "id": pid, "name": pname, "vols": vols,
        "xu": excerpt(xu, 210),
        "zhouyu": zhouyu,
        "fu": fus,
    }

# ── 历代州域形势（卷一~九）───────────────────────────────
XS_FILES = ["008_卷一.txt","009_卷二.txt","010_卷三.txt","011_卷四.txt",
            "012_卷五.txt","013_卷六.txt","014_卷七.txt","015_卷八.txt","016_卷九.txt"]

def parse_xingshi():
    out = []
    for f in XS_FILES:
        txt = read(f)
        m = re.search(r"◎([^\n]+)", txt)
        title = m.group(1) if m else f
        # 去掉◎行取正文
        body = txt[m.end():] if m else txt
        body = re.sub(r"\s+", "", body)
        out.append({"f": f, "title": title, "ex": clean_excerpt(body, 300)})
    return out

# ── 川渎异同（卷一二四~一三〇）───────────────────────────
CD_FILES = ["147_卷一百二十四.txt","148_卷一百二十五.txt","149_卷一百二十六.txt",
            "150_卷一百二十七.txt","151_卷一百二十八.txt","152_卷一百二十九.txt",
            "153_卷一百三十.txt"]

def parse_chuandu():
    out = []
    for f in CD_FILES:
        txt = read(f)
        m = re.search(r"◎([^\n]+)", txt)
        title = m.group(1) if m else f
        body = txt[m.end():] if m else txt
        body = re.sub(r"\s+", "", body)
        out.append({"f": f, "title": title, "ex": clean_excerpt(body, 260)})
    return out

# ── 府治坐标（明制 → 今地，人工整理）────────────────────
# 键: 省id|府名  → [lat, lng, 今地]
COORDS = {
    # 北直隶
    "beizhi|顺天府": [39.90, 116.40, "北京"], "beizhi|保定府": [38.87, 115.46, "保定"],
    "beizhi|河间府": [38.44, 116.10, "河间"], "beizhi|真定府": [38.14, 114.57, "正定"],
    "beizhi|顺德府": [37.07, 114.50, "邢台"], "beizhi|广平府": [36.61, 114.72, "永年"],
    "beizhi|大名府": [36.28, 115.14, "大名"], "beizhi|永平府": [39.89, 118.87, "卢龙"],
    "beizhi|延庆州": [40.46, 115.97, "延庆"], "beizhi|保安州": [40.38, 115.20, "涿鹿"],
    # 南直隶
    "nanzhi|应天府": [32.06, 118.79, "南京"], "nanzhi|苏州府": [31.30, 120.62, "苏州"],
    "nanzhi|松江府": [31.00, 121.22, "松江"], "nanzhi|常州府": [31.78, 119.97, "常州"],
    "nanzhi|镇江府": [32.19, 119.42, "镇江"], "nanzhi|庐州府": [31.83, 117.28, "合肥"],
    "nanzhi|凤阳府": [32.87, 117.56, "凤阳"], "nanzhi|淮安府": [33.61, 119.02, "淮安"],
    "nanzhi|扬州府": [32.39, 119.41, "扬州"], "nanzhi|徽州府": [29.87, 118.43, "歙县"],
    "nanzhi|宁国府": [30.95, 118.76, "宣城"], "nanzhi|池州府": [30.66, 117.49, "贵池"],
    "nanzhi|太平府": [31.55, 118.49, "当涂"], "nanzhi|安庆府": [30.51, 117.05, "安庆"],
    "nanzhi|徐州": [34.26, 117.19, "徐州"], "nanzhi|滁州": [32.30, 118.32, "滁州"],
    "nanzhi|和州": [31.74, 118.37, "和县"], "nanzhi|广德州": [30.89, 119.41, "广德"],
    # 山东
    "shandong|济南府": [36.67, 117.00, "济南"], "shandong|兖州府": [35.58, 116.99, "兖州"],
    "shandong|东昌府": [36.46, 115.99, "聊城"], "shandong|青州府": [36.70, 118.50, "青州"],
    "shandong|莱州府": [37.18, 119.95, "莱州"], "shandong|登州府": [37.61, 120.73, "蓬莱"],
    # 山西
    "shanxi|太原府": [37.87, 112.55, "太原"], "shanxi|平阳府": [36.09, 111.52, "临汾"],
    "shanxi|汾州府": [37.27, 112.20, "汾阳"], "shanxi|潞安府": [36.20, 113.11, "长治"],
    "shanxi|泽州": [35.50, 112.92, "晋城"], "shanxi|沁州": [36.50, 112.70, "沁县"],
    "shanxi|辽州": [36.95, 113.38, "左权"], "shanxi|大同府": [40.09, 113.30, "大同"],
    # 河南
    "henan|开封府": [34.80, 114.31, "开封"], "henan|河南府": [34.66, 112.45, "洛阳"],
    "henan|归德府": [34.41, 115.65, "商丘"], "henan|汝宁府": [33.00, 114.36, "汝南"],
    "henan|南阳府": [32.99, 112.53, "南阳"], "henan|怀庆府": [35.09, 113.24, "沁阳"],
    "henan|卫辉府": [35.40, 114.05, "卫辉"], "henan|彰德府": [36.10, 114.39, "安阳"],
    "henan|汝州": [34.16, 112.84, "汝州"],
    # 陕西
    "shanxix|西安府": [34.27, 108.95, "西安"], "shanxix|凤翔府": [34.38, 107.40, "凤翔"],
    "shanxix|汉中府": [33.07, 107.02, "汉中"], "shanxix|延安府": [36.59, 109.49, "延安"],
    "shanxix|庆阳府": [35.99, 107.88, "庆阳"], "shanxix|平凉府": [35.54, 106.68, "平凉"],
    "shanxix|巩昌府": [35.08, 104.63, "陇西"], "shanxix|临洮府": [35.38, 103.86, "临洮"],
    # 四川
    "sichuan|成都府": [30.66, 104.07, "成都"], "sichuan|保宁府": [31.78, 105.97, "阆中"],
    "sichuan|顺庆府": [30.84, 106.08, "南充"], "sichuan|夔州府": [31.03, 109.65, "奉节"],
    "sichuan|重庆府": [29.56, 107.03, "重庆"], "sichuan|遵义府": [27.69, 106.93, "遵义"],
    "sichuan|叙州府": [28.77, 104.64, "宜宾"], "sichuan|马湖府": [28.83, 104.16, "屏山"],
    "sichuan|潼川州": [31.15, 105.16, "三台"], "sichuan|嘉定州": [29.55, 103.77, "乐山"],
    "sichuan|眉州": [30.05, 103.83, "眉山"], "sichuan|雅州": [30.01, 103.04, "雅安"],
    "sichuan|龙安府": [32.21, 104.74, "平武"],
    "sichuan|镇雄军民府": [27.44, 104.87, "镇雄"], "sichuan|乌蒙军民府": [27.33, 103.72, "昭通"],
    "sichuan|乌撒军民府": [26.87, 104.29, "威宁"], "sichuan|东川军民府": [26.42, 103.28, "会泽"],
    "sichuan|邛州": [30.41, 103.46, "邛崃"], "sichuan|泸州": [28.87, 105.44, "泸州"],
    # 湖广
    "huguang|武昌府": [30.55, 114.32, "武汉"], "huguang|汉阳府": [30.44, 114.21, "武汉汉阳"],
    "huguang|黄州府": [30.45, 114.87, "黄冈"], "huguang|承天府": [31.17, 112.59, "钟祥"],
    "huguang|德安府": [31.29, 113.70, "安陆"], "huguang|岳州府": [29.36, 113.13, "岳阳"],
    "huguang|荆州府": [30.33, 112.24, "荆州"], "huguang|长沙府": [28.23, 112.97, "长沙"],
    "huguang|常德府": [29.03, 111.70, "常德"], "huguang|衡州府": [26.89, 112.57, "衡阳"],
    "huguang|永州府": [26.44, 111.61, "永州"], "huguang|宝庆府": [27.24, 111.47, "邵阳"],
    "huguang|辰州府": [28.28, 110.39, "沅陵"], "huguang|郴州": [25.79, 113.01, "郴州"],
    "huguang|靖州": [26.58, 109.69, "靖州"], "huguang|施州卫": [30.27, 109.49, "恩施"],
    "huguang|施州军民卫": [30.27, 109.49, "恩施"],
    "huguang|襄阳府": [32.01, 112.12, "襄阳"], "huguang|郧阳府": [32.65, 110.79, "郧阳"],
    # 江西
    "jiangxi|南昌府": [28.68, 115.86, "南昌"], "jiangxi|饶州府": [29.00, 117.03, "鄱阳"],
    "jiangxi|广信府": [28.43, 117.94, "上饶"], "jiangxi|南康府": [29.26, 116.02, "星子"],
    "jiangxi|九江府": [29.73, 116.00, "九江"], "jiangxi|建昌府": [27.55, 116.61, "南城"],
    "jiangxi|抚州府": [27.98, 116.36, "抚州"], "jiangxi|临江府": [28.06, 115.41, "樟树"],
    "jiangxi|吉安府": [27.12, 114.99, "吉安"], "jiangxi|瑞州府": [28.42, 115.38, "高安"],
    "jiangxi|袁州府": [27.80, 114.39, "宜春"], "jiangxi|赣州府": [25.83, 114.93, "赣州"],
    "jiangxi|南安府": [25.40, 114.60, "大余"],
    # 浙江
    "zhejiang|杭州府": [30.27, 120.16, "杭州"], "zhejiang|嘉兴府": [30.75, 120.76, "嘉兴"],
    "zhejiang|湖州府": [30.87, 120.09, "湖州"], "zhejiang|宁波府": [29.87, 121.55, "宁波"],
    "zhejiang|绍兴府": [30.01, 120.58, "绍兴"], "zhejiang|台州府": [28.66, 121.42, "临海"],
    "zhejiang|金华府": [29.10, 119.65, "金华"], "zhejiang|衢州府": [28.94, 118.87, "衢州"],
    "zhejiang|严州府": [29.46, 119.28, "建德"], "zhejiang|温州府": [28.00, 120.67, "温州"],
    "zhejiang|处州府": [28.45, 119.92, "丽水"],
    # 福建
    "fujian|福州府": [26.08, 119.30, "福州"], "fujian|泉州府": [24.91, 118.59, "泉州"],
    "fujian|建宁府": [27.03, 118.30, "建瓯"], "fujian|延平府": [26.64, 118.17, "南平"],
    "fujian|汀州府": [25.86, 116.36, "长汀"], "fujian|兴化府": [25.43, 119.01, "莆田"],
    "fujian|邵武府": [27.34, 117.49, "邵武"], "fujian|漳州府": [24.51, 117.65, "漳州"],
    "fujian|福宁州": [26.89, 120.00, "霞浦"],
    # 广东
    "guangdong|广州府": [23.13, 113.27, "广州"], "guangdong|肇庆府": [23.05, 112.47, "肇庆"],
    "guangdong|韶州府": [24.81, 113.60, "韶关"], "guangdong|南雄府": [25.12, 114.31, "南雄"],
    "guangdong|惠州府": [23.11, 114.42, "惠州"], "guangdong|潮州府": [23.66, 116.62, "潮州"],
    "guangdong|高州府": [21.92, 110.85, "高州"], "guangdong|雷州府": [20.91, 110.09, "雷州"],
    "guangdong|廉州府": [21.65, 109.20, "合浦"], "guangdong|琼州府": [20.03, 110.35, "琼山"],
    "guangdong|罗定州": [22.77, 111.57, "罗定"],
    # 广西
    "guangxi|桂林府": [25.28, 110.29, "桂林"], "guangxi|柳州府": [24.33, 109.42, "柳州"],
    "guangxi|庆远府": [24.49, 108.09, "宜州"], "guangxi|平乐府": [24.63, 110.82, "平乐"],
    "guangxi|梧州府": [23.48, 111.28, "梧州"], "guangxi|浔州府": [23.39, 110.08, "桂平"],
    "guangxi|南宁府": [22.82, 108.37, "南宁"], "guangxi|太平府": [22.42, 107.16, "崇左"],
    "guangxi|思恩军民府": [23.33, 107.59, "平果旧城"], "guangxi|思明府": [22.11, 107.19, "宁明"],
    "guangxi|镇安府": [23.38, 106.39, "德保"],
    "guangxi|归顺州": [23.13, 106.42, "靖西"], "guangxi|泗城州": [24.35, 106.56, "凌云"],
    "guangxi|奉议州": [23.74, 106.92, "田阳"], "guangxi|向武州": [23.09, 107.14, "天等"],
    "guangxi|田州": [23.85, 107.32, "田东"], "guangxi|利州": [24.30, 106.35, "凌云东北"],
    "guangxi|江州": [22.40, 107.36, "崇左江州"], "guangxi|龙州": [22.34, 106.85, "龙州"],
    "guangxi|都康州": [23.14, 107.09, "天等都康"], "guangxi|思陵州": [22.10, 107.20, "宁明思陵"],
    "guangxi|凭祥州": [22.11, 106.76, "凭祥"],
    # 云南
    "yunnan|云南府": [25.04, 102.72, "昆明"], "yunnan|大理府": [25.61, 100.27, "大理"],
    "yunnan|临安府": [23.62, 102.83, "建水"], "yunnan|楚雄府": [25.03, 101.55, "楚雄"],
    "yunnan|澄江府": [24.68, 102.98, "澄江"], "yunnan|蒙化府": [25.23, 100.32, "巍山"],
    "yunnan|永昌军民府": [25.11, 99.16, "保山"], "yunnan|顺宁府": [24.60, 99.91, "凤庆"],
    "yunnan|曲靖军民府": [25.49, 103.80, "曲靖"], "yunnan|寻甸府": [25.56, 103.26, "寻甸"],
    "yunnan|鹤庆军民府": [26.56, 100.18, "鹤庆"], "yunnan|丽江军民府": [26.87, 100.23, "丽江"],
    "yunnan|元江军民府": [23.60, 101.99, "元江"], "yunnan|景东府": [24.44, 100.83, "景东"],
    "yunnan|广南府": [24.05, 105.08, "广南"], "yunnan|广西府": [24.53, 103.77, "泸西"],
    "yunnan|镇沅府": [23.90, 101.10, "镇沅"], "yunnan|北胜州": [26.66, 100.75, "永胜"],
    "yunnan|姚安军民府": [25.50, 101.24, "姚安"], "yunnan|武定军民府": [25.55, 102.40, "武定"],
    "yunnan|永宁府": [27.78, 100.69, "宁蒗永宁"], "yunnan|孟艮府": [19.98, 99.83, "缅甸景栋"],
    # 贵州
    "guizhou|贵阳军民府": [26.65, 106.63, "贵阳"], "guizhou|安顺军民府": [26.25, 105.93, "安顺"],
    "guizhou|镇远府": [27.05, 108.43, "镇远"], "guizhou|思南府": [27.94, 108.13, "思南"],
    "guizhou|思州府": [27.21, 108.81, "岑巩"], "guizhou|铜仁府": [27.72, 109.19, "铜仁"],
    "guizhou|黎平府": [26.23, 109.17, "黎平"], "guizhou|石阡府": [27.51, 108.22, "石阡"],
    "guizhou|都匀府": [26.26, 107.52, "都匀"], "guizhou|平越军民府": [26.73, 107.24, "福泉"],
}

def main():
    provinces = []
    for pid, pname, xu, lo, hi in PROVINCES:
        p = parse_province(pid, pname, xu, lo, hi)
        # 注入坐标
        hit = 0
        for fu in p["fu"]:
            c = COORDS.get(f"{pid}|{fu['n']}")
            if c:
                fu["c"] = [c[0], c[1]]; fu["now"] = c[2]; hit += 1
        p["stats"] = {"fu": len(p["fu"]), "co": hit}
        provinces.append(p)
        print(f"[{pname}] 府条目 {len(p['fu'])} · 有坐标 {hit} · 卷 {p['vols'][0]}~{p['vols'][-1]}")

    data = {
        "book": "读史方舆纪要",
        "author": "顾祖禹",
        "provinces": provinces,
        "xingshi": parse_xingshi(),
        "chuandu": parse_chuandu(),
    }
    nz = inject_zhou_coords(data)
    print(f"属州坐标注入 {nz}")
    np_, nc_ = derive_county_coords(data)
    print(f"县治推算 {nc_} 条（{np_} 省扫描）")
    total_fu = sum(p["stats"]["fu"] for p in provinces)
    total_co = sum(p["stats"]["co"] for p in provinces)
    print(f"\n十五省府条目共 {total_fu}，配坐标 {total_co} ({total_co*100//total_fu}%)")
    print(f"形势 {len(data['xingshi'])} 卷 · 川渎 {len(data['chuandu'])} 卷")

    js = "/* 《方舆经纬》数据 · 由 build_data.py 生成，勿手改 */\nconst FY = " + \
         json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";"
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"→ {OUT}  ({len(js)//1024} KB)")


# ── 属州治坐标（明制 → 今地，人工整编；土州为近似）──────────
ZHOU_COORDS = {
 # 北直隶
 "beizhi|通州":[39.90,116.66,"通州"],"beizhi|霸州":[38.99,116.39,"霸州"],"beizhi|涿州":[39.49,115.97,"涿州"],
 "beizhi|昌平州":[40.22,116.23,"昌平"],"beizhi|蓟州":[40.05,117.41,"蓟州"],"beizhi|遵化州":[40.19,117.96,"遵化"],
 "beizhi|祁州":[38.56,115.26,"安国"],"beizhi|安州":[38.86,115.83,"安新"],"beizhi|易州":[39.35,115.52,"易县"],
 "beizhi|景州":[37.69,116.27,"景县"],"beizhi|沧州":[38.31,116.86,"沧州"],"beizhi|定州":[38.52,114.99,"定州"],
 "beizhi|冀州":[37.56,115.42,"冀州"],"beizhi|晋州":[38.04,115.03,"晋州"],"beizhi|赵州":[37.75,114.80,"赵县"],
 "beizhi|深州":[38.04,115.56,"深州"],"beizhi|开州":[35.75,114.93,"濮阳"],"beizhi|滦州":[39.76,118.68,"滦州"],
 # 南直隶
 "nanzhi|寿州":[32.58,116.79,"寿县"],"nanzhi|泗州":[33.28,118.50,"盱眙北"],"nanzhi|宿州":[33.65,116.97,"宿州"],
 "nanzhi|颍州":[32.90,115.81,"阜阳"],"nanzhi|亳州":[33.85,115.78,"亳州"],"nanzhi|海州":[34.60,119.22,"连云港海州"],
 "nanzhi|邳州":[34.32,117.96,"邳州"],"nanzhi|高邮州":[32.78,119.45,"高邮"],"nanzhi|泰州":[32.49,119.92,"泰州"],
 "nanzhi|通州":[32.06,120.86,"南通"],"nanzhi|太仓州":[31.46,121.11,"太仓"],"nanzhi|无为州":[31.30,117.89,"无为"],
 "nanzhi|六安州":[31.74,116.52,"六安"],
 # 山东
 "shandong|泰安州":[36.19,117.13,"泰安"],"shandong|德州":[37.45,116.36,"德州"],"shandong|武定州":[37.49,117.99,"惠民"],
 "shandong|滨州":[37.38,118.02,"滨州"],"shandong|济宁州":[35.42,116.59,"济宁"],"shandong|东平州":[35.94,116.47,"东平"],
 "shandong|曹州":[35.24,115.48,"菏泽"],"shandong|沂州":[35.07,118.34,"临沂"],"shandong|临清州":[36.85,115.71,"临清"],
 "shandong|高唐州":[36.87,116.23,"高唐"],"shandong|濮州":[35.71,115.53,"鄄城"],"shandong|莒州":[35.58,118.84,"莒县"],
 "shandong|平度州":[36.79,119.96,"平度"],"shandong|胶州":[36.28,120.03,"胶州"],"shandong|宁海州":[37.40,121.10,"牟平"],
 # 山西
 "shanxi|平定州":[37.86,113.66,"平定"],"shanxi|忻州":[38.42,112.74,"忻州"],"shanxi|代州":[39.07,112.96,"代县"],
 "shanxi|岢岚州":[38.70,111.57,"岢岚"],"shanxi|保德州":[38.79,111.08,"保德"],"shanxi|蒲州":[34.86,110.46,"永济"],
 "shanxi|解州":[35.02,110.88,"运城解州"],"shanxi|绛州":[35.62,111.22,"新绛"],"shanxi|霍州":[36.57,111.76,"霍州"],
 "shanxi|吉州":[36.10,110.68,"吉县"],"shanxi|隰州":[36.70,110.94,"隰县"],"shanxi|永宁州":[37.54,111.14,"离石"],
 "shanxi|浑源州":[39.72,113.68,"浑源"],"shanxi|应州":[39.55,113.19,"应县"],"shanxi|朔州":[39.33,112.43,"朔州"],
 "shanxi|蔚州":[39.84,114.59,"蔚县"],
 # 河南
 "henan|陈州":[33.73,114.88,"淮阳"],"henan|许州":[34.03,113.85,"许昌"],"henan|禹州":[34.14,113.49,"禹州"],
 "henan|郑州":[34.75,113.62,"郑州"],"henan|陕州":[34.79,111.10,"三门峡陕州"],"henan|磁州":[36.37,114.38,"磁县"],
 "henan|睢州":[34.45,115.07,"睢县"],"henan|信阳州":[32.13,114.09,"信阳"],"henan|光州":[32.13,115.17,"潢川"],
 "henan|邓州":[32.69,112.09,"邓州"],"henan|裕州":[33.26,113.01,"方城"],
 # 陕西
 "shanxix|华州":[34.53,109.78,"华州"],"shanxix|商州":[33.87,109.94,"商洛"],"shanxix|同州":[34.80,110.09,"大荔"],
 "shanxix|耀州":[34.91,108.98,"耀州"],"shanxix|乾州":[34.76,108.32,"乾县"],"shanxix|陇州":[34.90,106.86,"陇县"],
 "shanxix|宁羌州":[32.82,106.15,"宁强"],"shanxix|兴安州":[32.70,109.03,"安康"],"shanxix|绥德州":[37.51,110.27,"绥德"],
 "shanxix|葭州":[38.27,110.49,"佳县"],"shanxix|宁州":[35.51,107.91,"宁县"],"shanxix|泾州":[35.33,107.37,"泾川"],
 "shanxix|静宁州":[35.52,105.73,"静宁"],"shanxix|秦州":[34.58,105.72,"天水"],"shanxix|阶州":[33.39,104.90,"武都"],
 "shanxix|徽州":[33.87,106.10,"徽县"],"shanxix|兰州":[36.06,103.83,"兰州"],
 # 四川
 "sichuan|简州":[30.41,104.55,"简阳"],"sichuan|崇庆州":[30.63,103.68,"崇州"],"sichuan|汉州":[30.99,104.20,"广汉"],
 "sichuan|绵州":[31.47,104.74,"绵阳"],"sichuan|茂州":[31.68,103.85,"茂县"],"sichuan|威州":[31.48,103.58,"汶川"],
 "sichuan|剑州":[32.21,105.35,"剑阁"],"sichuan|巴州":[31.87,106.74,"巴中"],"sichuan|蓬州":[30.84,106.41,"蓬安"],
 "sichuan|广安州":[30.47,106.63,"广安"],"sichuan|达州":[31.21,107.47,"达州"],"sichuan|合州":[29.99,106.28,"合川"],
 "sichuan|忠州":[30.30,108.04,"忠县"],"sichuan|涪州":[29.70,107.39,"涪陵"],"sichuan|真安州":[28.60,107.60,"道真旧城"],
 # 湖广
 "huguang|兴国州":[29.84,115.18,"阳新"],"huguang|蕲州":[30.11,115.44,"蕲春蕲州"],"huguang|荆门州":[31.04,112.20,"荆门"],
 "huguang|沔阳州":[30.37,113.44,"仙桃"],"huguang|随州":[31.71,113.38,"随州"],"huguang|澧州":[29.64,111.76,"澧县"],
 "huguang|夷陵州":[30.77,111.29,"宜昌"],"huguang|归州":[30.96,110.70,"秭归归州"],"huguang|均州":[32.54,108.51,"丹江口"],
 "huguang|茶陵州":[26.79,113.54,"茶陵"],"huguang|桂阳州":[25.75,112.73,"桂阳"],"huguang|道州":[25.53,111.60,"道县"],
 "huguang|武冈州":[26.73,110.63,"武冈"],"huguang|沅州":[27.94,109.68,"芷江"],
 # 江西 / 浙江
 "jiangxi|宁州":[29.04,114.57,"修水"],"zhejiang|安吉州":[30.64,119.68,"安吉"],
 # 广西（土州近似）
 "guangxi|郁林州":[22.63,110.15,"玉林"],"guangxi|南丹州":[24.98,107.54,"南丹"],"guangxi|东兰州":[24.51,107.37,"东兰"],
 "guangxi|新宁州":[22.63,107.90,"扶绥"],"guangxi|上思州":[22.16,107.85,"上思"],"guangxi|归德州":[23.20,107.60,"平果归德"],
 "guangxi|果化州":[23.30,107.45,"平果果化"],"guangxi|忠州":[22.75,108.00,"扶绥东门"],"guangxi|左州":[22.72,107.60,"崇左左州"],
 "guangxi|养利州":[22.83,107.30,"大新"],"guangxi|永康州":[22.82,107.44,"大新永康"],"guangxi|上石西州":[21.92,106.80,"凭祥上石"],
 "guangxi|太平州":[22.46,107.23,"崇左太平"],"guangxi|思城州":[22.38,107.30,"崇左北"],"guangxi|安平州":[22.42,107.15,"大新安平"],
 "guangxi|万承州":[22.55,107.20,"大新龙门"],"guangxi|全茗州":[22.60,107.25,"大新全茗"],"guangxi|镇远州":[22.33,107.05,"大新南"],
 "guangxi|思同州":[22.42,107.32,"崇左东北"],"guangxi|茗盈州":[22.57,107.14,"大新老"],"guangxi|龙英州":[22.65,107.05,"天等龙英"],
 "guangxi|结安州":[22.50,107.10,"天等东"],"guangxi|结伦州":[22.52,107.05,"天等东南"],"guangxi|都结州":[22.68,107.02,"天等北"],
 "guangxi|上下冻州":[22.33,106.90,"龙州下冻"],"guangxi|思明州":[22.10,107.18,"宁明东"],
 # 云南
 "yunnan|晋宁州":[24.67,102.75,"晋宁晋城"],"yunnan|安宁州":[24.92,102.49,"安宁"],"yunnan|昆阳州":[24.66,102.59,"晋宁昆阳"],
 "yunnan|嵩明州":[25.33,103.04,"嵩明"],"yunnan|沾益州":[25.61,104.25,"沾益"],"yunnan|陆梁州":[25.03,103.67,"陆良"],
 "yunnan|马龙州":[25.41,103.57,"马龙"],"yunnan|罗平州":[24.88,104.31,"罗平"],"yunnan|石屏州":[23.71,102.49,"石屏"],
 "yunnan|阿迷州":[23.72,103.38,"开远"],"yunnan|宁州":[24.21,102.92,"华宁"],"yunnan|新化州":[24.07,101.99,"新平"],
 "yunnan|新兴州":[24.35,102.55,"玉溪"],"yunnan|路南州":[24.77,103.29,"石林"],"yunnan|师宗州":[24.83,103.99,"师宗"],
 "yunnan|弥勒州":[24.41,103.44,"弥勒"],"yunnan|维摩州":[23.72,104.20,"砚山维摩"],"yunnan|富州":[23.60,105.63,"富宁"],
 "yunnan|南安州":[25.03,101.55,"双柏"],"yunnan|镇南州":[25.24,101.09,"南华"],"yunnan|禄劝州":[25.55,102.47,"禄劝"],
 "yunnan|赵州":[25.60,100.32,"大理凤仪"],"yunnan|邓川州":[26.11,100.10,"洱源邓川"],"yunnan|宾川州":[25.83,100.59,"宾川"],
 "yunnan|云龙州":[25.90,99.07,"云龙"],"yunnan|剑川州":[26.53,99.91,"剑川"],"yunnan|顺州":[26.42,100.65,"永顺古"],
 "yunnan|宝山州":[27.10,100.35,"丽江宝山"],"yunnan|兰州":[26.40,99.20,"兰坪"],"yunnan|巨津州":[27.10,99.90,"丽江巨甸"],
 "yunnan|北胜州":[26.66,100.75,"永胜"],"yunnan|腾越州":[25.02,98.50,"腾冲"],"yunnan|云州":[24.45,100.13,"云县"],
 "yunnan|威远州":[23.50,100.70,"景谷"],"yunnan|湾甸州":[24.45,99.30,"昌宁湾甸"],"yunnan|镇康州":[24.03,99.22,"永德"],
 # 贵州
 "guizhou|程番州":[26.13,106.67,"惠水"],"guizhou|开州":[27.06,106.97,"开阳"],"guizhou|广顺州":[26.42,106.32,"长顺广顺"],
 "guizhou|普安州":[25.81,104.47,"盘州普安"],
}

def inject_zhou_coords(data):
    n = 0
    for p in data["provinces"]:
        for u in p["fu"]:
            for z in u.get("zx", []):
                c = ZHOU_COORDS.get(f'{p["id"]}|{z["n"]}')
                if c:
                    z["c"] = [c[0], c[1]]; z["now"] = c[2]; n += 1
    return n




# ── 县治推算：正文段首"县名府方位N里" → 以府/州治为锚三角化 ──────────────
DIR_DEG = {"东": 90, "南": 180, "西": 270, "北": 0,
           "东南": 135, "西南": 225, "东北": 45, "西北": 315}
KM_PER_LI = 0.576 * 0.62          # 明里→公里 × 驿路/直线标定（audit.py 中位 0.62）

def _cn_li(s_):
    tok = {"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9}
    total, num = 0, 0
    i = 0
    while i < len(s_):
        ch = s_[i]
        if ch in tok:
            num = tok[ch]
            if i+1 < len(s_) and s_[i+1] == "百":
                total += num*100; num = 0; i += 2; continue
            i += 1
        elif ch == "百":
            total += 100; i += 1
        elif ch == "十":
            total += (num or 1)*10; num = 0; i += 1
        else:
            i += 1
    return total + num

def offset_point(anchor, bearing_deg, km):
    import math
    lat0, lng0 = anchor
    br = math.radians(bearing_deg)
    dlat = km * math.cos(br) / 111.0
    dlng = km * math.sin(br) / (111.0 * math.cos(math.radians(lat0)))
    return [round(lat0 + dlat, 3), round(lng0 + dlng, 3)]

def derive_county_coords(data):
    """逐省扫描卷全文段落：段首"县名(府|州)方位N里" → 推算坐标存 fu['xianc']"""
    n_prov, n_hit = 0, 0
    for p in data["provinces"]:
        rng = None
        for pid, _pn, _x, lo, hi in PROVINCES:
            if pid == p["id"]:
                rng = range(lo, hi+1); break
        if not rng:
            continue
        paras = []
        for fn in vol_files(rng.start, rng.stop - 1):
            paras += [l.strip() for l in read(fn).split(chr(10)) if l.strip()]
        anchor = None; anchor_name = ""
        zhou_c = {z["n"]: z["c"] for u in p["fu"] for z in u.get("zx", []) if z.get("c")}
        xianc = {}
        for para in paras:
            mz = re.match(r"^([一-鿿]{1,4}州)", para)
            if mz and mz.group(1) in zhou_c:
                anchor = zhou_c[mz.group(1)]; anchor_name = mz.group(1)
                continue
            m = re.match(r"^([一-鿿]{1,4}县)(?:〔[^〕]*〕)?(府|州)(东|南|西|北|东南|东北|西南|西北)([一二三四五六七八九十百]+)里", para)
            if not m:
                continue
            nm, base, dr, li = m.group(1), m.group(2), m.group(3), m.group(4)
            if base == "府":
                anchor = None; anchor_name = ""      # 县段以府为锚
            u_ref = next((u for u in p["fu"] if nm in u["xian"] or
                          any(nm in z.get("x", []) for z in u.get("zx", []))), None)
            a = anchor if (base == "州" and anchor) else (u_ref["c"] if u_ref and u_ref.get("c") else None)
            if not a:
                continue
            km = _cn_li(li) * KM_PER_LI
            if not (2 < km < 260):
                continue
            pos = offset_point(a, DIR_DEG[dr], km)
            if 18 < pos[0] < 54 and 73 < pos[1] < 136:
                if u_ref:
                    u_ref.setdefault("xianc", {})[nm] = pos
                    n_hit += 1
        n_prov += 1
    return n_prov, n_hit


if __name__ == "__main__":
    main()
