# 底图与 SW 离线

## Sub-features
- 底图切换：影像 ↔ 绢本地形（`localStorage.fybasemap` 记忆；按钮 #bmtoggle）
- 瓦片断供兜底：连续 3 张 tileerror → 移除瓦片层，绢底自足（矢量数据不受影响）
- SW 三级缓存：SHELL 预存（~700KB 外壳）/ TEXTS 懒存（首查后整本离线）/ TILES 限额 SWR（1200 张约 40MB，超限整体重置）
- 首访瓦片抢跑：index.html head 内联脚本按视口预取 z4/z5 瓦片（fetch no-cors）

## How to get to it (user POV)
左上「影像」按钮切换；刷新即见 SW 效果（离线可开）。

## Driving it with control-fy
```bash
python run_tests.py    # test_basemap · test_sw 断言
# SW 行为验证要二次导航（首次注册、二次受控）：
python tools/control_fy.py drive tests/test_sw.html --wait "document.getElementById('testlog').textContent.includes('ENDLOG')"
```

## Gotchas
- **截图底图空白 ≠ bug**：瓦片 3 错即降级绢底是设计行为；断言看矢量层（印章/九边线）
- 全部 fy* localStorage 读取都有守卫（2026-11-18 投毒实证：9 键塞损坏 JSON/数字/巨串 → 重载存活，fybasemap 自愈为 physical）
- SW 改动必须 bump `VERSION`（v111…）且全站 `?v=` 同步（lint L1 拦）；忘记 bump = 回访者吃旧缓存
- SW 的 TILES 层只认 `server.arcgisonline.com`——DEM（s3）不进 TILES 缓存
- 首访抢跑脚本在 SW 接管后自动跳过（controller 判断）——别删那个 guard
