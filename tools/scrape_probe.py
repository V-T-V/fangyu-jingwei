"""
探测脚本：1) 获取完整目录-页码映射 2) 分析正文页面结构
"""
import requests
from bs4 import BeautifulSoup
import re
import json
import os

BASE = "http://www.guoxue123.com/biji/qing/dsfjy"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(OUT, exist_ok=True)

# 1. 拿目录页
resp = requests.get(f"{BASE}/index.htm", headers=HEADERS, timeout=15)
resp.encoding = "gb2312"   # 国学导航用 GB 编码
soup = BeautifulSoup(resp.text, "html.parser")

links = []
for a in soup.find_all("a", href=True):
    href = a["href"]
    m = re.match(r"^(\d+)\.htm$", href)
    if m:
        num = int(m.group(1))
        title = a.get_text(strip=True)
        # 过滤：标题必须含"读史方舆纪要"或单独标题（排除导航链接）
        if title and len(title) < 60 and title not in ("国学导航", "首页", "经部", "史部", "子部", "集部"):
            links.append({"num": num, "title": title})

# 去重
seen = set()
links = [x for x in links if not (x["num"] in seen or seen.add(x["num"]))]
links.sort(key=lambda x: x["num"])

print(f"[目录] 共发现 {len(links)} 个条目")
print(f"  页码范围: {links[0]['num']} ~ {links[-1]['num']}")

# 保存目录映射
with open(os.path.join(OUT, "directory.json"), "w", encoding="utf-8") as f:
    json.dump(links, f, ensure_ascii=False, indent=2)

# 2. 分析一页正文（页 017 = 北直方舆纪要序）
test_pages = [17, 8]   # 序 + 卷一原文
for pno in test_pages:
    print(f"\n[分析] 页 {pno:03d}.htm")
    resp = requests.get(f"{BASE}/{pno:03d}.htm", headers=HEADERS, timeout=15)
    resp.encoding = "gb2312"
    soup = BeautifulSoup(resp.text, "html.parser")

    # 打印所有顶层 div/p 的文本前 100 字，定位正文容器
    body = soup.find("body")
    candidates = []
    for tag in body.find_all(["div", "p"]):
        text = tag.get_text(strip=True)
        if len(text) > 50:
            candidates.append({
                "tag": tag.name,
                "class": tag.get("class", []),
                "id": tag.get("id", ""),
                "len": len(text),
                "preview": text[:120]
            })
    candidates.sort(key=lambda x: x["len"], reverse=True)
    print(f"  候选正文容器（前 5）:")
    for c in candidates[:5]:
        print(f"    <{c['tag']} id='{c['id']}' class={c['class']}> len={c['len']}")
        print(f"      → {c['preview']}")

    # 保存原始 HTML 片段供检查
    with open(os.path.join(OUT, f"sample_{pno:03d}.html"), "w", encoding="utf-8") as f:
        f.write(resp.text[:30000])

print(f"\n数据已存入 {OUT}")
