# -*- coding: utf-8 -*-
"""论文插图生成：python docs/build_paper_figs.py

数据源（口径纪律）：
  - docs/figs_data.json  ← node docs/figs_data.js（与 paper_stats.js 同一正则/计数）
  - docs/supplementary/S1_provincial_metrics.csv（13 维分省矩阵）
输出：docs/figs/fig1..fig4.png（200dpi 绢底墨色）
"""
import csv, json, os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "figs")
os.makedirs(OUT, exist_ok=True)

# ── 绢底墨色版式 ──
SILK, INK, MUTED = "#f6f1e4", "#2b2620", "#8a7f6a"
CINNABAR, TEAL, GRIDC = "#b5442d", "#3a6b7a", "#e0d6c0"
plt.rcParams.update({
    "font.family": "Microsoft YaHei", "axes.unicode_minus": False,
    "figure.facecolor": SILK, "axes.facecolor": SILK,
    "axes.edgecolor": MUTED, "axes.labelcolor": INK,
    "xtick.color": INK, "ytick.color": INK, "text.color": INK,
})
KAI = FontProperties(fname=r"C:\Windows\Fonts\simkai.ttf", size=15)

D = json.load(open(os.path.join(HERE, "figs_data.json"), encoding="utf-8"))

# S1：13 列分省矩阵
rows = list(csv.reader(open(os.path.join(HERE, "supplementary", "S1_provincial_metrics.csv"), encoding="utf-8-sig")))
names = [r[0] for r in rows[1:]]
COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13]  # 字数·合计×4·密度×4·被引·府数·判断（剔除全零列）
X = np.array([[float(r[i]) for i in COLS] for r in rows[1:]])
vocab_d, verb_d = X[:, 2], X[:, 4]


def frame(ax):
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.grid(True, color=GRIDC, lw=.7, alpha=.8)
    ax.set_axisbelow(True)


# ══ 图 1　史论错位：语汇×动词 ══
fig, ax = plt.subplots(figsize=(7.2, 5.6), dpi=200)
frame(ax)
r = np.corrcoef(vocab_d, verb_d)[0, 1]
k, b = np.polyfit(vocab_d, verb_d, 1)
xs = np.linspace(vocab_d.min() - .3, vocab_d.max() + .3, 10)
ax.plot(xs, k * xs + b, "--", color=CINNABAR, lw=1.6, zorder=2)
OFF = {"河南": (6, 4), "山东": (6, -16), "陕西": (6, 4), "山西": (6, 4), "北直隶": (6, 4),
       "南直隶": (6, 4), "湖广": (10, 8), "四川": (6, -12), "浙江": (-12, 10), "广东": (-16, 4),
       "福建": (6, 4), "江西": (6, 4), "广西": (6, 4), "云南": (-34, -14), "贵州": (6, -12)}
for i, n in enumerate(names):
    emph = n in ("河南", "山东", "广东")
    ax.scatter(vocab_d[i], verb_d[i], s=64 if emph else 40,
               color=CINNABAR if emph else TEAL, zorder=3,
               edgecolor=INK, lw=.6)
    ax.annotate(n, (vocab_d[i], verb_d[i]), textcoords="offset points",
                xytext=OFF[n], fontsize=9,
                color=CINNABAR if emph else INK,
                fontweight="bold" if emph else "normal")
ax.set_xlabel("军事语汇密度（16 词 / 万字）→ 论·警示")
ax.set_ylabel("攻守动词密度（14 词 / 万字）→ 史·叙事")
ax.set_title("史论错位：语汇与动词的负相关", fontproperties=KAI, pad=12)
ax.text(.97, .95, f"Pearson r = {r:.2f}（n = 15 省）", transform=ax.transAxes,
        ha="right", va="top", fontsize=10.5, color=CINNABAR,
        bbox=dict(boxstyle="round,pad=.4", fc=SILK, ec=CINNABAR, lw=.8))
fig.tight_layout()
fig.savefig(os.path.join(OUT, "fig1_shilun.png"))
plt.close(fig)

# ══ 图 2　PCA 三维认知 ══
Z = (X - X.mean(0)) / X.std(0)
U, S, _ = np.linalg.svd(Z, full_matrices=False)
var = S ** 2 / (S ** 2).sum()
pc1, pc2 = U[:, 0] * S[0], U[:, 1] * S[1]
if pc1[names.index("河南")] > 0:  # 定向与 §4.18 一致：叙事为负（左）
    pc1, pc2 = -pc1, -pc2
# 论文口径（§4.18）：PC1 正向叙事极 7 省 = 南直隶+北直隶+豫+晋+陕+川+湖广；
# 负向警示极 8 省 = 浙赣闽粤桂滇黔 + 山东（叙事低被归入警示组，但其警示亦低——纯分析对象）
WARN_SIDE = {"浙江", "江西", "福建", "广东", "广西", "云南", "贵州", "山东"}
split_ok = all((pc1[i] < 0) == (n not in WARN_SIDE) for i, n in enumerate(names))

