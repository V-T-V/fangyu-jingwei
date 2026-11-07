"""
《读史方舆纪要》全文抓取脚本
数据源: http://www.guoxue123.com/biji/qing/dsfjy/
输出: data/volumes.json    (结构化 JSON)
      data/volumes/*.txt   (每卷纯净 TXT)
      data/progress.json   (断点续爬进度)
"""
import requests
from bs4 import BeautifulSoup
import json
import os
import re
import time
import sys

BASE = "http://www.guoxue123.com/biji/qing/dsfjy"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9"
}
OUT_DIR = os.path.join(os.path.dirname(__file__), "data")
TXT_DIR = os.path.join(OUT_DIR, "volumes")
os.makedirs(TXT_DIR, exist_ok=True)
PROGRESS_FILE = os.path.join(OUT_DIR, "progress.json")

# ── 断点续爬：加载已有结果 ────────────────────────────────
def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"done_nums": [], "items": []}

def save_progress(prog):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(prog, f, ensure_ascii=False)

# ── 获取目录 ────────────────────────────────────────────
def get_directory():
    resp = requests.get(f"{BASE}/index.htm", headers=HEADERS, timeout=20)
    resp.encoding = "gb2312"
    soup = BeautifulSoup(resp.text, "html.parser")

    links = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        m = re.match(r"^(\d+)\.htm$", href)
        if not m:
            continue
        num = int(m.group(1))
        if num in seen:
            continue
        title = a.get_text(strip=True)
        # 排除导航类短标题
        if len(title) < 2 or len(title) > 60:
            continue
        if title in ("国学导航", "首页", "经部", "史部", "子部", "集部"):
            continue
        seen.add(num)
        links.append({"num": num, "title": title})
    links.sort(key=lambda x: x["num"])
    print(f"[目录] 共 {len(links)} 个条目: {links[0]['num']:03d} ~ {links[-1]['num']:03d}")
    return links

# ── 抓取单页正文 ──────────────────────────────────────────
def fetch_page(num):
    """抓取一个页码的内容，返回结构化 dict"""
    url = f"{BASE}/{num:03d}.htm"
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.encoding = "gb2312"
    soup = BeautifulSoup(resp.text, "html.parser")

    # 取 <title> 里的标题
    title_tag = soup.find("title")
    page_title = title_tag.get_text(strip=True) if title_tag else ""
    # 去掉"_读史方舆纪要..."
    page_title = re.sub(r"_.*$", "", page_title).strip()

    # 取最长的 <p> 作为正文容器（探测验证过的规则）
    body_paras = soup.find_all("p")
    if not body_paras:
        return None

    # 排除页脚（含 Powered by）和页头导航（含国学导航）
    candidates = []
    for p in body_paras:
        text = p.get_text(" ", strip=True)
        if len(text) < 100:
            continue
        if "Powered by" in text or "copyright" in text.lower():
            continue
        if "国学导航" in text and len(text) < 300:
            continue
        candidates.append((len(text), p, text))

    if not candidates:
        return None

    # 取最长的那个
    candidates.sort(key=lambda x: x[0], reverse=True)
    best_len, best_p, _ = candidates[0]

    # 去掉 "上一页 目录页 下一页" 头部链接
    nav_span = best_p.find("span", class_=lambda c: c and "s3" in c if c else False)
    vol_title = ""
    if nav_span:
        vol_title = nav_span.get_text(strip=True)

    # 提取卷内分标题（◎ 开头的）
    full_html = str(best_p)
    sub_title_m = re.search(r"◎([^<\n]+)", full_html)
    sub_title = sub_title_m.group(1).strip() if sub_title_m else ""

    # 提取纯净正文（保留 <span class="q"> 作为注文标记）
    # 先去掉前后的"上一页 目录页 下一页"链接
    clean_html = full_html
    clean_html = re.sub(r"上一页<[^>]*>目录页<[^>]*>下一页", "", clean_html)
    clean_html = re.sub(r"<a[^>]*>\s*上一页\s*</a>\s*<a[^>]*>\s*目录页\s*</a>\s*<a[^>]*>\s*下一页\s*</a>", "", clean_html)
    clean_html = re.sub(r"上一页", "", clean_html)

    # BR 转换行
    clean_html = re.sub(r"<BR\s*/?>", "\n", clean_html, flags=re.IGNORECASE)
    clean_html = re.sub(r"<br\s*/?>", "\n", clean_html, flags=re.IGNORECASE)

    # 卷标题 span 去掉
    clean_html = re.sub(r"<span[^>]*class=\"s3\"[^>]*>.*?</span>", "", clean_html, flags=re.DOTALL)

    # 其他 span（保留 class="q" 用于注文）
    clean_html = re.sub(r"<span class=\"q\">", "〖", clean_html)
    clean_html = re.sub(r"</span>", "〗", clean_html)
    # 其余 span 直接去掉
    clean_html = re.sub(r"<span[^>]*>", "", clean_html)

    # 去掉剩余所有 HTML 标签
    clean_html = re.sub(r"<[^>]+>", "", clean_html)

    # 去重复空白行
    clean_html = re.sub(r"\n{3,}", "\n\n", clean_html)
    clean_html = clean_html.strip()

    # 纯净文本（完全去标记）
    plain_text = re.sub(r"[〖〗]", "", clean_html)
    plain_text = re.sub(r"\n{3,}", "\n\n", plain_text).strip()

    return {
        "num": num,
        "page_title": page_title or vol_title,
        "sub_title": sub_title,
        "vol_title": vol_title,
        "html_clean": clean_html,      # 保留注文标记
        "text": plain_text,            # 纯净文本
        "char_count": len(plain_text)
    }

