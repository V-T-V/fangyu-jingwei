# 层级门控与县治

## Sub-features
- 缩放门控：县治 z≥7 · 州治 z≥6 · 关隘 z≥5（addLayer/removeLayer，非 CSS 隐藏）
- 治所三层：193 府 + 187 州 + 1,111 县（1,109 县治坐标覆盖 99.8%；黔江·嘉禾为诚实缺口）
- 府卡片：点府治印章 → openFu；县卡片 openCountyCard（含方位/里程/类型）
- Voronoi 与凸包：省域示意；密度着色四态循环（语汇⇄动词⇄水名⇄山名）
- 量距：Shift+点两处量直线距离

## How to get to it (user POV)
滚轮放大到省级（z6+）州浮出、z7+ 县密布；点任意印章出卡片。

## Driving it with control-fy
```bash
python tools/control_fy.py drive "index.html#cam=114,34,7.5" --wait "window.map.getZoom() >= 7"
# 断言层：tests/test_gating.html（门控）· test_counties.html（计数）· test_journey.html（一日可达）
python run_tests.py
```

## Gotchas
- 门控断言要看**图层在场**而非 marker 数（GL 化后 marker 数不随缩放变）
- 密度着色是四态循环按钮，断言前先记当前态（body class）
- 县坐标是三角化推算——**凡数字必出自脚本**（build_data.py / paper_stats.js），视觉读图不作数据源
