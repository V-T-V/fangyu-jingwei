# 实用件：量距 · 三导出 · 古今对照 · 分享

## Sub-features
- 量距：Shift+点击地图两点 → 直线 km + 折合明里（0.357 驿路系数）
- 三导出（对照表面板内）：⤓ CSV（381 行治所表）/ ⤓ GeoJSON（FeatureCollection）/ ⤓ KML（xml 头）
- 古今对照表：府州页签 / 县页签（1,111 行），`openTable('fu'|'xian')` 可直调
- 分享：府卡 🔗 复制当前深链 URL

## How to get to it (user POV)
量距：按住 Shift 在地图上点两处。导出/对照：底栏工具或面板内按钮。

## Driving it with control-fy
```bash
# 量距（Leaflet 听容器非 canvas——canvas 派发计数恒 0，容器派发即达）
python -I - <<'EOF'   # 或见 tests/test_events.html MEASURE 锚的容器派发法
EOF
# 导出验证：CDP Browser.setDownloadBehavior(downloadPath=tmpdir) → 点 #kmldl/#geojsondl/#csvdl
#   → 轮询目录出文件 → 首行格式判（kml: <?xml、geojson: {"type":"FeatureCollection"、csv: 表头+381 行）
# 对照表：eval openTable('xian') → #tfilter 过滤（test_auto FILTER 锚已盖）
```

## Gotchas
- **合成点击必须派发到 #map 容器**——Leaflet 的监听在容器，canvas 冒泡事件计数为 0（2026-11-18 计数器实测）
- 量距标签是 divIcon marker（`.leaflet-marker-icon` 内文含「公里/明里」），不是 .leaflet-tooltip
- 导出文件名含中文（gh 附件同名怪癖无碍）；CSV 带 BOM（utf-8-sig 读）
- test_events 的 MEASURE 锚是本域回归门卫；GeoJSON 特征数锚在 test_filter
