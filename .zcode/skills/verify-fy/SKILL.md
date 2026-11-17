# verify-fy · 方舆经纬验证技能

> 验证即基础设施（Lauren Tan 方法论 §3）。Agent 修完代码**必须**自证：
> 本技能拉起应用 → 驱动 → 留证 → 收尾。证据不过关 = 任务没完成。

## Launch（拉起）

```bash
python tools/control_fy.py serve start    # 本地服务 127.0.0.1:9200（幂等，已起则跳过）
python tools/control_fy.py doctor         # 健康自检——六项全 ok 才继续
```

- 端口被占/被 Windows 保留段吞：设 `FY_BASE=http://127.0.0.1:<别的端口>/` 重试
- 浏览器：自动找 Edge/Chrome；指定用 `FY_BROWSER=<路径>`
- 依赖：`pip install websocket-client`（doctor 会查）

## Doctor（自检）

每次会话**先跑 doctor**。六项：server / browser / websocket-client /
site_data / version（sw.js VERSION ↔ index ?v= 一致）/ tests 页数。
任何一项红 → 按 JSON 里 `next` 字段走，不要猜。

## Drive（驱动）

```bash
# 打开页面并等待 JS 条件（真信号，不用 sleep 猜时长）
python tools/control_fy.py drive index.html --wait "window.map && window.map._loaded"
python tools/control_fy.py drive 3d.html  --wait "window.__m3terrain === true || window.__m3ready" --timeout 60
# 深链直达场景（免交互）
python tools/control_fy.py drive "index.html#mode=形势&era=8"
```

- 全量回归（14 断言页 + 哨兵 + CLI）：`python run_tests.py`
- 单页断言：`tests/test_*.html` 各页有 R3D/TESTLOG 协议；交互时序见功能地图各文件的 Driving 节

## Evidence（证据）

```bash
# 截图（--click 先点后截；默认存 docs/evidence/，cleanup 不碰此目录）
python tools/control_fy.py screenshot index.html ev-2d.png --wait "window.map && window.map._loaded" --click "#boot .go"
# 性能数字（凡性能主张必出自此探针，不作目测）
python tools/control_fy.py perf index.html
```

什么算证据（按任务类型至少一件）：
- **修 bug**：前后对比截图 + `run_tests.py` 全绿输出
- **改性能**：perf 探针 A/B 各 ≥3 轮取中位（教训：单样本不作数）
- **改数据/文本**：`python verify.py` + `tools/check_stats.py` 全部一致
- **改 UI**：screenshot + 对应 pose 页（tests/*_pose.html）
- **改启动/入口逻辑**：`python tools/boot_smoke.py`（真页心电图——脚本前置注入错误采集，2D 10 步 / 3D 5 步全入口驱动，任一错误即红）

## Cleanup（收尾）

```bash
python tools/control_fy.py cleanup          # 清无头浏览器残留（不动证据）
python tools/control_fy.py serve stop       # 收掉本地服务
```

收尾后证据文件必须仍在 `docs/evidence/`——这是验收门槛的一部分。

## Helpers

- `tools/control_fy.py --help`：六子命令全表
- 功能地图：[references/features/README.md](references/features/README.md)（按需打开单文件，别全量读）
- 提示词配方（目标→剧本→证据）：仓库根 `docs/OVERNIGHT-CONTRACT.md` 附常用形态
