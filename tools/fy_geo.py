# -*- coding: utf-8 -*-
"""方舆共享地理口径——县治↔府治直线距离 + 中文里程数解析（唯一来源）。

被 tools/county_dist.py（论文 §三 数字之源）与 tools/build_s5.py（S5 底账）
共用：改本文件即改论文口径，53.9 km 中位锚（tools/check_stats.py）会即红。

距离口径（等距圆柱近似）：
  dx = Δlon · cos(中点纬) · 111.32   经度每度公里数
  dy = Δlat · 110.57                 纬度每度公里数
  km  = hypot(dx, dy)
"""
import math

CN = {"零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
      "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}

def county_km(la1, lo1, la2, lo2):
    """县治 (la1, lo1) → 府治 (la2, lo2) 直线公里数。"""
    dx = (lo2 - lo1) * math.cos(math.radians((la1 + la2) / 2)) * 111.32
    dy = (la2 - la1) * 110.57
    return math.hypot(dx, dy)

def cn2num(s):
    """中文里程（「一百二十」式）→ 整数；遇无法识别字符返 None。"""
    n = cur = 0
    for ch in s:
        if ch == "百":
            n += (cur or 1) * 100; cur = 0
        elif ch == "十":
            n += (cur or 1) * 10; cur = 0
        elif ch in CN:
            cur = CN[ch]
        else:
            return None
    return n + cur
