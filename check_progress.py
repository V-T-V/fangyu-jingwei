import json, os, sys
p = r"d:\W_A_W\HHH\data\progress.json"
if os.path.exists(p):
    d = json.load(open(p, "r", encoding="utf-8"))
    c = len(d["done_nums"])
    t = sum(i["char_count"] for i in d["items"])
    print(f"已完成: {c}/154 页")
    print(f"已抓字数: {t:,} ({t/10000:.1f} 万)")
    print(f"最后页码: {d['done_nums'][-10:]}")
    if c >= 154:
        print("🎉 全部完成!")
    else:
        print(f"⏳ 剩余约 {154-c} 页，继续等待...")
else:
    print("进度文件不存在")
