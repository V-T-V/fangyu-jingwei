# -*- coding: utf-8 -*-
"""文档同步哨兵：ANALYSIS.md 改动必须伴随论文 PDF 重排。
   md 新于 PDF 即红——消灭「md 加段、PDF 忘排」的内容漂移。"""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD = os.path.join(ROOT, "ANALYSIS.md")
PDF = os.path.join(ROOT, "docs", "方舆经纬-空间与文本计量研究.pdf")
mt, pt = os.path.getmtime(MD), os.path.getmtime(PDF)
if mt > pt + 60:
    import time
    print(f"✗ 文档失同步：ANALYSIS.md ({time.strftime('%H:%M', time.localtime(mt))}) "
          f"新于 PDF ({time.strftime('%H:%M', time.localtime(pt))})——请重跑 docs/build_paper_pdf.py")
    sys.exit(1)
print("✓ ANALYSIS.md ↔ PDF 同步")
