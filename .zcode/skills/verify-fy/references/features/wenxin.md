# 文心（文本计量面板）

## Sub-features
- 🖋 文心底栏入口：七节（卷帙/被引/书架/天下之X/山河/动词/战略词汇）
- 密度着色：🗺 被引着色 与四态循环（语汇⇄动词⇄水名⇄山名）——河南与广东颜色反转是最直观的验证画面
- 文柱（3D 模式）：被引次数成柱
- 计算通道：Worker 优先（ftworker.js `wenxinCompute` 直算），主线程降级（wenxin.js `wxCompute` 按块让出）；词表/计量纯核在 `js/ft_core.js` 双路共用；计算中有 `wx-prog` 呼吸动画

## How to get to it (user POV)
底栏点「🖋 文心」开面板；面板内按钮切换着色模式；地图上府色随指标变。

## Driving it with control-fy
```bash
python tools/control_fy.py screenshot index.html ev-wenxin.png \
  --wait "window.map && window.map._loaded" --click "#boot .go"
# 断言页（无头 TESTLOG 协议，打开文心后逐节断言）：
python tools/control_fy.py drive tests/test_wenxin.html --wait "document.getElementById('testlog').textContent.includes('ENDLOG')" --timeout 60
```

## Gotchas
- 文心首次计算要等 Worker 拿到全语料——断言给 `--timeout 60`
- 密度着色状态在 body class 上，四态循环断言前先读初态
- **论文数字与站点数字同源**（paper_stats.js）——改词表后必须跑 `tools/check_stats.py`（22 锚 = 15 语料 + 3 空间 + 4 文档），否则数字哨兵红
- 河南动词 105.17、广东动词 40.99、浙江语汇 10.47 等是哨兵锚——动它们前先想清楚（改口径=改论文）