fig, ax = plt.subplots(figsize=(7.2, 5.8), dpi=200)
frame(ax)
for i, n in enumerate(names):
    if n == "山东":
        ax.scatter(pc1[i], pc2[i], s=150, facecolor="none", edgecolor=CINNABAR, lw=2.2, zorder=4)
        ax.annotate("山东（分析孤岛）", (pc1[i], pc2[i]), textcoords="offset points",
                    xytext=(10, 8), fontsize=10.5, color=CINNABAR, fontweight="bold")
    else:
        ax.scatter(pc1[i], pc2[i], s=58, color=TEAL if n in WARN_SIDE else CINNABAR,
                   alpha=.85, edgecolor=INK, lw=.5, zorder=3)
    if n != "山东":
        OFF2 = {"福建": (5, 10), "云南": (5, -15), "广东": (-13, -3), "广西": (-9, 7), "浙江": (8, 6)}
        ax.annotate(n, (pc1[i], pc2[i]), textcoords="offset points",
                    xytext=OFF2.get(n, (7, 5)), fontsize=9,
                    ha="right" if n == "广东" else "left")
ax.scatter([], [], color=CINNABAR, label="叙事极·七省（含南直隶）")
ax.scatter([], [], color=TEAL, label="警示极·八省（含山东）")
ax.legend(loc="lower left", frameon=True, facecolor=SILK, edgecolor=MUTED, fontsize=9.5)
ax.set_xlabel(f"PC1（{var[0]*100:.1f}%）叙事 — 警示")
ax.set_ylabel(f"PC2（{var[1]*100:.1f}%）警示强度")
ax.set_title("三维认知结构：PC1 无一交叉地分割南北", fontproperties=KAI, pad=12)
ax.text(.97, .95, f"前三主成分累计 {var[:3].sum()*100:.1f}%", transform=ax.transAxes,
        ha="right", va="top", fontsize=10.5, color=INK,
        bbox=dict(boxstyle="round,pad=.4", fc=SILK, ec=MUTED, lw=.8))
fig.tight_layout()
fig.savefig(os.path.join(OUT, "fig2_pca.png"))
plt.close(fig)

# ══ 图 3　引书 TOP10 ══
books = D["books_top"][::-1]  # barh 自下而上
fig, ax = plt.subplots(figsize=(7.2, 4.6), dpi=200)
frame(ax)
labels = [b[0] for b in books]
vals = [b[1] for b in books]
colors = [CINNABAR if l == "水经注" else TEAL for l in labels]
ax.barh(labels, vals, color=colors, edgecolor=INK, lw=.5, height=.62)
for i, v in enumerate(vals):
    ax.text(v + 10, i, f"{v:,}", va="center", fontsize=9.5)
ax.set_xlabel("《》引用次数（全书合计近万处）")
ax.set_xlim(0, vals[-1] * 1.14)
ax.set_title("顾祖禹的书架：水经注一骑绝尘", fontproperties=KAI, pad=12)
ax.text(.97, .30, "水经注 = 次席左传的 2.6 倍\n「以山川为经」的文献学根基",
        transform=ax.transAxes, ha="right", va="top", fontsize=10, color=CINNABAR,
        bbox=dict(boxstyle="round,pad=.4", fc=SILK, ec=CINNABAR, lw=.8))
fig.tight_layout()
fig.savefig(os.path.join(OUT, "fig3_books.png"))
plt.close(fig)

# ══ 图 4　方位里程两级节奏 ══
bins = D["bins"]
edges = [b[0] for b in bins] + [300]
counts = [b[1] for b in bins]
fig, ax = plt.subplots(figsize=(7.2, 4.8), dpi=200)
frame(ax)
ax.bar(edges[:-1], counts, width=9.2, align="edge", color=TEAL, edgecolor=INK, lw=.4)
ax.set_yscale("log")
ax.set_xlabel("方位里程（里）")
ax.set_ylabel("频次（对数轴）")
med, p95 = D["median"], D["p95"]
ax.axvline(med, color=CINNABAR, lw=1.8, ls="--")
ax.annotate(f"中位 {med} 里\n政区内·半日之程", (med, counts[2] * 1.6),
            fontsize=10, color=CINNABAR, ha="left", xytext=(med + 8, counts[2] * 2))
ax.axvline(150, color=INK, lw=1.4, ls=":")
ax.annotate("150 里\n县→府·一日可达", (150, max(counts) * .35),
            fontsize=10, color=INK, ha="left", xytext=(158, max(counts) * .5))
ax.set_title(f"方位里程的两级行政节奏（n = {D['n_li']:,}）", fontproperties=KAI, pad=12)
fig.tight_layout()
fig.savefig(os.path.join(OUT, "fig4_li.png"))
plt.close(fig)

print(f"OK → {OUT}")
print(f"fig1 r = {r:.3f} · fig2 PC1/2/3 = {var[0]*100:.1f}/{var[1]*100:.1f}/{var[2]*100:.1f}%"
      f" cum {var[:3].sum()*100:.1f}% · split {'OK' if split_ok else 'NO'}")
