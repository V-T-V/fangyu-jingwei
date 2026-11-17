# fy-mode · 方舆经纬工作流主入口（目标 → 剧本 → 证据）

> 收到任务先路由，再动手。三要素不可替换：**repro 在前 + 完成条件（可判谓词）+
> 点名验证技能与证据形态**。验证一律走 `/verify-fy`（serve→doctor→drive→evidence→cleanup）。

## 修 bug
先复现：`control_fy.py drive <能触发问题的页面/深链> --wait <相关真信号>`。
复现不了 → 如实说「复现不了」并给探查记录，**不许先动手修**。
复现了 → 修 → `run_tests.py` 全绿 + 前后对比截图（screenshot 同参数两张）。

## 新功能
先写完成条件（谓词，不是描述）：如「点 #bmtoggle 后 body.imgbasemap 在 1s 内切换」。
实现 → 跑谓词 drive → 截图证据 → `run_tests.py`。涉及数据 → `verify.py` + 数字哨兵。

## 改性能
先量基线：`control_fy.py perf <page>` ×≥3 取中位。改完再测 ×≥3。
**单样本不作数**；A/B 报告写明中位数与轮数。见 perf-metrics 惯例（docs/RULES-EXECUTORS）。

## 重构
先录现状（截图 + 关键 drive 输出），改后逐项对拍证明零变化 +
`run_tests.py` 全绿。声称「零行为变化」就要有零变化的证据。

## 纠正复犯（/correct 等价）
同类错误第二次出现：当场改 API 或加 lint/哨兵（登记 docs/RULES-EXECUTORS.md），
不许第三次用嘴说。

## 拉回跑偏
「我要的是复现，不是修复」——一句话纠正即可，靠共同词汇，不写长段。

## 隔夜任务
按 docs/OVERNIGHT-CONTRACT.md：完成谓词 + decisions.tsv + 停线条件三件套齐了才准过夜。
