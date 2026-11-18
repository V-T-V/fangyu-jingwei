# 检索与全文 Worker

## Sub-features
- 名检索框：`/` 聚焦，110ms 防抖，XSS 转义；回车直达首条；清空输入即 `clearTimeout` 挂起防抖并收起结果（EDGE-clear110 锚）
- 全文检索（Worker 优先）：8.2MB 语料在 `js/ftworker.js` 内解析（计数/片段纯核 `js/ft_core.js` 由 Worker importScripts 共用），主线程零解析（MAIN-CLEAN 断言）
- Worker 不可达 → 主线程降级路径（同结果，慢）
- 检索结果 → 点条目飞临 + 开卡片；「⤓ 文本」存 .txt

## How to get to it (user POV)
按 `/` 或点检索框，输入府名/县名/任意词；全文模式跨 260 万字。

## Driving it with control-fy
```bash
# Worker 通道断言（6 项）：R3D 协议页
python tools/control_fy.py drive tests/test_ft_worker.html --wait "document.title.startsWith('R3D:')" --timeout 90
python run_tests.py   # 含 test_ft_worker + test_cli（7 用例）
```

## Gotchas
- **禁 `window._ftw` 访问闭包量**（let 不在 window，Promise 回调里静默 TypeError→永久卡死）——经 `js/fulltext.js` 的闭包安全挂接（`ftWorkerReady()` / `ftWorkerProgress(cb)` 等）触达（AGENTS 禁止清单）
- Worker 里禁 document/window（lint L11）
- 首次全文检索会懒加载 18 个 text/*.js——无头环境网络慢时 --timeout 给足 90s
- 断言进度读 `#wxProg` / `#sresults` 的 DOM 文本（test_ft_worker 的 WX-WORKER 断言即内嵌 prog 诊断段）；`ftWorkerProgress(cb)` 现为设置/清除回调（无返回值），别轮询内部变量
