# 隔夜契约与决策日志（Phase 4 约定）

> 内循环不产 slop 才准上隔夜。四条前置：亲手做过一遍；Agent 有你用的工具
> （verify-fy 技能）；每阶段能自证并能停线；重复失败已固化成检查（RULES-EXECUTORS）。

## 契约模板（换成具体任务后照抄）

```text
我要去睡了。<任务一句话>，在 <base> 上开新分支做。
完成的定义（可判谓词，永不悄悄放宽）：
  - python run_tests.py 退出码 0（14 页全绿）
  - python tools/lint.py 全过
  - python tools/check_stats.py 全部一致
  - <任务专属谓词，如：旧调用点 grep 计数=0 / A/B 探针中位数达标>
每有进展提交一行；记决策日志 decisions.tsv；不要问我，自己判断。
若数小时仍卡死：停下，写清卡在哪、试了什么、需要什么决定。
```

## decisions.tsv 列约定（制表符分隔，追加不改写）

| 列 | 含义 |
|---|---|
| ts | ISO 时间 |
| phase | 阶段/任务短名 |
| decision | 决定（一句话，动词开头） |
| reason | 理由 |
| evidence | 证据指针（docs/evidence/<file> · run_tests 输出摘要 · commit hash） |
| outcome | 结果（done / discarded / blocked） |

## 晨起审计

1. 先读 **Attention 段**：跨模型复核 Agent 标出的值得人看的决策（默认空段也要写「无」）
2. 按证据指针抽查，**审计决策，不重读整夜流水**
3. 发现 slop：当场按「规则↔执行者」表上链（lint/测试/API），不许第三次用嘴说

## 停线条件（任一即停，停是有用的产出）

- run_tests 红且 30 分钟内两轮修复无效 → 停，保留现场证据
- 需要产品取舍/数据口径变更（哨兵锚会红）→ 停，这不可外包
- 依赖外部服务不可达（s3 DEM / 瓦片源）超过重试上限 → 停，记录时刻
