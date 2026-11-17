# 三维形胜（3D）

## Sub-features
- 入口 `3d.html`：MapLibre 地形（AWS Terrarium DEM，exaggeration 1.4）
- 场景下拉（8 幕）：井陉出太行 · 居庸望京师 · 潼关望河曲 等
- 时代墙（eraWall/eraCap/eraPlc）+ 文柱（ment 被引柱）开关
- ▶ 飞览九边：11 停靠点自动长镜头
- 书签：🔖 存视角 · ☰签 列表重飞/删 · 深链 `#cam=lng,lat,z,p,b`
- DEM 懒探测：并行起跑（与地图装载并行）；曾成功（`localStorage.fydemok`）直挂零等待；失败 → demnote 提示 + 点击重试

## How to get to it (user POV)
从主页顶栏入 3D；开场 5.2s 长镜头自西域掠至晋陕黄河峡谷（拖动即断）。

## Driving it with control-fy
```bash
python tools/control_fy.py serve start && python tools/control_fy.py doctor
python tools/control_fy.py drive 3d.html --wait "window.__m3ready" --timeout 60
python tools/control_fy.py drive 3d.html --wait "window.__m3terrain === true" --timeout 60   # 地形真挂载（s3 慢时给足）
python tools/control_fy.py screenshot 3d.html ev-3d.png --wait "window.__m3terrain === true || window.__m3ready" --timeout 60
# 全量断言（23 项）：python run_tests.py   # test_3d
```

## Gotchas
- **s3（DEM）跨境网络抖**：探针 3378ms~未达成都正常——失败路径有 4s 超时 + demnote 兜底；断言地形时 `--timeout 60`
- `window.__m3terrain` 只标记 setTerrain 调用，**不含 DEM 瓦片渲染完成**——视觉断言以截图为准
- CDP 后台标签 rAF 节流：缓动可能不步进——test_3d 的 CAM-FLY 已按「收敛或 isMoving」双判（照抄该模式）
- MapLibre 与虚拟时间不合——3D 一律走 CDP 真实时间通道（勿塞进 --virtual-time-budget 类断言页）
- 用户一动即断开场镜头——驱动时先等 `__m3ready` 再操作，别抢跑
