# -*- coding: utf-8 -*-
"""《方舆经纬》研究论文排印 → docs/方舆经纬-空间与文本计量研究.pdf
   数据全部出自 ANALYSIS.md（脚本可复核）；配色 pdf.py palette.generate seed=42。"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, HRFlowable)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "方舆经纬-空间与文本计量研究.pdf")

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
E += [Spacer(1, 16 * mm),
      Paragraph("《读史方舆纪要》的空间与文本计量研究", S["title"]),
      Spacer(1, 3 * mm),
      Paragraph("——基于 1,476 治所坐标与 260 万字语料的数字人文分析", S["sub"]),
      Spacer(1, 8 * mm),
      Paragraph("方舆经纬项目组", S["sub"]),
      Paragraph("2026 年 11 月 · 全部数字由脚本可复核（paper_stats.js / build_mentions.py）", S["sub"]),
      Spacer(1, 8 * mm),
      HRFlowable(width="34%", thickness=.7, color=ACCENT, hAlign="CENTER"),
      Spacer(1, 8 * mm)]

abs_tbl = Table([[P("<b>摘　要</b>　本文对顾祖禹《读史方舆纪要》一百三十卷进行双重计量：其一，由原书「县名·府方位N里」句式三角化推算 1,096 个县治坐标（驿路系数 0.62 标定），考察明代府级政区的空间尺度；其二，对 260 万字全文语料作卷帙、地名频次与军事语汇的文本计量。主要发现：(1) 县治距府治中位数 53.7 km，四分之三在 90 km 内——明代设县遵循「一日可达」原则；(2) 府辖半径自江南（浙江 39 km）向山地边疆（湖广 76 km）递增近一倍，与地形破碎度同构；(3) 文本注意力呈「开封—太原—襄阳」北方轴线，而军事语汇密度呈<b>边缘高、中原低</b>的环带：浙江（海防 10.5/万字）、广东（岭南 9.4）居首，河南（3.0）、山东（2.9）垫底；语汇之冠勾勒出帝国三面之缘——屯戍·堡寨在陕西（九边），倭寇·烽堠在浙江（海防），守御·盗贼在广东（南疆）。", "abs"),
                 P("<b>关键词</b>　读史方舆纪要；历史地理；数字人文；政区空间结构；文本计量；明代军事地理", "abs")]],
               colWidths=[AW])
abs_tbl.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), BG_PAGE),
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
      P("由段首句式「县名（府城|州城）（方位）（N里）」解析方位与里程，以府治坐标为锚、明里 = 0.57 km（驿路系数 0.62 标定）作平面推算；附郭县直接取府治。覆盖率 1,096/1,104（99.3%），越界异常值剔除。"),
      P("2.3 地名频次双计法", "h2"),
      P("全名严格计（如「开封府」整词）保守无歧义；简名宽计（去府/州/卫尾，单字简名与省名撞车者回退全名，同名词目计合计）敏感而含同名噪声。两法并陈，各见一面。"),
      P("2.4 军事语汇表", "h2"),
      P("人工整编 16 词：形胜·险要·要害·咽喉·锁钥·门户·屏蔽·冲要·守御·屯戍·关隘·堡寨·烽堠·营垒·倭寇·盗贼；以每万字频次为密度，消除卷帙规模影响。"),
      P("2.5 数字复核制度", "h2"),
      P("一切进入本文的数字须脚本可重算。实例：卷帙分布曾有「河南 55.5 万字居首」之说，系视觉模型读图幻觉；脚本复核实为南直隶 35.5 万字居首（河南 22.2）。凡无脚本出处的数字一律不采。")]

# ── 三、空间格局 ──
E += [P("三、空间格局：县治距府治的分布", "h1"),
      P("样本为 949 个非附郭县。总体分布如表 1：中位数 53.7 km ≈ 驿路一日程（约 150 明里）——县的设置以府城一日管辖为度，是为「一日可达」原则。"),
      tbl(["统计量", "中位数", "均值", "标准差", "P25—P75", "P95", "极值 (km)"],
          [["值", "53.7", "68.8", "51.3", "32.2—89.6", "161.0", "3.6（大名）—437.7（永兴·陕西）"]],
          [.16, .13, .12, .12, .16, .11, .20], "表 1　县治距府治直线距离分布（n=949）"),
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

# ── 五、互证 ──
E += [P("五、互证拾遗", "h1"),
      P("湖广：要害密度之冠（1.50）× 襄阳被引 471（简名第三）——荆襄空间与文本双高。陕西：屯戍之冠 × 汉中 387（简名第六）——九边叙事与边防语汇同源。双太平府（南直当涂 / 广西崇左）全名撞车，简名 683 之冠即同名词目合并之极例，示双计法必要。")]

# ── 六、局限 ──
E += [P("六、方法局限与教训", "h1"),
      P("(1) 三角化为方法近似，山径系数偏离致偏（黔江一县三法皆偏 80 km+，记阙）；(2) 简名计含同名词目噪声（太平/清河等），须与全名计并读；(3) 语料口径必须单一——volumes 原文与站点 text 全集数字不同，本文一律采用站点语料；(4) 视觉读图不作数据源（「河南 55.5 万字」幻觉案），凡数字必出自脚本。")]

# ── 参考文献 ──
E += [P("参考文献", "h1"),
      P("［1］顾祖禹．读史方舆纪要［M］．一百三十卷．据国学导航分卷本．", "body0"),
      P("［2］方舆经纬项目．build_data.py（解析与三角化）、paper_stats.js（卷帙/语汇密度）、build_mentions.py（地名被引）［CP/OL］．https://v-t-v.github.io/fangyu-jingwei/", "body0"),
      Spacer(1, 4 * mm),
      HRFlowable(width="100%", thickness=.5, color=BG_SURFACE),
      Paragraph("本文一切数字可由仓库脚本复现；交互验证：站点「透视」（空间）与「文心」（文本）。", S["cap"])]

doc.build(E)
print("OK →", OUT, os.path.getsize(OUT) // 1024, "KB")
