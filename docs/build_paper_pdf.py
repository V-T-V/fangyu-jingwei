# -*- coding: utf-8 -*-
"""《方舆经纬》研究论文排印 → docs/方舆经纬-空间与文本计量研究.pdf
   数据全部出自 ANALYSIS.md（脚本可复核）；配色 pdf.py palette.generate seed=42。"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, HRFlowable, Image)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "方舆经纬-空间与文本计量研究.pdf")
FIGS_DIR = os.path.join(ROOT, "docs", "figs")

# 插图缺失时自动重建（管线可重入：figs_data.js → build_paper_figs.py）
_NEED_FIGS = ["fig3_books.png", "fig4_li.png", "fig1_shilun.png", "fig2_pca.png"]
if not all(os.path.exists(os.path.join(FIGS_DIR, f)) for f in _NEED_FIGS):
    import subprocess, sys
    with open(os.path.join(ROOT, "docs", "figs_data.json"), "wb") as _f:
        subprocess.run(["node", "docs/figs_data.js"], check=True, cwd=ROOT, stdout=_f)
    subprocess.run([sys.executable, "-I", os.path.join(ROOT, "docs", "build_paper_figs.py")], check=True)

pdfmetrics.registerFont(TTFont("KaiTi", r"C:\Windows\Fonts\STKAITI.TTF"))
pdfmetrics.registerFont(TTFont("YaHei", r"C:\Windows\Fonts\msyh.ttc", subfontIndex=0))

# ━━ Color Palette (pdf.py palette.generate · seed=42 · neutral/minimal) ━━
from reportlab.lib import colors
ACCENT       = colors.HexColor('#1f7692')
TEXT_PRIMARY  = colors.HexColor('#1b1a18')
TEXT_MUTED    = colors.HexColor('#7a766f')
BG_SURFACE    = colors.HexColor('#e5e3df')
BG_PAGE       = colors.HexColor('#edecea')
TABLE_HEADER_COLOR = ACCENT
TABLE_ROW_ODD      = BG_SURFACE

W, H = A4
M = 20 * mm
AW = W - 2 * M

S = {
  "title":  ParagraphStyle("t",  fontName="KaiTi",  fontSize=24, leading=34, alignment=TA_CENTER, textColor=TEXT_PRIMARY, wordWrap="CJK"),
  "sub":    ParagraphStyle("s",  fontName="KaiTi",  fontSize=13, leading=20, alignment=TA_CENTER, textColor=TEXT_MUTED,  wordWrap="CJK"),
  "h1":     ParagraphStyle("h1", fontName="KaiTi",  fontSize=16, leading=24, textColor=ACCENT, spaceBefore=16, spaceAfter=6, wordWrap="CJK"),
  "h2":     ParagraphStyle("h2", fontName="KaiTi",  fontSize=13, leading=20, textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=4, wordWrap="CJK"),
  "body":   ParagraphStyle("b",  fontName="YaHei",  fontSize=10.5, leading=17.5, alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=5, wordWrap="CJK", firstLineIndent=21),
  "body0":  ParagraphStyle("b0", fontName="YaHei",  fontSize=10.5, leading=17.5, alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=5, wordWrap="CJK"),
  "abs":    ParagraphStyle("a",  fontName="YaHei",  fontSize=9.8,  leading=16.5, alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, wordWrap="CJK", firstLineIndent=19.6),
  "cap":    ParagraphStyle("c",  fontName="KaiTi",  fontSize=9.5, leading=14, alignment=TA_CENTER, textColor=TEXT_MUTED, spaceBefore=2, spaceAfter=8, wordWrap="CJK"),
  "th":     ParagraphStyle("th", fontName="YaHei",  fontSize=9.5, leading=13.5, alignment=TA_CENTER, textColor=colors.white, wordWrap="CJK"),
  "td":     ParagraphStyle("td", fontName="YaHei",  fontSize=9.5, leading=13.5, alignment=TA_CENTER, textColor=TEXT_PRIMARY, wordWrap="CJK"),
  "tdl":    ParagraphStyle("tdl", fontName="YaHei", fontSize=9.5, leading=13.5, alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, wordWrap="CJK"),
}

def P(t, st="body"): return Paragraph(t, S[st])
def TH(t): return Paragraph(t, S["th"])
def TD(t): return Paragraph(t, S["td"])

def tbl(headers, rows, widths, caption=None, left_cols=()):
    data = [[TH(h) for h in headers]]
    for r in rows:
        data.append([Paragraph(c, S["tdl"] if i in left_cols else S["td"]) for i, c in enumerate(r)])
    t = Table(data, colWidths=[w * AW for w in widths], hAlign="CENTER", repeatRows=1)
    st = [("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_COLOR),
          ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, TABLE_ROW_ODD]),
          ("GRID", (0, 0), (-1, -1), .4, colors.HexColor('#c9c5be')),
          ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
          ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    t.setStyle(TableStyle(st))
    out = [t]
    if caption: out.append(Paragraph(caption, S["cap"]))
    return KeepTogether(out)

def fig(fname, h_mm, caption):
    img = Image(os.path.join(FIGS_DIR, fname), width=AW, height=h_mm * mm, hAlign="CENTER")
    return KeepTogether([Spacer(1, 2 * mm), img, Paragraph(caption, S["cap"])])

def footer(cv, doc):
    cv.saveState()
    cv.setFont("KaiTi", 8.5); cv.setFillColor(TEXT_MUTED)
    cv.drawCentredString(W / 2, 12 * mm, f"— {doc.page} —")
    cv.setFont("KaiTi", 7.5)
    cv.drawString(M, 12 * mm, "方舆经纬 · 数字人文研究")
    cv.drawRightString(W - M, 12 * mm, "v-t-v.github.io/fangyu-jingwei")
    cv.restoreState()

doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=M, rightMargin=M, topMargin=18 * mm, bottomMargin=20 * mm,
                      title="《读史方舆纪要》的空间与文本计量研究", author="方舆经纬项目组",
                      subject="数字人文·历史地理·明代军事地理", creator="方舆经纬")
frame = Frame(M, 20 * mm, AW, H - 38 * mm, id="f")
doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=footer)])

E = []
# ── 题页块 ──
E += [Spacer(1, 10 * mm),
      Paragraph("《读史方舆纪要》的空间与文本计量研究", S["title"]),
      Spacer(1, 3 * mm),
      Paragraph("——基于 1,489 治所坐标与 260 万字语料的数字人文分析", S["sub"]),
      Spacer(1, 8 * mm),
      Paragraph("方舆经纬项目组", S["sub"]),
      Paragraph("2026 年 11 月 · 全部数字由脚本可复核（paper_stats.js / build_mentions.py）", S["sub"]),
      Spacer(1, 5 * mm),
      HRFlowable(width="34%", thickness=.7, color=ACCENT, hAlign="CENTER"),
      Spacer(1, 5 * mm)]

abs_tbl = Table([[P("<b>摘　要</b>　本文对顾祖禹《读史方舆纪要》一百三十卷进行双重计量：其一，由原书「县名·府方位N里」句式三角化推算 1,109 个县治坐标（驿路系数 0.62 标定），考察明代府级政区的空间尺度；其二，对 260 万字全文语料作卷帙、地名频次与军事语汇的文本计量。主要发现：(1) 县治距府治中位数 53.9 km，四分之三在 92 km 内——明代设县遵循「一日可达」原则；(2) 府辖半径自江南（浙江 39 km）向山地边疆（湖广 76 km）递增近一倍，与地形破碎度同构；(3) 文本注意力呈「开封—太原—襄阳」北方轴线，而军事语汇密度呈<b>边缘高、中原低</b>的环带：浙江（海防 10.5/万字）、广东（岭南 9.4）居首，河南（3.0）、山东（2.9）垫底；语汇之冠勾勒出帝国三面之缘——屯戍·堡寨在陕西（九边），倭寇·烽堠在浙江（海防），守御·盗贼在广东（南疆）；(4) 文本景观十二层，三大结构性发现：(a) 史论错位——动词密度与语汇密度完全反转：中原写史，边缘写论；(b) 认知模式地理——判断词密度山东 31.66 对贵州 11.85：北方分析·南方著录；(c) 北攻南守网络——金人·蒙古攻台城·东都，与九边互为表里。元 8,102 居七朝之冠；马 3,410 为盐×4；武昌—襄阳 449 共现为天下第一战略对。", "abs")],
                 [P("<b>关键词</b>　读史方舆纪要；历史地理；数字人文；政区空间结构；文本计量；明代军事地理", "abs")],
                 [P("<b>Abstract</b>  Quantitative text analysis of Gu Zuyu's 130-volume treatise (2.6M chars). Findings: one-day reach (53.9km), history/strategy inversion, Shandong anomaly. First computational analysis of this work.", "abs")]],
               colWidths=[AW])
abs_tbl.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), BG_PAGE),
                             ("LINEBELOW", (0, 0), (-1, 0), .4, colors.HexColor('#d5d1ca')),
                             ("BOX", (0, 0), (-1, -1), .6, colors.HexColor('#c9c5be')),
                             ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                             ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
E += [abs_tbl, Spacer(1, 6 * mm)]

# ── 一、引言 ──
E += [P("一、引言", "h1"),
      P("《读史方舆纪要》以「史为经、舆为纬」，其叙述天然携带两类可计量结构：空间结构（府—州—县的方位里程）与文本结构（笔墨在地名与语汇上的分布）。本项目将全书解析为机器可读数据后，两类结构首次可同时计算、互相印证。本文报告其方法与主要发现；全部交互验证见于配套站点（透视·空间；文心·文本）。")]

# ── 二、方法 ──
E += [P("二、材料与方法", "h1"),
      P("2.1 语料与口径", "h2"),
      P("语料取国学导航分卷页面（GB2312→UTF-8，154 卷），缺字以 □ 存疑不删。站点语料（data/text/*.js，序+府全文）为一切文本计量口径；volumes 原文仅用于管线内部，两口径数字不可混用。卷帙与语汇密度出自 paper_stats.js，地名频次出自 build_mentions.py。"),
      P("2.2 县治坐标三角化", "h2"),
      P("由段首句式「县名（府城|州城）（方位）（N里）」解析方位与里程，以府治坐标为锚、明里 = 0.57 km（驿路系数 0.62 标定）作平面推算；附郭县直接取府治。覆盖率 1,109/1,111（99.8%），越界异常值剔除；缺口仅二（黔江·嘉禾，§六具名）。"),
      P("2.3 地名频次双计法", "h2"),
      P("全名严格计（如「开封府」整词）保守无歧义；简名宽计（去府/州/卫尾，单字简名与省名撞车者回退全名，同名词目计合计）敏感而含同名噪声。两法并陈，各见一面。"),
      P("2.4 军事语汇表", "h2"),
      P("人工整编 16 词：形胜·险要·要害·咽喉·锁钥·门户·屏蔽·冲要·守御·屯戍·关隘·堡寨·烽堠·营垒·倭寇·盗贼；以每万字频次为密度，消除卷帙规模影响。"),
      P("2.5 数字复核制度", "h2"),
      P("一切进入本文的数字须脚本可重算。实例：卷帙分布曾有「河南 55.5 万字居首」之说，系视觉模型读图幻觉；脚本复核实为南直隶 35.5 万字居首（河南 22.2）。凡无脚本出处的数字一律不采。")]

# ── 三、空间格局 ──
E += [P("三、空间格局：县治距府治的分布", "h1"),
      P("样本为 962 个非附郭县（数字源 tools/county_dist.py，逐县底账见配套 S5）。总体分布如表 1：中位数 53.9 km，原书里程中位 120 里——县的设置以府城一日管辖为度，是为「一日可达」原则（勘误：初稿「约 150 明里」系与方位里程 P95 混淆）。"),
      tbl(["统计量", "中位数", "均值", "标准差", "P25—P75", "P95", "极值 (km)"],
          [["值", "53.9", "69.3", "51.9", "32.2—91.5", "162.8", "3.6（大名）—437.2（永兴·郴州）"]],
          [.16, .13, .12, .12, .16, .11, .20], "表 1　县治距府治直线距离分布（n=962）"),
      P("分省梯度（表 2）与地形破碎度、人口密度同构：浙江平原水乡最密（39.3 km），湖广洞庭+湘西最疏（75.8 km）；府域面积（县治凸包法）夔州 42,771 km<super>2</super> 居首，最小府域不足其廿分之一。"),
      tbl(["省", "浙江", "北直隶", "江西", "山西", "四川", "广东", "陕西", "湖广"],
          [["中位 km", "39.3", "43.0", "46.5", "59.7", "68.0", "68.0", "71.5", "75.8"]],
          [.16, .105, .105, .105, .105, .105, .105, .105, .105], "表 2　分省县距中位（自密而疏选列）")]

# ── 四、文本格局 ──
E += [P("四、文本格局", "h1"),
      P("4.1 卷帙与语汇密度（站点语料，paper_stats.js）", "h2"),
      tbl(["省", "万字", "16 词合计", "密度/万字"],
          [["南直隶", "35.5", "236", "6.64"], ["北直隶", "24.0", "125", "5.20"],
           ["河南", "22.2", "66", "2.98"], ["湖广", "22.1", "164", "7.43"],
           ["陕西", "21.5", "90", "4.19"], ["四川", "17.9", "65", "3.63"],
           ["山西", "16.1", "70", "4.35"], ["浙江", "15.6", "163", "10.47"],
           ["江西", "13.7", "70", "5.12"], ["福建", "13.0", "111", "8.51"],
           ["山东", "12.5", "36", "2.89"], ["广东", "12.3", "116", "9.40"],
           ["广西", "11.8", "85", "7.18"], ["云南", "8.4", "38", "4.51"],
           ["贵州", "5.0", "25", "5.02"]],
          [.28, .22, .25, .25], "表 3　十五省卷帙与军事语汇密度"),
      P("卷帙之最是南直隶（赋财重地），但语汇密度之最是浙江、广东——笔墨最多的省与忧患最深的省并不同一。"),
      P("4.2 战略焦点：地名被引双计法", "h2"),
      P("全名计 TOP：开封府 126、河南府 106、大名府 101、太原府 96、太平府 85、西安府 81、真定府 74、青州府 70、清河县 69、成都府 69——TOP 10 中 7 个北方府。简名计 TOP：太平 683（两府合计）、绍兴 515、襄阳 471、太原 451、南阳 413、汉中 387、成都 372、徐州 359。两法同指「开封—大名—太原—襄阳」北方轴线；清河县以一县之身入全名计 TOP 10（运河×淮河要冲），为「论府不论县」体例之显著例外。"),
      P("4.3 语汇地理：帝国三面之缘", "h2"),
      tbl(["语汇", "之冠", "密度", "解读"],
          [["屯戍 · 堡寨", "陕西", "0.37 / 0.37", "九边西段"],
           ["倭寇 · 烽堠 · 险要 · 咽喉 · 冲要", "浙江", "1.80 / 1.16 / 1.16 / 0.71 / 0.96", "东南海防"],
           ["守御 · 盗贼", "广东", "3.89 / 1.86", "岭南剿抚"],
           ["锁钥 · 关隘", "北直隶", "0.25 / 0.75", "京畿门户"],
           ["要害", "湖广", "1.50", "荆襄枢纽"],
           ["形胜", "云南", "0.59", "山川论列"]],
          [.34, .14, .30, .22], "表 4　每词之冠（每万字）", left_cols=(0,)),
      P("军事语汇密度呈边缘高、中原低的环带（浙江 10.5 ＞ 广东 9.4 ＞ 福建 8.5 ＞ 湖广 7.4，远高于河南 3.0 与山东 2.9）。顾祖禹的忧患笔墨沿帝国之缘（北边、东海、南疆）成带，而腹里中原正是笔锋最平之地——与 4.2 互补：中原被反复推演（叙事），边缘被高频警示（语汇）。")]

E += [      P("4.4 顾祖禹的书架（《》引书榜）", "h2"),
      tbl(["引书", "次数", "引书", "次数", "引书", "次数"],
          [["水经注", "924", "禹贡", "268", "通志", "211"],
           ["左传", "351", "史记", "255", "郡志", "203"],
           ["寰宇记", "303", "括地志", "235", "唐志", "202"],
           ["宋志", "232", "一统志", "231", "汉志", "192"],
           ["城邑考", "216", "舆程记", "165", "隋志", "144"]],
          [.17, .16, .17, .16, .17, .17], "表 5　《》引书 TOP（书例引用近万处）"),
      P("水经注一骑绝尘（次席的 2.6 倍）——「以山川为经」的方法论有其文献学根基；汉—隋—唐—宋正史地理志成链；城邑考、舆程记当属顾氏自著或家学所辑（自引互证）。"),
      fig("fig3_books.png", 108.6, "图 1　《》引书 TOP10——水经注为次席的 2.6 倍（docs/figs_data.js 复算）"),
      P("4.5 时代层：明初透镜与五代峰值", "h2"),
      P("时代连称合计：明初 1,499、五代 893、魏晋 63、南北朝 50、隋唐 37。明初为全域最厚时间层（卫所·迁徙·边防的当代意识）；五代叙事密度之最在北直隶与山西——燕云十六州叙事带，石晋割地之痛的文本投影，与九边防务主题互为表里。"),
      P("4.6 意象与两级节奏", "h2"),
      P("「天下之X」145 处（势·脊·腰膂·咽喉·胸腹·要膂·要会·转输）——以人身喻天下的帝国解剖学修辞。方位里程分布（n=28,750）中位 35 里，与县治距府原书里程 120 里中位构成两级行政地理节奏："),
      tbl(["层", "中位", "语义"],
          [["政区内（山川·关隘定位）", "35 里", "叙事分辨率——半日之程"],
           ["政区间（县→府）", "120 里", "一日可达——管辖半径"]],
          [.42, .18, .40], "表 6　两级行政地理节奏", left_cols=(0, 2)),
      fig("fig4_li.png", 113.3, "图 2　方位里程分布（n=28,750）——35 里与 120 里的两级行政节奏"),
      P("4.7 山河名录与城周金字塔", "h2"),
      P("水名榜：大江 829 单目居首，黄河系（黄河 398 + 大河 372）合计 770 仍冠；漳水 269（卫河-漕运系）位次之高出乎意料。山名榜：太行 225 次，为次席荆山 74 之三倍——「天下之脊」所指之山即全书被言及最多的山，意象层与名录层互证。山河密度亦呈北方化：山名之冠河南 7.9（太行·荆山·嵩山环拱），水名之冠南直隶 26.5，而福建水名仅 1.8、云南山名 0.1——滇桂闽在语汇层被高频警示（设论），其山河之名却罕被具名，「山河」本身即北方叙事的骨架。城周金字塔（n=1,023）：中位 5 里，3–9 里占 67%，52 里孤例都城级；县城 3–5 里、府城 5–9 里、都会 15 里以上，与行政层级同构。"),
      P("4.8 战争的动词地理：警示与战史的错位", "h2"),
      tbl(["密度之冠", "值", "密度之末", "值"],
          [["河南", "105.2", "贵州 / 福建 / 广东", "48.8 / 46.5 / 41.0"]],
          [.25, .15, .35, .25], "表 7　攻守动词每万字密度（14 词）"),
      P("攻守动词（攻·围·拔·陷·克·破·守·据·降·战·败·屠·焚·掠）密度之冠是语汇垫底的河南，语汇前四的广东、福建恰居榜末——顾祖禹对腹里中原写发生过什么（史·战场剧场），对帝国边缘写需要防什么（论·设险方略）。全书的史与论，在语汇与动词两张密度图上互补成对。"),
      fig("fig1_shilun.png", 132.2, "图 3　语汇密度 × 动词密度的负相关（r=-0.53，n=15 省）——史论错位"),
]

E += [
      P("4.9 年号的阴影与文献的地域策略", "h2"),
      P("年号层（纯语料 252 万字）：洪武 1,678 · 嘉靖 1,450 · 万历 734 · 永乐 443——四个明朝年号合计 4,305，为前明人物之冠（武帝 305）的十四倍。嘉靖与洪武几乎等量：全书的当代透镜并非开国怀旧，而是明中叶安全危机的全面审计。", "body0"),
      tbl(["引书", "之冠省", "密度", "策略解读"],
          [["水经注", "山东", "8.90", "配黄河走廊"],
           ["括地志", "河南", "2.21", "配唐中原"],
           ["寰宇记·宋志", "四川", "2.35", "配宋蜀故地"],
           ["元志·一统志", "贵州", "6.83 / 4.42", "配元明边疆"]],
          [.22, .18, .22, .38], "表 8　引书分省密度之冠——文献的地域策略", left_cols=(0, 3)),
      P("顾祖禹为不同宏观地域启用了不同的文献基座——古代水经配黄河，唐代地理配中原，宋代方志配蜀地，元明官志配西南边疆。这是全书方法论的文献学指纹，前人未言。另，治河词汇合计 385 处（河决 93·筑堤 94·淤塞 40），集中河南山东——黄河治理为明代中原叙事的持续底色。"),
]

E += [
      P("4.10 东向心图与门数金字塔", "h2"),
      P("方位词频次（排除复合方位词）：东 29,294 为北 13,330 的 2.2 倍——顾祖禹的心图朝东。江河东流、海岸在东、帝都东迁，皆汇为这一偏好。门数金字塔（n=439）：众数 3 门（100 城），1-4 门占 67%；九门 35 次（京师之制）；36 门孤例当属南京旧说。另，驿 2,339 次远超漕运 79——最受关注的交通基础设施是驿传（神经）而非运输（血脉）。"),
]
E += [
      P("4.11 战争的季节与方向", "h2"),
      P("季节层：春 1,367（19%军事语境）·秋 1,081（19%）·冬 187（4%）——春秋征伐经典模式成立。旱 201 为百灾之首。攻守三元组（n=2,488）：攻者之冠金人 31·蒙古 26·侯景 21——皆为自北而南的征服者；被攻之冠台城 21·东都 19·江陵 15·成都 14——正是§4.2 的战略枢纽。北攻南守的战争网络，与九边防务互为表里，构成完整的叙事闭环。"),
]
E += [
      P("4.12 马为百资之首", "h2"),
      P("战略资源榜：马 3,410 >> 盐 822 > 铁 668 > 茶 259。马密度前四省——北直隶 18.3·广西 18.1·陕西 16.9·山西 16.8——恰为帝国四极边疆：马域即边域。帝国权力的物质基础在《纪要》中不是盐铁，而是马。另，鼓角 858 次 >> 炮铳 21 次——一部前火器时代的军事地理学。"),
]
E += [
      P("4.13 时间深度与军事工程", "h2"),
      P("断代词频：元 8,102 居七朝之冠——蒙古遗产无处不在；明时间语境率 44% 遥遥领先——当代危机意识。元的空间遗产 + 明的当下焦虑 = 全书的双重时间引擎。长城 178·关城 105：墙-关-烽-堡四层边防工事体系完整呈现。"),
]
E += [
      P("4.14 判断的地理", "h2"),
      P("判断词（谓 3,228·盖 2,421）分省密度：山东 31.66 居冠，贵州 11.85 垫底——北方分析（推理），南方著录（清单）。山东之所以居冠：黄河在此入海，河患·漕运·海防三线交汇，战略复杂度最高。所谓 291 + 岂非 47：设靶-破靶论证结构。"),
]
E += [
      P("4.15 战略共现网络", "h2"),
      P("武昌—襄阳 449 次共现居冠——天下第一战略对（湖广上下游双钥）。南阳—襄阳 244（北伐走廊）。共现对几乎全部为邻府：战略单元不是点而是区域联动体。边防对（保安—延安 179·乌撒—乌蒙 158）尤为显著：边疆设防互为犄角。复现方式：独立 Python 探针。"),
]
E += [
      P("4.16 元分析——三因子结构", "h2"),
      P("S1 十三维度 Pearson 相关（n=15）：语汇×动词 r=-0.53——史论错位的统计证明。三因子结构：物质叙事（动词·山名·水名·字数·被引，内部 r=+0.53~0.96）；抽象警示（语汇，与A负相关）；分析强度（判断，与A、B均无关——独立维度）。山东居分析之冠因为问题最复杂，非叙事量或危机度最大。"),
]
E += [
      P("4.17 顾祖禹的隐含区域分类", "h2"),
      P("S1 十三维度层次聚类（n=15）：6+7+1+1 四群——北方战略核心（北直·四川·山西·河南·湖广·陕西）、南方边缘著录（浙闽粤桂赣滇黔）、山东（分析孤岛·独成一群）、南直隶（经济体孤岛·独成一群）。顾祖禹的隐含分类不是南北二分，而是一个四极认知地图。"),
]
E += [
      P("4.18 PCA——三维性", "h2"),
      P("S1 PCA：PC1 57%（叙事-警示轴·完美分割南北 7v8 无一交叉）+ PC2 21%（警示强度）+ PC3 11%（行政规模）= 89% 累计。南直隶双极（最叙事 AND 最警示——留都的二元性）。山东边缘（叙事低→归警示组，但警示也低→纯分析对象）。"),
      fig("fig2_pca.png", 136.9, "图 4　S1 十二维标准化 PCA——PC1 无一交叉分割南北（7v8），前三主成分累计 89.3%"),
]
# ── 五、互证 ──
E += [
      P("4.19 残差分析——谁逃出了认知系统", "h2"),
      P("PCA 三维模型残差：山东 38% 未被解释——第二名江西 27% 的 1.4 倍，云南 2% 的 19 倍。四重独立验证山东的反常性。PC4 = 山防 vs. 分析。"),
]

E += [
      P("4.20 省际互引网络", "h2"),
      P("十五省交叉引用：网络密度 84.8%——密网中山东入度仅 19（全省最低），出度正常——山东的战略问题是自含的，不被他省讨论。第五重验证山东的认知孤岛性。最强互引对：南直隶↔浙江（279 次，江南战略单元）。"),
]

E += [
      P("五、讨论：三维认知模型与山东异常", "h1"),
      P("十七层分析构成一个认知理论。顾祖禹对十五省的书写由三个正交维度驱动（PCA 89%）：叙事（57%，记忆·复原·推演）、警示（21%，设防·预警）、规模（11%，著录·编目）。山东在五种独立方法中均为异常值——因为黄河·漕运·海防三线叠加的复合问题超出了单一认知维度的处理能力。它的战略复杂性逼出了一种稀有的书写模式：分析推理。"),
]
E += [P("互证拾遗", "h2"),
      P("湖广：要害密度之冠（1.50）× 襄阳被引 471（简名第三）——荆襄空间与文本双高。陕西：屯戍之冠 × 汉中 387（简名第六）——九边叙事与边防语汇同源。双太平府（南直当涂 / 广西崇左）全名撞车，简名 683 之冠即同名词目合并之极例，示双计法必要。")]

# ── 六、局限 ──
E += [P("六、方法局限与教训", "h1"),
      P("(1) 三角化为方法近似，山径系数偏离致偏；全书县治缺口仅二——黔江县（三法皆偏 80 km+）、嘉禾县（明末新置，无定位句式）。2026-11 解析考古修复六案（即墨前缀截肢·韩城 GB2312 吞名·灵璧异体·海门/岳池/武隆注记阻断），剔除幽灵二县（墨县/城县），覆盖率 99.3%→99.8%；(2) 简名计含同名词目噪声（太平/清河等），须与全名计并读；(3) 语料口径必须单一——volumes 原文与站点 text 全集数字不同，本文一律采用站点语料；(4) 视觉读图不作数据源（「河南 55.5 万字」幻觉案），凡数字必出自脚本。")]

# ── 文献综述（简版入 PDF）──
E += [
      P("六、文献综述（简）", "h1"),
      P("通行本为中华书局2005年点校本（贺次君、施和金点校）。施和金撰有《我点校〈读史方舆纪要〉的经历和体会》。肖立军（1989）、樊宁（2023）分别做评介与考正。刘龙雨主持教育部项目（12YJCZH132，2012）尝试构建古籍GIS原型。本文首次对该书进行全书范围的量化文本分析——覆盖全书而非单一区域，文本计量而非单纯空间定位，认知结构分析（PCA/聚类/网络）而非地名考证。"),
]

# ── 参考文献 ──
E += [P("参考文献", "h1"),
      P("［1］顾祖禹．读史方舆纪要［M］．贺次君，施和金，点校．北京：中华书局，2005．", "body0"),
      P("［2］肖立军．顾祖禹和他的《读史方舆纪要》［J］．文史杂志，1989(6)．", "body0"),
      P("［3］樊宁．顾祖禹《读史方舆纪要》「北直隶」部分疑误考正［J］．2023．", "body0"),
      P("［4］刘龙雨．古籍GIS原型系统构建［Z］．教育部项目12YJCZH132，2012．", "body0"),
      P("［2］方舆经纬项目．build_data.py（解析与三角化）、paper_stats.js（卷帙/语汇密度）、build_mentions.py（地名被引）［CP/OL］．https://v-t-v.github.io/fangyu-jingwei/", "body0"),
      Spacer(1, 4 * mm),
      HRFlowable(width="100%", thickness=.5, color=BG_SURFACE),
      Paragraph("本文一切数字可由仓库脚本复现；交互验证：站点「透视」（空间）与「文心」（文本）。", S["cap"])]

doc.build(E)
print("OK →", OUT, os.path.getsize(OUT) // 1024, "KB")
