# 功能地图索引 · 全量回归扫掠顺序

> 一个功能域一文件（四个 H2：有什么 / 用户怎么到达 / 怎么驱动 / 哪里常骗人）。
> Agent 按需打开，不全量读。本文件顺序 = 全量回归扫掠顺序。

| # | 功能域 | 文件 | 断言页 |
|---|---|---|---|
| 1 | 启动与三模式（舆图/形势/川渎） | [map-modes.md](map-modes.md) | test_auto · test_filter · test_events |
| 2 | 层级门控与县治 | [gating.md](gating.md) | test_gating · test_counties · test_journey |
| 3 | 检索与全文 Worker | [search.md](search.md) | test_ft_worker · test_cli |
| 4 | 文心（文本计量） | [wenxin.md](wenxin.md) | test_wenxin |
| 5 | 阅读器（原文/TTS/夜读） | [reader.md](reader.md) | test_night · test_tts |
| 6 | 九边专题 | [bian.md](bian.md) | test_bian |
| 7 | 底图与 SW 离线 | [basemap-sw.md](basemap-sw.md) | test_basemap · test_sw |
| 8 | 三维形胜（3D） | [mode3d.md](mode3d.md) | test_3d |

全量回归：`python run_tests.py`（14 页 + lint + 哨兵 + CLI）。
 pose 页（`tests/*_pose.html`）为视觉摆拍辅助，不算断言。