# ── 主流程 ────────────────────────────────────────────
def main():
    print("=" * 60)
    print("《读史方舆纪要》全文抓取")
    print("=" * 60)

    # 1. 获取目录
    directory = get_directory()

    # 2. 加载断点
    prog = load_progress()
    done = set(prog["done_nums"])

    # 3. 逐页抓取
    for i, entry in enumerate(directory):
        num = entry["num"]
        if num in done:
            print(f"[{i+1:3d}/{len(directory)}] 跳过 {num:03d} {entry['title']}")
            continue

        print(f"[{i+1:3d}/{len(directory)}] 抓取 {num:03d} {entry['title']}", end=" ... ")
        sys.stdout.flush()

        for attempt in range(3):
            try:
                item = fetch_page(num)
                break
            except Exception as e:
                wait = 2 ** attempt
                print(f"\n  重试 {attempt+1}/3 ({wait}s) ... {e}")
                time.sleep(wait)
                item = None

        if item is None:
            print("❌ 失败")
            continue

        # 补充目录元信息
        item["directory_title"] = entry["title"]
        prog["items"].append(item)
        prog["done_nums"].append(num)
        save_progress(prog)

        # 同步写 TXT
        txt_path = os.path.join(TXT_DIR, f"{num:03d}_{entry['title'].replace('·', '_').replace('/', '_')}.txt")
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(f"# {entry['title']}\n")
            f.write(f"# 来源: {BASE}/{num:03d}.htm\n\n")
            f.write(item["text"])

        print(f"✅ {item['char_count']:,} 字")
        time.sleep(1.2)  # 礼貌延迟

    # 4. 最终汇总
    all_items = sorted(prog["items"], key=lambda x: x["num"])
    final = {
        "book": "读史方舆纪要",
        "author": "顾祖禹",
        "source": "http://www.guoxue123.com/biji/qing/dsfjy/",
        "total_pages": len(all_items),
        "total_chars": sum(i["char_count"] for i in all_items),
        "directory": [{k: v for k, v in d.items() if k != "text"} for d in all_items],
        "items": all_items
    }
    out_path = os.path.join(OUT_DIR, "volumes.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False)

    print("\n" + "=" * 60)
    print(f"🎉 抓取完成！")
    print(f"   条目: {final['total_pages']} 页")
    print(f"   总字数: {final['total_chars']:,} 字 ({final['total_chars']/10000:.0f} 万)")
    print(f"   → {out_path}")
    print(f"   → {TXT_DIR}/")
    print("=" * 60)

if __name__ == "__main__":
    main()
