# 规则 ↔ 执行者对照表

> 实施指南 Phase 3 铁律：**说不出是哪条检查在拦它，就等于没写这条规则。**
> 每条规则/教训必须能指出执行者（lint 类 · 哨兵 · 测试 · CI · 运行时兜底）。
> 新增规则时同步登记本表；散文层（AGENTS.md）只留需要判断力的事。

## L1-L2 代码库与静态分析（lint.py 16 类）

| 规则 / 教训 | 执行者 | 触发方式 |
|---|---|---|
| 版本号全站一致（`?v=` ↔ sw `VERSION`）· 教训 11/13 | lint L1 + doctor `version` | `python tools/lint.py` |
| 测试页不落根目录 · 目录即上下文 | lint L2 | 同上 |
| 数据完整性计数（府/州/县/卷）· 教训 14 口径纪律 | lint L3 + `verify.py` + CI「数据完整性」步 | CI 全跑 |
| 数字哨兵锚数下限 · 教训 19 数字要被守护 | lint L4 | lint |
| 闭包量不经 window（`window._ftw`）· 教训 17 | lint L5 | lint |
| SW 缓存清单覆盖 | lint L6 | lint |
| ANALYSIS.md 改必重排 PDF | lint L7 + `check_docs_sync.py` + CI | 文档哨兵 |
| JS 语法（静默失败） | lint L8 | lint |
| 大文件预警 | lint L9 | lint |
| 危险 API：`map.fire("click")` / `innerHTML.indexOf` 验证 / `git mv -q` | lint L10 | lint |
| Worker 无 DOM · 核心模块不引特性 DOM ID · defer 序 | lint L11 | lint |
| 借口注释（TODO/FIXME/HACK ≤3） | lint L12 | lint |
| CI 吞错（`|| true` / `|| exit 0`）· 教训 20 | lint L13 | lint（注释豁免） |
| CSS `!important` ≤25 棘轮（附录 A，按出现次数） | lint L14 | lint（只减不增） |
| subprocess `text=True` 同行显式 `encoding` · 教训 22（cp936 崩读线程→孤儿雪崩） | lint L15 | lint（注入实测过） |
| 工具脚本可编译（py_compile）· 教训 23（重复 kwarg 入库无人拦） | lint L16 | lint |

## L3 验证（测试 · 探针 · 验证技能）

| 规则 / 教训 | 执行者 | 触发方式 |
|---|---|---|
| 14 断言页全绿（含 2 CDP 真实时间页） | `run_tests.py` + CI「无头回归」 | `python run_tests.py` |
| 论文 15 数字锚（动词密度/被引/里程…） | `tools/check_stats.py` | 数字哨兵 |
| CDP 冷机启动抖动 · 教训 21（就绪循环带标志+重试） | `run_tests.py` 内置护栏 | 自动 |
| test_3d 双触发假失败（idle+超时双保险） | `fireOnce` 守卫（tests/test_3d.html） | 自动 |
| 性能主张必出自探针（不作目测） | `tools/perf_probe.py` / `control_fy.py perf` | 手动/任务内 |
| 验证技能五节（launch→doctor→drive→evidence→cleanup） | `.zcode/skills/verify-fy/SKILL.md` + `tools/control_fy.py` | 每次改码后 |
| 瓦片断供降级（3 错→绢底，矢量不受影响） | 运行时兜底 + `test_basemap` | 自动 |
| DEM 不可达（4s 超时→demnote 重试；记忆快径） | map3d.js 运行时 + `test_3d` | 自动 |
| 首访瓦片抢跑枚举正确性（像素≠瓦片） | Node 先验（开发纪律，见 DEVLOG 十一纪） | 改抢跑脚本时 |

## L5 流程（CI · 隔夜 · 约定）

| 规则 / 教训 | 执行者 | 触发方式 |
|---|---|---|
| push 必过 lint+verify+14 页 | `.github/workflows/ci.yml`（无吞错） | 每次 push |
| 生产部署 | Pages workflow | 每次 push main |
| 改数据先跑管线（可重入） | `build_data.py` / `build_mentions.py` | 手动 |
| 隔夜循环可判停 + 决策日志 | `docs/OVERNIGHT-CONTRACT.md` + `decisions.tsv` | 隔夜任务 |
| 纠正两次同类错误 → 当场上链 | 本表 + DEVLOG 教训编号（1-21） | 评审时 |

## 已知「只有散文在管」的项（降层候选）

- 代码风格（缩进/命名随仓库惯例）——无 formatter 接入
- 提交信息格式——git 历史即范例，未上 commitlint
- 图表美学判断——视觉审查用人眼/视觉模型，无可执行判据
